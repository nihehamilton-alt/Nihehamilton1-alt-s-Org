import React, { useEffect, useMemo, useRef } from 'react';
import { AudioWaveform, Mic, MicOff, Volume2 } from 'lucide-react';
import type { VoiceRemotePeer } from '../contexts/VoiceChatContext';
import { AvatarDoll } from './AvatarDoll';

export interface VoiceWaveformLabels {
  waveformTitle: string;
  waveformAria: string;
  youLabel: string;
  speakingNow: string;
  listeningIdle: string;
  joinPrompt: string;
  mutedLabel: string;
  activeSpeakersCount: string;
}

interface VoiceWaveformVisualizerProps {
  isJoined: boolean;
  isMicMuted: boolean;
  isDeafened: boolean;
  isLocalSpeaking: boolean;
  localPlayerName: string;
  peers: VoiceRemotePeer[];
  mutedPeerIds: string[];
  getSpeakerAudioSnapshot: () => {
    localAnalyser: AnalyserNode | null;
    localLevel: number;
    peerAnalysers: Record<string, AnalyserNode>;
    peerLevels: Record<string, number>;
  };
  compact?: boolean;
  labels: VoiceWaveformLabels;
}

interface SpeakerTraceSpec {
  id: string;
  name: string;
  isLocal: boolean;
  color: string;
  glow: string;
  muted: boolean;
  signaledSpeaking: boolean;
}

const REMOTE_PALETTE = [
  { color: 'rgb(56, 189, 248)', glow: 'rgba(56, 189, 248, 0.45)' }, // Sky
  { color: 'rgb(251, 191, 36)', glow: 'rgba(251, 191, 36, 0.45)' }, // Amber
  { color: 'rgb(167, 139, 250)', glow: 'rgba(167, 139, 250, 0.45)' }, // Violet
  { color: 'rgb(244, 114, 182)', glow: 'rgba(244, 114, 182, 0.45)' }, // Rose
];

