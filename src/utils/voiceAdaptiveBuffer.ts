import type { GameStatus } from '../types/game';

export const ADAPTIVE_BUFFER_MAX_DELAY_SEC = 1.0;

export interface AdaptiveRttSampleResult {
  instantRttMs: number;
  smoothedRttMs: number;
  jitterMs: number;
  serverClockOffsetMs: number;
  targetBufferMs: number;
}

export interface AdaptivePlaybackGraphNode {
  source: MediaStreamAudioSourceNode;
  delayNode: DelayNode;
  analyser: AnalyserNode;
  outputGain: GainNode;
  stream: MediaStream;
  currentDelayMs: number;
  isMuted: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calcula o atraso alvo do buffer adaptativo (em ms) para manter o áudio de voz
 * sincronizado com a rede (RTT + Jitter) e com o estado atual da corrida.
 *
 * - Durante 'starting' / 'running': prioriza alinhamento temporal apertado entre
 *   os fluxos de voz e os eventos de movimento/contagem da pista.
 * - Durante 'idle' / 'completed': permite uma margem ligeiramente mais folgada
 *   contra flutuações de Wi-Fi/4G no lobby ou pódio.
 */
export function computeAdaptiveVoiceBufferMs(params: {
  rttMs: number | null;
  jitterMs: number;
  raceStatus: GameStatus;
  peerRttMs?: number | null;
}): number {
  const { rttMs, jitterMs, raceStatus, peerRttMs } = params;
  const safeRtt = rttMs !== null && Number.isFinite(rttMs) ? Math.max(0, rttMs) : 45;
  const safeJitter = Number.isFinite(jitterMs) ? Math.max(0, jitterMs) : 0;

  const isRaceActive = raceStatus === 'starting' || raceStatus === 'running';
  const minMs = isRaceActive ? 20 : 35;
  const maxMs = isRaceActive ? 240 : 300;
  const rttWeight = isRaceActive ? 0.28 : 0.35;
  const jitterWeight = isRaceActive ? 1.35 : 1.5;

  // Compensação entre pares: se um participante tem RTT ao servidor menor,
  // adicionamos um pequeno ajuste para alinhar as vozes com a linha temporal do servidor.
  let crossPeerAlignmentMs = 0;
  if (typeof peerRttMs === 'number' && Number.isFinite(peerRttMs) && peerRttMs >= 0) {
    crossPeerAlignmentMs = clamp((safeRtt - peerRttMs) * 0.25, 0, 45);
  }

  const rawTarget = minMs + safeRtt * rttWeight + safeJitter * jitterWeight + crossPeerAlignmentMs;
  return Math.round(clamp(rawTarget, minMs, maxMs));
}

export function computeWebRtcJitterBufferTargetMs(adaptiveBufferMs: number): number {
  return Math.round(clamp(adaptiveBufferMs * 0.55, 20, 220));
}

/**
 * Atualiza a estimativa suavizada (EWMA) de RTT, jitter e deslocamento do relógio
 * do servidor a partir de uma resposta voice:pong.
 */
export function processVoicePongSample(params: {
  clientTime: number;
  serverTime: number;
  receivedAt?: number;
  prevRttMs: number | null;
  prevJitterMs: number;
  raceStatus: GameStatus;
}): AdaptiveRttSampleResult {
  const now = typeof params.receivedAt === 'number' ? params.receivedAt : Date.now();
  const instantRttMs = Math.max(0, Math.round(now - params.clientTime));

  let smoothedRttMs: number;
  let jitterMs: number;

  if (params.prevRttMs === null || !Number.isFinite(params.prevRttMs)) {
    smoothedRttMs = instantRttMs;
    jitterMs = 0;
  } else {
    smoothedRttMs = Math.round(params.prevRttMs * 0.75 + instantRttMs * 0.25);
    const deviation = Math.abs(instantRttMs - params.prevRttMs);
    jitterMs = Math.round((params.prevJitterMs * 0.72 + deviation * 0.28) * 10) / 10;
  }

  const estimatedOneWayMs = instantRttMs / 2;
  const serverClockOffsetMs = Math.round(params.serverTime - (params.clientTime + estimatedOneWayMs));

  const targetBufferMs = computeAdaptiveVoiceBufferMs({
    rttMs: smoothedRttMs,
    jitterMs,
    raceStatus: params.raceStatus,
  });

  return {
    instantRttMs,
    smoothedRttMs,
    jitterMs,
    serverClockOffsetMs,
    targetBufferMs,
  };
}

/**
 * Cria o grafo Web Audio de reprodução adaptativa para um fluxo remoto:
 * MediaStreamAudioSourceNode -> DelayNode -> AnalyserNode -> GainNode -> destination
 *
 * O AnalyserNode fica posicionado após o DelayNode para que os visualizadores
 * de onda/orador fiquem em sincronia com o áudio efetivamente reproduzido.
 */
export function createAdaptivePlaybackGraph(params: {
  ctx: AudioContext;
  stream: MediaStream;
  initialDelayMs: number;
  muted: boolean;
}): AdaptivePlaybackGraphNode {
  const { ctx, stream, initialDelayMs, muted } = params;
  const source = ctx.createMediaStreamSource(stream);

  const delayNode = ctx.createDelay(ADAPTIVE_BUFFER_MAX_DELAY_SEC);
  const clampedDelayMs = clamp(initialDelayMs, 0, ADAPTIVE_BUFFER_MAX_DELAY_SEC * 1000);
  delayNode.delayTime.setValueAtTime(clampedDelayMs / 1000, ctx.currentTime);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.65;

  const outputGain = ctx.createGain();
  outputGain.gain.setValueAtTime(muted ? 0 : 1.0, ctx.currentTime);

  source.connect(delayNode);
  delayNode.connect(analyser);
  analyser.connect(outputGain);
  outputGain.connect(ctx.destination);

  return {
    source,
    delayNode,
    analyser,
    outputGain,
    stream,
    currentDelayMs: clampedDelayMs,
    isMuted: muted,
  };
}

/**
 * Atualiza suavemente o DelayNode (com constante de tempo exponencial de 140ms)
 * evitando estalidos ou saltos bruscos de áudio ao adaptar ao RTT da rede.
 */
export function applyAdaptiveDelayToNode(
  ctx: AudioContext,
  node: AdaptivePlaybackGraphNode,
  targetDelayMs: number
): void {
  const clampedMs = clamp(targetDelayMs, 0, ADAPTIVE_BUFFER_MAX_DELAY_SEC * 1000);
  if (Math.abs(node.currentDelayMs - clampedMs) < 1) {
    return;
  }
  node.currentDelayMs = clampedMs;
  const targetSec = clampedMs / 1000;
  try {
    node.delayNode.delayTime.setTargetAtTime(targetSec, ctx.currentTime, 0.14);
  } catch {
    node.delayNode.delayTime.value = targetSec;
  }
}

export function setAdaptiveGraphMuted(
  ctx: AudioContext | null,
  node: AdaptivePlaybackGraphNode,
  muted: boolean
): void {
  node.isMuted = muted;
  const targetGain = muted ? 0 : 1.0;
  if (ctx && ctx.state !== 'closed') {
    try {
      node.outputGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.025);
      return;
    } catch {
      // Fallback direto
    }
  }
  node.outputGain.gain.value = targetGain;
}

export function disposeAdaptivePlaybackGraph(node: AdaptivePlaybackGraphNode): void {
  try {
    node.source.disconnect();
  } catch {
    // noop
  }
  try {
    node.delayNode.disconnect();
  } catch {
    // noop
  }
  try {
    node.analyser.disconnect();
  } catch {
    // noop
  }
  try {
    node.outputGain.disconnect();
  } catch {
    // noop
  }
}
