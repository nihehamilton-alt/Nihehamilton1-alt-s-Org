export type VoiceGateSensitivity = 'strict' | 'balanced';

export interface VoiceProcessorParams {
  micMuted: boolean;
  deafened: boolean;
  noiseGateMode: VoiceGateSensitivity;
  hasHeadset: boolean;
  remoteSpeaking: boolean;
}

export interface VoiceProcessorTelemetry {
  preGateRms: number;
  postGateRms: number;
  gateOpen: boolean;
  noiseFloor: number;
}

export interface VoiceAudioProcessorHandle {
  outputStream: MediaStream;
  analyserNode: AnalyserNode | null;
  mode: 'audioworklet' | 'scriptprocessor' | 'passthrough';
  updateParams: (next: Partial<VoiceProcessorParams>) => void;
  resume: () => Promise<void>;
  dispose: () => void;
}

const WORKLET_PROCESSOR_NAME = 'rei-voice-gate-processor';

// Processador AudioWorklet executado na thread dedicada de áudio (128 samples / ~2.67ms a 48kHz)
const WORKLET_CODE = `
class ReiVoiceGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.micMuted = true;
    this.deafened = false;
    this.strictMode = true;
    this.hasHeadset = false;
    this.remoteSpeaking = false;

    this.gateEnvelope = 0;
    this.gateOpen = false;
    this.holdSamplesRemaining = 0;
    this.noiseFloor = 0.004;
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
    this.samplesSinceTelemetry = 0;
    this.lastSentGateOpen = false;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (typeof data.micMuted === 'boolean') this.micMuted = data.micMuted;
      if (typeof data.deafened === 'boolean') this.deafened = data.deafened;
      if (typeof data.strictMode === 'boolean') this.strictMode = data.strictMode;
      if (typeof data.hasHeadset === 'boolean') this.hasHeadset = data.hasHeadset;
      if (typeof data.remoteSpeaking === 'boolean') this.remoteSpeaking = data.remoteSpeaking;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outCh = output[0];
    if (!input || input.length === 0 || !input[0]) {
      outCh.fill(0);
      return true;
    }

    const inCh = input[0];
    const len = inCh.length;

    if (this.micMuted) {
      this.gateOpen = false;
      this.holdSamplesRemaining = 0;
      this.gateEnvelope *= 0.65;
      if (this.gateEnvelope < 0.0001) this.gateEnvelope = 0;
      for (let i = 0; i < len; i++) {
        outCh[i] = inCh[i] * this.gateEnvelope;
      }
      if (this.lastSentGateOpen || this.samplesSinceTelemetry > 0) {
        this.lastSentGateOpen = false;
        this.samplesSinceTelemetry = 0;
        this.port.postMessage({
          preGateRms: 0,
          postGateRms: 0,
          gateOpen: false,
          noiseFloor: this.noiseFloor,
        });
      }
      return true;
    }

    // 1. Bloqueio DC + medição RMS na faixa já filtrada pelo High-Pass/Low-Pass
    let sumSq = 0;
    for (let i = 0; i < len; i++) {
      const x = inCh[i];
      const hp = x - this.dcPrevIn + 0.992 * this.dcPrevOut;
      this.dcPrevIn = x;
      this.dcPrevOut = hp;
      sumSq += hp * hp;
    }
    const rms = Math.sqrt(sumSq / len);

    // 2. Limiar adaptativo + proteção anti-eco suave para voz humana clara (sem cortar falas normais)
    const baseThreshold = this.strictMode ? 0.011 : 0.0055;
    const floorMult = this.strictMode ? 2.4 : 1.9;
    const echoGuardActive = !this.hasHeadset && this.remoteSpeaking && !this.deafened;
    const echoGuardBoost = echoGuardActive ? 0.008 : 0;

    const openThreshold = Math.max(baseThreshold, this.noiseFloor * floorMult) + echoGuardBoost;
    const closeThreshold = openThreshold * 0.58;
    const holdSamples = Math.round(sampleRate * (this.strictMode ? 0.24 : 0.32));

    // Atualiza piso de ruído ambiente somente quando o gate está fechado e sem falar
    if (!this.gateOpen && rms < openThreshold * 0.9) {
      const adaptRate = rms < this.noiseFloor ? 0.08 : 0.015;
      this.noiseFloor = this.noiseFloor * (1 - adaptRate) + rms * adaptRate;
      if (this.noiseFloor < 0.0008) this.noiseFloor = 0.0008;
      if (this.noiseFloor > 0.012) this.noiseFloor = 0.012;
    }

    if (rms >= openThreshold) {
      this.gateOpen = true;
      this.holdSamplesRemaining = holdSamples;
    } else if (this.gateOpen) {
      if (rms >= closeThreshold) {
        this.holdSamplesRemaining = Math.max(this.holdSamplesRemaining, Math.round(holdSamples * 0.5));
      } else if (this.holdSamplesRemaining > 0) {
        this.holdSamplesRemaining -= len;
      } else {
        this.gateOpen = false;
      }
    }

    // Quando fechado (incluindo proteção anti-eco), silencia totalmente o envio
    const targetGain = this.gateOpen ? 1.0 : 0.0;
    const attackStep = 1 - Math.exp(-1 / (sampleRate * 0.004));
    const releaseStep = 1 - Math.exp(-1 / (sampleRate * 0.042));

    let postSumSq = 0;
    for (let i = 0; i < len; i++) {
      const coeff = targetGain > this.gateEnvelope ? attackStep : releaseStep;
      this.gateEnvelope += (targetGain - this.gateEnvelope) * coeff;
      const sample = inCh[i] * this.gateEnvelope;
      // Limiter suave contra saturação
      const limited = sample > 0.96 ? 0.96 : sample < -0.96 ? -0.96 : sample;
      outCh[i] = limited;
      postSumSq += limited * limited;
    }
    const postGateRms = Math.sqrt(postSumSq / len);

    // Copia para canais extras se houver
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(outCh);
    }

    this.samplesSinceTelemetry += len;
    const gateChanged = this.gateOpen !== this.lastSentGateOpen;
    if (gateChanged || this.samplesSinceTelemetry >= Math.round(sampleRate * 0.06)) {
      this.samplesSinceTelemetry = 0;
      this.lastSentGateOpen = this.gateOpen;
      this.port.postMessage({
        preGateRms: rms,
        postGateRms,
        gateOpen: this.gateOpen,
        noiseFloor: this.noiseFloor,
      });
    }

    return true;
  }
}

registerProcessor('${WORKLET_PROCESSOR_NAME}', ReiVoiceGateProcessor);
`;