export const VoiceWaveformVisualizer: React.FC<VoiceWaveformVisualizerProps> = ({
  isJoined,
  isMicMuted,
  isDeafened,
  isLocalSpeaking,
  localPlayerName,
  peers,
  mutedPeerIds,
  getSpeakerAudioSnapshot,
  compact = false,
  labels,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeSpeakerTextRef = useRef<HTMLSpanElement | null>(null);
  const volumeBadgeRef = useRef<HTMLSpanElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chipMeterRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chipPctRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const snapshotFnRef = useRef(getSpeakerAudioSnapshot);
  snapshotFnRef.current = getSpeakerAudioSnapshot;

  const speakerSpecs = useMemo<SpeakerTraceSpec[]>(() => {
    const list: SpeakerTraceSpec[] = [
      {
        id: '__local__',
        name: `${localPlayerName || labels.youLabel} (${labels.youLabel})`,
        isLocal: true,
        color: 'rgb(52, 211, 153)',
        glow: 'rgba(52, 211, 153, 0.5)',
        muted: isMicMuted,
        signaledSpeaking: isJoined && !isMicMuted && isLocalSpeaking,
      },
    ];
    peers.forEach((peer, index) => {
      const palette = REMOTE_PALETTE[index % REMOTE_PALETTE.length];
      const peerBlocked = isDeafened || mutedPeerIds.includes(peer.peerId) || peer.muted;
      list.push({
        id: peer.peerId,
        name: peer.name,
        isLocal: false,
        color: palette.color,
        glow: palette.glow,
        muted: peerBlocked,
        signaledSpeaking: isJoined && !peerBlocked && peer.speaking,
      });
    });
    return list;
  }, [
    isDeafened,
    isJoined,
    isLocalSpeaking,
    isMicMuted,
    labels.youLabel,
    localPlayerName,
    mutedPeerIds,
    peers,
  ]);

  const speakerSpecsRef = useRef(speakerSpecs);
  speakerSpecsRef.current = speakerSpecs;

  const joinedStateRef = useRef(isJoined);
  joinedStateRef.current = isJoined;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = Math.max(200, canvas.clientWidth || 300);
    let height = Math.max(compact ? 36 : 56, canvas.clientHeight || (compact ? 36 : 56));
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const syncCanvasSize = () => {
      const nextW = Math.max(180, Math.round(canvas.clientWidth || 300));
      const nextH = Math.max(compact ? 36 : 56, Math.round(canvas.clientHeight || (compact ? 36 : 56)));
      const nextDpr = Math.min(2, window.devicePixelRatio || 1);
      if (nextW !== width || nextH !== height || nextDpr !== dpr) {
        width = nextW;
        height = nextH;
        dpr = nextDpr;
      }
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
    };

    syncCanvasSize();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncCanvasSize()) : null;
    resizeObserver?.observe(canvas);

    const smoothedLevels = new Map<string, number>();
    let timeBuffer: Float32Array<ArrayBuffer> = new Float32Array(256);
    let freqBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(128);
    let rafId = 0;
    let lastDomUpdate = 0;

    const drawFrame = (now: number) => {
      syncCanvasSize();
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const midY = height / 2;

      // Subtle horizontal reference grid
      ctx.strokeStyle = 'rgba(63, 63, 70, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      const specs = speakerSpecsRef.current;
      const snapshot = snapshotFnRef.current();
      const joined = joinedStateRef.current;

      let dominantSpeaker: SpeakerTraceSpec | null = null;
      let dominantLevel = 0;
      let activeCount = 0;

      const resolvedSpeakers: Array<{
        spec: SpeakerTraceSpec;
        level: number;
        analyser: AnalyserNode | null;
        isActive: boolean;
      }> = [];

      for (const spec of specs) {
        const analyser = spec.isLocal
          ? snapshot.localAnalyser
          : snapshot.peerAnalysers[spec.id] || null;

        let rawLevel = 0;
        if (joined && !spec.muted) {
          rawLevel = spec.isLocal ? snapshot.localLevel : snapshot.peerLevels[spec.id] || 0;
          if (spec.signaledSpeaking && rawLevel < 0.08) {
            rawLevel = Math.max(rawLevel, 0.22);
          }
        }

        const prev = smoothedLevels.get(spec.id) || 0;
        const nextLevel =
          rawLevel > prev ? prev * 0.4 + rawLevel * 0.6 : prev * 0.82 + rawLevel * 0.18;
        const cleanLevel = nextLevel < 0.01 ? 0 : Math.min(1, nextLevel);
        smoothedLevels.set(spec.id, cleanLevel);

        const isActive = joined && !spec.muted && (spec.signaledSpeaking || cleanLevel >= 0.04);
        if (isActive) {
          activeCount += 1;
        }
        if (cleanLevel > dominantLevel || (isActive && !dominantSpeaker)) {
          dominantLevel = cleanLevel;
          dominantSpeaker = spec;
        }

        resolvedSpeakers.push({ spec, level: cleanLevel, analyser, isActive });
      }

      // Draw dynamic frequency spectrum + waveform traces for each active speaker (or flat baseline when idle)
      const activeTraces = resolvedSpeakers.filter((item) => item.isActive || item.level > 0.02);

      if (!joined || activeTraces.length === 0) {
        ctx.strokeStyle = 'rgba(113, 113, 122, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
      } else {
        const samplePoints = compact ? 44 : 68;
        const freqBars = compact ? 20 : 28;
        const maxAmplitude = Math.max(8, height * 0.42);
        const phase = now * (prefersReducedMotion ? 0.001 : 0.0075);

        activeTraces.forEach((trace, traceIdx) => {
          const analyser = trace.analyser;
          let hasTimeSamples = false;
          let hasFreqSamples = false;
          if (analyser) {
            if (timeBuffer.length !== analyser.fftSize) {
              timeBuffer = new Float32Array(analyser.fftSize);
            }
            if (freqBuffer.length !== analyser.frequencyBinCount) {
              freqBuffer = new Uint8Array(analyser.frequencyBinCount);
            }
            analyser.getFloatTimeDomainData(timeBuffer);
            analyser.getByteFrequencyData(freqBuffer);
            for (let k = 0; k < timeBuffer.length; k += 8) {
              if (Math.abs(timeBuffer[k]) > 0.0015) {
                hasTimeSamples = true;
                break;
              }
            }
            for (let f = 1; f < Math.min(28, freqBuffer.length); f++) {
              if (freqBuffer[f] > 8) {
                hasFreqSamples = true;
                break;
              }
            }
          }

          if (traceIdx === 0 && hasFreqSamples && !prefersReducedMotion) {
            const barGap = 2;
            const barW = Math.max(2, (width - barGap * (freqBars - 1)) / freqBars);
            ctx.save();
            ctx.fillStyle = trace.spec.color;
            for (let b = 0; b < freqBars; b++) {
              const binIdx = Math.min(freqBuffer.length - 1, b + 1);
              const mag = freqBuffer[binIdx] / 255;
              const halfBar = Math.max(1.5, mag * (height * 0.36));
              ctx.globalAlpha = 0.12 + mag * 0.22;
              const bx = b * (barW + barGap);
              ctx.fillRect(bx, midY - halfBar, barW, halfBar * 2);
            }
            ctx.restore();
          }

          ctx.save();
          ctx.strokeStyle = trace.spec.color;
          ctx.lineWidth = traceIdx === activeTraces.length - 1 ? 2 : 1.5;
          ctx.shadowColor = trace.spec.glow;
          ctx.shadowBlur = prefersReducedMotion ? 0 : 8;
          ctx.beginPath();

          for (let i = 0; i < samplePoints; i++) {
            const normX = i / (samplePoints - 1);
            const x = normX * width;
            // Smooth Hann taper at edges so the wave anchors cleanly to center line
            const edgeEnvelope = Math.sin(normX * Math.PI);

            let displacement = 0;
            if (hasTimeSamples && !prefersReducedMotion) {
              const sampleIdx = Math.min(
                timeBuffer.length - 1,
                Math.floor(normX * (timeBuffer.length - 1))
              );
              const freqIdx = Math.min(
                freqBuffer.length - 1,
                1 + Math.floor(normX * Math.min(22, freqBuffer.length - 2))
              );
              const rawSample = timeBuffer[sampleIdx];
              const freqEnergy = hasFreqSamples ? (freqBuffer[freqIdx] / 255) * 0.45 : 0;
              const boosted = Math.max(-1, Math.min(1, rawSample * 3.6));
              const synthCarrier =
                Math.sin(normX * 14 + phase + traceIdx * 1.4) * Math.max(trace.level * 0.32, freqEnergy * 0.55);
              displacement = (boosted * 0.8 + synthCarrier) * edgeEnvelope * maxAmplitude;
            } else {
              const envelope = prefersReducedMotion ? 0.55 : 1;
              const harmonic =
                Math.sin(normX * 12 + phase + traceIdx * 1.7) * 0.65 +
                Math.sin(normX * 23 - phase * 1.3 + traceIdx) * 0.35;
              displacement = harmonic * trace.level * envelope * edgeEnvelope * maxAmplitude;
            }

            const y = midY + displacement;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.stroke();

          // Subtle mirrored fill envelope for primary active speaker
          if (traceIdx === 0 && !compact) {
            ctx.lineTo(width, midY);
            ctx.lineTo(0, midY);
            ctx.closePath();
            ctx.globalAlpha = 0.11;
            ctx.fillStyle = trace.spec.color;
            ctx.fill();
          }
          ctx.restore();
        });
      }

      ctx.restore();

      // Update active speaker HUD & per-speaker chips cleanly at ~15fps
      if (now - lastDomUpdate > 65) {
        lastDomUpdate = now;

        if (activeSpeakerTextRef.current) {
          if (!joined) {
            activeSpeakerTextRef.current.textContent = labels.joinPrompt;
            activeSpeakerTextRef.current.style.color = 'rgb(161, 161, 170)';
          } else if (dominantSpeaker && dominantLevel >= 0.03) {
            const labelText =
              activeCount > 1
                ? `${dominantSpeaker.name} (+${activeCount - 1})`
                : `${dominantSpeaker.name} · ${labels.speakingNow}`;
            activeSpeakerTextRef.current.textContent = labelText;
            activeSpeakerTextRef.current.style.color = dominantSpeaker.color;
          } else if (specs.length === 1 && specs[0].muted) {
            activeSpeakerTextRef.current.textContent = labels.mutedLabel;
            activeSpeakerTextRef.current.style.color = 'rgb(251, 113, 133)';
          } else {
            activeSpeakerTextRef.current.textContent = labels.listeningIdle;
            activeSpeakerTextRef.current.style.color = 'rgb(161, 161, 170)';
          }
        }

        if (volumeBadgeRef.current) {
          const pct = Math.round(dominantLevel * 100);
          volumeBadgeRef.current.textContent = `${pct}%`;
        }

        for (const item of resolvedSpeakers) {
          const pct = Math.round(item.level * 100);
          const chipEl = chipRefs.current[item.spec.id];
          const barEl = chipMeterRefs.current[item.spec.id];
          const pctEl = chipPctRefs.current[item.spec.id];

          if (chipEl) {
            if (item.isActive) {
              chipEl.style.borderColor = item.spec.color;
              chipEl.style.boxShadow = `0 0 10px ${item.spec.glow}`;
            } else {
              chipEl.style.borderColor = '';
              chipEl.style.boxShadow = 'none';
            }
          }
          if (barEl) {
            barEl.style.width = `${item.spec.muted ? 0 : Math.max(item.isActive ? 10 : 0, pct)}%`;
            barEl.style.backgroundColor = item.spec.color;
          }
          if (pctEl) {
            pctEl.textContent = item.spec.muted ? '0%' : `${pct}%`;
          }
        }
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
    };
  }, [
    compact,
    labels.joinPrompt,
    labels.listeningIdle,
    labels.mutedLabel,
    labels.speakingNow,
  ]);

  return (
    <div
      className={`flex flex-col ${
        compact ? 'gap-1.5' : 'gap-2'
      } rounded-xl bg-zinc-950/90 border border-zinc-800/90 ${
        compact ? 'p-2' : 'p-2.5'
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
        <div className="flex items-center gap-1.5 min-w-0">
          <AudioWaveform size={13} className="text-emerald-400 shrink-0" />
          <span className="font-bold text-zinc-300 shrink-0">{labels.waveformTitle}</span>
          <span className="text-zinc-600 shrink-0" aria-hidden="true">
            ·
          </span>
          <span
            ref={activeSpeakerTextRef}
            className="truncate font-bold text-zinc-400"
          >
            {isJoined ? labels.listeningIdle : labels.joinPrompt}
          </span>
        </div>
        <span
          ref={volumeBadgeRef}
          className="text-[10px] font-black text-zinc-300 tabular-nums shrink-0 w-9 text-right"
        >
          0%
        </span>
      </div>

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={labels.waveformAria}
        className={`w-full block rounded-lg bg-zinc-900/75 border border-zinc-800/80 ${
          compact ? 'h-9' : 'h-14'
        }`}
      />

      {!compact && isJoined && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {speakerSpecs.map((spec) => (
            <div
              key={spec.id}
              ref={(el) => {
                chipRefs.current[spec.id] = el;
              }}
              className="flex-1 min-w-[125px] px-2 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 transition-[border-color,box-shadow] duration-150 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AvatarDoll name={spec.name} size={16} variant="bust" />
                  <span className="font-bold text-zinc-200 truncate">{spec.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {spec.muted ? (
                    <MicOff size={10} className="text-rose-400" />
                  ) : spec.isLocal ? (
                    <Mic size={10} style={{ color: spec.color }} />
                  ) : (
                    <Volume2 size={10} style={{ color: spec.color }} />
                  )}
                  <span
                    ref={(el) => {
                      chipPctRefs.current[spec.id] = el;
                    }}
                    className="text-[9px] font-bold text-zinc-400 tabular-nums w-7 text-right"
                  >
                    0%
                  </span>
                </div>
              </div>
              <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  ref={(el) => {
                    chipMeterRefs.current[spec.id] = el;
                  }}
                  className="h-full rounded-full transition-[width] duration-75"
                  style={{ width: '0%', backgroundColor: spec.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
