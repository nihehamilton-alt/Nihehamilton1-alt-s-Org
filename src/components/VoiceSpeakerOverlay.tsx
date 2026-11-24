import React, { useEffect, useMemo, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceChat } from '../contexts/VoiceChatContext';
import { useI18n } from '../contexts/I18nContext';
import type { GameStatus } from '../types/game';
import { AvatarDoll } from './AvatarDoll';

interface VoiceSpeakerOverlayProps {
  status: GameStatus;
  lobbyOpen: boolean;
}

const REMOTE_COLORS = [
  'rgb(56, 189, 248)',
  'rgb(251, 191, 36)',
  'rgb(167, 139, 250)',
  'rgb(244, 114, 182)',
];

export const VoiceSpeakerOverlay: React.FC<VoiceSpeakerOverlayProps> = ({ status, lobbyOpen }) => {
  const { lang } = useI18n();
  const {
    isSupported,
    isJoined,
    isMicMuted,
    isDeafened,
    isLocalSpeaking,
    localPlayerName,
    peers,
    mutedPeerIds,
    getSpeakerAudioSnapshot,
  } = useVoiceChat();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotFnRef = useRef(getSpeakerAudioSnapshot);
  snapshotFnRef.current = getSpeakerAudioSnapshot;

  const isRaceViewport = (status === 'running' || status === 'starting') && !lobbyOpen;

  const activeSpeaker = useMemo(() => {
    if (!isJoined) return null;
    const remoteIndex = peers.findIndex(
      (p) => p.speaking && !p.muted && !isDeafened && !mutedPeerIds.includes(p.peerId)
    );
    if (remoteIndex >= 0) {
      const p = peers[remoteIndex];
      return {
        id: p.peerId,
        name: p.name,
        isLocal: false,
        color: REMOTE_COLORS[remoteIndex % REMOTE_COLORS.length],
      };
    }
    if (!isMicMuted && isLocalSpeaking) {
      return {
        id: '__local__',
        name: localPlayerName || 'Você',
        isLocal: true,
        color: 'rgb(52, 211, 153)',
      };
    }
    return null;
  }, [isDeafened, isJoined, isLocalSpeaking, isMicMuted, localPlayerName, mutedPeerIds, peers]);

  const activeSpeakerRef = useRef(activeSpeaker);
  activeSpeakerRef.current = activeSpeaker;

  const labels = useMemo(() => {
    const code = (lang || 'pt').slice(0, 2);
    if (code === 'en') return { speaking: 'Speaking Live', you: 'You' };
    if (code === 'es') return { speaking: 'Hablando en vivo', you: 'Tú' };
    if (code === 'fr') return { speaking: 'Parle en direct', you: 'Vous' };
    return { speaking: 'A falar ao vivo', you: 'Você' };
  }, [lang]);

  useEffect(() => {
    if (!isRaceViewport || !activeSpeaker) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const width = 128;
    const height = 26;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    let freqBuf: Uint8Array<ArrayBuffer> = new Uint8Array(128);
    let timeBuf: Float32Array<ArrayBuffer> = new Float32Array(256);
    let rafId = 0;

    const draw = (now: number) => {
      const current = activeSpeakerRef.current;
      const snap = snapshotFnRef.current();
      const analyser = !current
        ? null
        : current.isLocal
        ? snap.localAnalyser
        : snap.peerAnalysers[current.id] || null;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const barCount = 16;
      const gap = 2;
      const barW = (width - gap * (barCount - 1)) / barCount;
      const color = current?.color || 'rgb(52, 211, 153)';

      if (analyser) {
        if (freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Uint8Array(analyser.frequencyBinCount);
        }
        if (timeBuf.length !== analyser.fftSize) {
          timeBuf = new Float32Array(analyser.fftSize);
        }
        analyser.getByteFrequencyData(freqBuf);
        analyser.getFloatTimeDomainData(timeBuf);

        // Dynamic frequency spectrum bars
        ctx.fillStyle = color;
        for (let i = 0; i < barCount; i++) {
          const binIdx = Math.min(freqBuf.length - 1, Math.floor((i + 1) * 1.15));
          const mag = freqBuf[binIdx] / 255;
          const barH = Math.max(3, mag * (height * 0.72));
          ctx.globalAlpha = 0.28 + mag * 0.42;
          ctx.fillRect(i * (barW + gap), height - barH, barW, barH);
        }

        // Live time/frequency waveform overlay
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const midY = height / 2;
        const pts = 32;
        for (let i = 0; i < pts; i++) {
          const t = i / (pts - 1);
          const x = t * width;
          const sIdx = Math.min(timeBuf.length - 1, Math.floor(t * (timeBuf.length - 1)));
          const amp = Math.max(-1, Math.min(1, timeBuf[sIdx] * 3.2));
          const y = midY + amp * Math.sin(t * Math.PI) * (height * 0.42);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        const level = current ? (current.isLocal ? snap.localLevel : snap.peerLevels[current.id] || 0.25) : 0;
        const phase = now * 0.01;
        ctx.fillStyle = color;
        for (let i = 0; i < barCount; i++) {
          const wave = 0.35 + 0.65 * Math.abs(Math.sin(phase + i * 0.45));
          const barH = Math.max(3, wave * Math.max(0.25, level) * (height * 0.78));
          ctx.globalAlpha = 0.7;
          ctx.fillRect(i * (barW + gap), height - barH, barW, barH);
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [activeSpeaker, isRaceViewport]);

  if (!isSupported || !isJoined || !isRaceViewport || !activeSpeaker) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 right-3 z-40 pointer-events-none select-none flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-zinc-950/88 backdrop-blur-md border border-emerald-400/55 shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
    >
      <div className="relative shrink-0">
        <AvatarDoll name={activeSpeaker.name} size={28} variant="bust" />
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-zinc-950 border border-emerald-400 flex items-center justify-center"
          style={{ color: activeSpeaker.color }}
        >
          {activeSpeaker.isLocal ? (
            isMicMuted ? (
              <MicOff size={8} className="text-rose-400" />
            ) : (
              <Mic size={8} />
            )
          ) : (
            <Volume2 size={8} />
          )}
        </span>
      </div>

      <div className="flex flex-col min-w-0 max-w-[115px]">
        <span className="text-[11px] font-black text-zinc-100 truncate">
          {activeSpeaker.isLocal ? `${activeSpeaker.name} (${labels.you})` : activeSpeaker.name}
        </span>
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300 truncate">
          {labels.speaking}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-[128px] h-[26px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 shrink-0"
      />
    </div>
  );
};
