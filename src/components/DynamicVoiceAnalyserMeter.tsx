import React, { useEffect, useRef } from 'react';

export interface DynamicVoiceMeterLabels {
  meterTitle: string;
  meterAria: string;
  stateMuted: string;
  stateVoice: string;
  stateSuppressed: string;
  stateClean: string;
}

interface DynamicVoiceAnalyserMeterProps {
  analyserNode: AnalyserNode | null;
  isMuted: boolean;
  isSpeaking: boolean;
  isNoiseSuppressed: boolean;
  fallbackLevel: number;
  preGateLevel: number;
  compact?: boolean;
  labels: DynamicVoiceMeterLabels;
}

export const DynamicVoiceAnalyserMeter: React.FC<DynamicVoiceAnalyserMeterProps> = ({
  analyserNode,
  isMuted,
  isSpeaking,
  isNoiseSuppressed,
  fallbackLevel,
  preGateLevel,
  compact = false,
  labels,
}) => {
  const barCount = compact ? 14 : 18;
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fillBarRef = useRef<HTMLDivElement | null>(null);
  const peakMarkerRef = useRef<HTMLDivElement | null>(null);
  const percentTextRef = useRef<HTMLSpanElement | null>(null);
  const meterBoxRef = useRef<HTMLDivElement | null>(null);

  const fallbackRef = useRef(fallbackLevel);
  fallbackRef.current = fallbackLevel;

  useEffect(() => {
    const resetBars = () => {
      for (let i = 0; i < barCount; i++) {
        const el = barRefs.current[i];
        if (el) {
          el.style.height = '14%';
          el.style.opacity = '0.28';
          el.style.backgroundColor = 'rgb(39, 39, 42)';
          el.style.boxShadow = 'none';
        }
      }
      if (fillBarRef.current) {
        fillBarRef.current.style.width = '0%';
      }
      if (peakMarkerRef.current) {
        peakMarkerRef.current.style.left = '0%';
        peakMarkerRef.current.style.opacity = '0';
      }
      if (percentTextRef.current) {
        percentTextRef.current.textContent = '0%';
      }
      if (meterBoxRef.current) {
        meterBoxRef.current.setAttribute('aria-valuenow', '0');
      }
    };

    if (isMuted) {
      resetBars();
      return undefined;
    }

    if (!analyserNode) {
      const pct = Math.round(Math.max(0, Math.min(1, fallbackLevel)) * 100);
      const litBars = Math.round((pct / 100) * barCount);
      for (let i = 0; i < barCount; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        const active = i < litBars;
        el.style.height = active ? `${Math.min(100, 35 + ((i + 1) / barCount) * 65)}%` : '14%';
        el.style.opacity = active ? '1' : '0.28';
        el.style.backgroundColor = active ? 'rgb(52, 211, 153)' : 'rgb(39, 39, 42)';
        el.style.boxShadow = active ? '0 0 6px rgba(52,211,153,0.4)' : 'none';
      }
      if (fillBarRef.current) fillBarRef.current.style.width = `${pct}%`;
      if (percentTextRef.current) percentTextRef.current.textContent = `${pct}%`;
      if (meterBoxRef.current) meterBoxRef.current.setAttribute('aria-valuenow', String(pct));
      return undefined;
    }

    const freqBuf = new Uint8Array(analyserNode.frequencyBinCount);
    const timeBuf = new Float32Array(analyserNode.fftSize);
    let rafId = 0;
    let smoothedLevel = 0;
    let peakHold = 0;
    let peakHoldUntil = 0;
    let lastTextUpdate = 0;

    const renderFrame = (now: number) => {
      analyserNode.getByteFrequencyData(freqBuf);
      analyserNode.getFloatTimeDomainData(timeBuf);

      // RMS pós High-Pass & Noise Gate diretamente do AnalyserNode
      let sumSq = 0;
      for (let i = 0; i < timeBuf.length; i++) {
        const s = timeBuf[i];
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / timeBuf.length);
      const instantLevel =
        rms < 0.0012
          ? 0
          : Math.min(1, Math.max(fallbackRef.current * 0.65, Math.pow(rms * 7.6, 0.72)));

      smoothedLevel =
        instantLevel > smoothedLevel
          ? smoothedLevel * 0.45 + instantLevel * 0.55
          : smoothedLevel * 0.8 + instantLevel * 0.2;
      if (smoothedLevel < 0.01) smoothedLevel = 0;

      if (smoothedLevel >= peakHold) {
        peakHold = smoothedLevel;
        peakHoldUntil = now + 520;
      } else if (now > peakHoldUntil) {
        peakHold = Math.max(0, peakHold - 0.025);
      }

      // Bins 1..18 correspondem a ~187Hz..3375Hz (faixa exata pós High-Pass/Low-Pass)
      for (let i = 0; i < barCount; i++) {
        const el = barRefs.current[i];
        if (!el) continue;

        const binIdx = Math.min(freqBuf.length - 1, i + 1);
        const binNorm = freqBuf[binIdx] / 255;
        const barEnergy =
          smoothedLevel <= 0.01
            ? 0
            : Math.min(1, Math.max(binNorm * 0.72 + smoothedLevel * 0.45, smoothedLevel * 0.5));

        const heightPct = Math.max(14, Math.round(barEnergy * 100));
        el.style.height = `${heightPct}%`;

        if (barEnergy < 0.06) {
          el.style.opacity = '0.28';
          el.style.backgroundColor = 'rgb(39, 39, 42)';
          el.style.boxShadow = 'none';
        } else if (barEnergy > 0.82) {
          el.style.opacity = '1';
          el.style.backgroundColor = 'rgb(251, 113, 133)';
          el.style.boxShadow = '0 0 7px rgba(251,113,133,0.55)';
        } else if (barEnergy > 0.58) {
          el.style.opacity = '1';
          el.style.backgroundColor = 'rgb(251, 191, 36)';
          el.style.boxShadow = '0 0 6px rgba(251,191,36,0.45)';
        } else {
          el.style.opacity = '1';
          el.style.backgroundColor = 'rgb(52, 211, 153)';
          el.style.boxShadow = '0 0 6px rgba(52,211,153,0.45)';
        }
      }

      const pct = Math.round(smoothedLevel * 100);
      const peakPct = Math.round(peakHold * 100);

      if (fillBarRef.current) {
        fillBarRef.current.style.width = `${pct}%`;
      }
      if (peakMarkerRef.current) {
        peakMarkerRef.current.style.left = `${Math.min(98, peakPct)}%`;
        peakMarkerRef.current.style.opacity = peakPct > 3 ? '0.9' : '0';
      }

      if (now - lastTextUpdate > 65) {
        lastTextUpdate = now;
        if (percentTextRef.current) {
          percentTextRef.current.textContent = `${pct}%`;
        }
        if (meterBoxRef.current) {
          meterBoxRef.current.setAttribute('aria-valuenow', String(pct));
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [analyserNode, barCount, fallbackLevel, isMuted]);

  const statusBadge = isMuted
    ? { label: labels.stateMuted, tone: 'text-rose-300 border-rose-500/50 bg-rose-950/60' }
    : isSpeaking
    ? { label: labels.stateVoice, tone: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60' }
    : isNoiseSuppressed
    ? { label: labels.stateSuppressed, tone: 'text-amber-300 border-amber-500/45 bg-amber-950/55' }
    : { label: labels.stateClean, tone: 'text-zinc-300 border-zinc-700/80 bg-zinc-900/80' };

  const ambientPercent = Math.round(Math.max(0, Math.min(1, preGateLevel)) * 100);

  return (
    <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{!isMuted ? '🎙️' : '🔇'}</span>
          <span className="text-zinc-400 font-bold truncate">{labels.meterTitle}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${statusBadge.tone}`}>
            {statusBadge.label}
          </span>
          <span
            ref={percentTextRef}
            className="text-[10px] tabular-nums text-zinc-300 font-bold w-8 text-right"
          >
            0%
          </span>
        </div>
      </div>

      <div
        ref={meterBoxRef}
        role="meter"
        aria-label={labels.meterAria}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        className="relative flex flex-col gap-1 bg-zinc-950/90 border border-zinc-800/90 rounded-lg p-1.5"
      >
        {/* Barras espectrais em tempo real lidas diretamente do Web Audio AnalyserNode */}
        <div
          className={`flex items-end gap-0.5 ${compact ? 'h-4' : 'h-6'}`}
          aria-hidden="true"
        >
          {Array.from({ length: barCount }).map((_, idx) => (
            <div key={idx} className="flex-1 h-full flex items-end">
              <div
                ref={(el) => {
                  barRefs.current[idx] = el;
                }}
                className="w-full rounded-xs transition-[height,background-color] duration-75"
                style={{ height: '14%', opacity: 0.28, backgroundColor: 'rgb(39, 39, 42)' }}
              />
            </div>
          ))}
        </div>

        {/* Barra contínua de nível + pico pós-filtro */}
        <div className="relative h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
          <div
            ref={fillBarRef}
            className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 rounded-full transition-[width] duration-75"
            style={{ width: '0%' }}
          />
          <div
            ref={peakMarkerRef}
            className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full"
            style={{ left: '0%', opacity: 0 }}
          />
        </div>

        {/* Linha fina inferior mostra ruído bruto captado antes do Noise Gate enquanto a saída acima fica limpa */}
        {!isMuted && (
          <div className="h-[2px] w-full bg-zinc-900/90 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                isSpeaking ? 'bg-emerald-400/50' : 'bg-amber-400/45'
              }`}
              style={{ width: `${ambientPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