export async function createVoiceAudioProcessor(
  rawStream: MediaStream,
  initialParams: VoiceProcessorParams,
  onTelemetry: (telemetry: VoiceProcessorTelemetry) => void
): Promise<VoiceAudioProcessorHandle> {
  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;

  if (!AudioCtx) {
    return {
      outputStream: rawStream,
      analyserNode: null,
      mode: 'passthrough',
      updateParams: () => {},
      resume: async () => {},
      dispose: () => {},
    };
  }

  let ctx: AudioContext | null = null;
  let blobUrl: string | null = null;
  let params: VoiceProcessorParams = { ...initialParams };
  let disposed = false;

  try {
    ctx = new AudioCtx({ latencyHint: 'interactive', sampleRate: 48000 });
  } catch {
    ctx = new AudioCtx({ latencyHint: 'interactive' });
  }

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }

  const source = ctx.createMediaStreamSource(rawStream);

  // ============================================================================
  // ESTÁGIO 1: FILTRAGEM DE FREQUÊNCIAS VOCAIS HUMANAS (165 Hz – 3400 Hz)
  // High-Pass 4ª ordem (-24 dB/oct): remove vento, ventoinha, trânsito e grave das colunas
  // ============================================================================
  const highpassStage1 = ctx.createBiquadFilter();
  highpassStage1.type = 'highpass';
  highpassStage1.frequency.value = 165;
  highpassStage1.Q.value = 0.707;

  const highpassStage2 = ctx.createBiquadFilter();
  highpassStage2.type = 'highpass';
  highpassStage2.frequency.value = 165;
  highpassStage2.Q.value = 0.707;

  // Low-Pass 4ª ordem (-24 dB/oct): corta chiado agudo, teclas e interferências acima da voz
  const lowpassStage1 = ctx.createBiquadFilter();
  lowpassStage1.type = 'lowpass';
  lowpassStage1.frequency.value = 3450;
  lowpassStage1.Q.value = 0.707;

  const lowpassStage2 = ctx.createBiquadFilter();
  lowpassStage2.type = 'lowpass';
  lowpassStage2.frequency.value = 3450;
  lowpassStage2.Q.value = 0.707;

  // Realce suave de presença vocal (1.85 kHz) para voz próxima clara e nítida
  const presenceFilter = ctx.createBiquadFilter();
  presenceFilter.type = 'peaking';
  presenceFilter.frequency.value = 1850;
  presenceFilter.Q.value = 0.9;
  presenceFilter.gain.value = 2.2;

  // AnalyserNode ligado estritamente APÓS High-Pass (165Hz) + Low-Pass + Noise Gate
  const postGateAnalyser = ctx.createAnalyser();
  postGateAnalyser.fftSize = 256;
  postGateAnalyser.smoothingTimeConstant = 0.72;
  postGateAnalyser.minDecibels = -75;
  postGateAnalyser.maxDecibels = -12;

  // Compressor pós-gate (nunca amplifica ruído porque vem DEPOIS do Noise Gate)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.14;

  const dest = ctx.createMediaStreamDestination();
  // Mantém o grafo AudioWorklet / MediaStreamDestination ativo em Safari/iOS/Chromium móveis sem emitir som local
  const silentKeepAlive = ctx.createGain();
  silentKeepAlive.gain.value = 0;

  source.connect(highpassStage1);
  highpassStage1.connect(highpassStage2);
  highpassStage2.connect(lowpassStage1);
  lowpassStage1.connect(lowpassStage2);
  lowpassStage2.connect(presenceFilter);

  const ensureCtxRunning = async () => {
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  };

  // ============================================================================
  // ESTÁGIO 2: PROCESSADOR NOISE GATE + ANTI-ECO EM TEMPO REAL (AudioWorklet)
  // ============================================================================
  if (typeof AudioWorkletNode !== 'undefined' && ctx.audioWorklet) {
    try {
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      blobUrl = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(blobUrl);

      if (disposed) {
        URL.revokeObjectURL(blobUrl);
        ctx.close().catch(() => {});
        return {
          outputStream: rawStream,
          analyserNode: null,
          mode: 'passthrough',
          updateParams: () => {},
          resume: async () => {},
          dispose: () => {},
        };
      }

      const workletNode = new AudioWorkletNode(ctx, WORKLET_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      });

      const pushWorkletParams = () => {
        workletNode.port.postMessage({
          micMuted: params.micMuted,
          deafened: params.deafened,
          strictMode: params.noiseGateMode === 'strict',
          hasHeadset: params.hasHeadset,
          remoteSpeaking: params.remoteSpeaking,
        });
      };

      pushWorkletParams();

      workletNode.port.onmessage = (event) => {
        if (disposed) return;
        const data = event.data as VoiceProcessorTelemetry | undefined;
        if (data && typeof data.postGateRms === 'number') {
          onTelemetry(data);
        }
      };

      presenceFilter.connect(workletNode);
      workletNode.connect(postGateAnalyser);
      postGateAnalyser.connect(compressor);
      compressor.connect(dest);
      compressor.connect(silentKeepAlive);
      silentKeepAlive.connect(ctx.destination);

      return {
        outputStream: dest.stream,
        analyserNode: postGateAnalyser,
        mode: 'audioworklet',
        updateParams: (next) => {
          params = { ...params, ...next };
          if (!disposed) {
            pushWorkletParams();
            if (params.micMuted === false) {
              void ensureCtxRunning();
            }
          }
        },
        resume: ensureCtxRunning,
        dispose: () => {
          disposed = true;
          try {
            workletNode.port.onmessage = null;
            source.disconnect();
            highpassStage1.disconnect();
            highpassStage2.disconnect();
            lowpassStage1.disconnect();
            lowpassStage2.disconnect();
            presenceFilter.disconnect();
            workletNode.disconnect();
            postGateAnalyser.disconnect();
            compressor.disconnect();
            silentKeepAlive.disconnect();
            dest.disconnect();
          } catch {
            // noop
          }
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            blobUrl = null;
          }
          ctx?.close().catch(() => {});
          ctx = null;
        },
      };
    } catch {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    }
  }

  // ============================================================================
  // FALLBACK AUTOMÁTICO: ScriptProcessorNode (mesmo DSP se AudioWorklet falhar)
  // ============================================================================
  try {
    const bufferSize = 512;
    const scriptNode = ctx.createScriptProcessor(bufferSize, 1, 1);
    let gateEnvelope = 0;
    let gateOpen = false;
    let holdSamplesRemaining = 0;
    let noiseFloor = 0.004;
    let lastSentGateOpen = false;
    let lastTelemetryTime = 0;
    const sampleRateVal = ctx.sampleRate || 48000;

    scriptNode.onaudioprocess = (audioEvent) => {
      if (disposed) return;
      const inCh = audioEvent.inputBuffer.getChannelData(0);
      const outCh = audioEvent.outputBuffer.getChannelData(0);
      const len = inCh.length;

      if (params.micMuted) {
        gateOpen = false;
        holdSamplesRemaining = 0;
        gateEnvelope = 0;
        outCh.fill(0);
        if (lastSentGateOpen) {
          lastSentGateOpen = false;
          onTelemetry({ preGateRms: 0, postGateRms: 0, gateOpen: false, noiseFloor });
        }
        return;
      }

      let sumSq = 0;
      for (let i = 0; i < len; i++) {
        sumSq += inCh[i] * inCh[i];
      }
      const rms = Math.sqrt(sumSq / len);

      const strictMode = params.noiseGateMode === 'strict';
      const baseThreshold = strictMode ? 0.011 : 0.0055;
      const floorMult = strictMode ? 2.4 : 1.9;
      const echoGuardActive = !params.hasHeadset && params.remoteSpeaking && !params.deafened;
      const echoGuardBoost = echoGuardActive ? 0.008 : 0;

      const openThreshold = Math.max(baseThreshold, noiseFloor * floorMult) + echoGuardBoost;
      const closeThreshold = openThreshold * 0.58;
      const holdSamples = Math.round(sampleRateVal * (strictMode ? 0.24 : 0.32));

      if (!gateOpen && rms < openThreshold * 0.9) {
        const adaptRate = rms < noiseFloor ? 0.08 : 0.015;
        noiseFloor = Math.min(0.012, Math.max(0.0008, noiseFloor * (1 - adaptRate) + rms * adaptRate));
      }

      if (rms >= openThreshold) {
        gateOpen = true;
        holdSamplesRemaining = holdSamples;
      } else if (gateOpen) {
        if (rms >= closeThreshold) {
          holdSamplesRemaining = Math.max(holdSamplesRemaining, Math.round(holdSamples * 0.5));
        } else if (holdSamplesRemaining > 0) {
          holdSamplesRemaining -= len;
        } else {
          gateOpen = false;
        }
      }

      const targetGain = gateOpen ? 1.0 : 0.0;
      const attackStep = 1 - Math.exp(-1 / (sampleRateVal * 0.004));
      const releaseStep = 1 - Math.exp(-1 / (sampleRateVal * 0.042));

      let postSumSq = 0;
      for (let i = 0; i < len; i++) {
        const coeff = targetGain > gateEnvelope ? attackStep : releaseStep;
        gateEnvelope += (targetGain - gateEnvelope) * coeff;
        const sample = inCh[i] * gateEnvelope;
        const limited = sample > 0.96 ? 0.96 : sample < -0.96 ? -0.96 : sample;
        outCh[i] = limited;
        postSumSq += limited * limited;
      }
      const postGateRms = Math.sqrt(postSumSq / len);

      const now = performance.now();
      if (gateOpen !== lastSentGateOpen || now - lastTelemetryTime >= 60) {
        lastSentGateOpen = gateOpen;
        lastTelemetryTime = now;
        onTelemetry({ preGateRms: rms, postGateRms, gateOpen, noiseFloor });
      }
    };

    presenceFilter.connect(scriptNode);
    scriptNode.connect(postGateAnalyser);
    postGateAnalyser.connect(compressor);
    compressor.connect(dest);
    compressor.connect(silentKeepAlive);
    silentKeepAlive.connect(ctx.destination);

    return {
      outputStream: dest.stream,
      analyserNode: postGateAnalyser,
      mode: 'scriptprocessor',
      updateParams: (next) => {
        params = { ...params, ...next };
        if (!disposed && params.micMuted === false) {
          void ensureCtxRunning();
        }
      },
      resume: ensureCtxRunning,
      dispose: () => {
        disposed = true;
        try {
          scriptNode.onaudioprocess = null;
          source.disconnect();
          highpassStage1.disconnect();
          highpassStage2.disconnect();
          lowpassStage1.disconnect();
          lowpassStage2.disconnect();
          presenceFilter.disconnect();
          scriptNode.disconnect();
          postGateAnalyser.disconnect();
          compressor.disconnect();
          silentKeepAlive.disconnect();
          dest.disconnect();
        } catch {
          // noop
        }
        ctx?.close().catch(() => {});
        ctx = null;
      },
    };
  } catch {
    ctx.close().catch(() => {});
    return {
      outputStream: rawStream,
      analyserNode: null,
      mode: 'passthrough',
      updateParams: () => {},
      resume: async () => {},
      dispose: () => {},
    };
  }
}
