import React, { useMemo, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Radio,
  Users,
  Lock,
  Globe,
  ChevronDown,
  ChevronUp,
  Headphones,
  ShieldCheck,
  AlertTriangle,
  History,
  Trash2,
  Clock,
} from 'lucide-react';
import { useVoiceChat, type VoiceActivitySessionLog } from '../contexts/VoiceChatContext';
import { useI18n } from '../contexts/I18nContext';
import { AvatarDoll } from './AvatarDoll';
import { DynamicVoiceAnalyserMeter } from './DynamicVoiceAnalyserMeter';
import type { TelemetryAnomalyReason, TelemetryInvestigationEntry } from '../types/game';

interface VoiceChatPanelProps {
  variant: 'lobby' | 'compact';
  roomCode: string;
}

export const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({ variant, roomCode }) => {
  const { t, lang } = useI18n();
  const {
    isSupported,
    isOnline,
    isJoined,
    isConnecting,
    connectionState,
    channelMode,
    activeRoomKey,
    peers,
    isMicMuted,
    isDeafened,
    isLocalSpeaking,
    localMicLevel,
    preGateMicLevel,
    isNoiseSuppressed,
    analyserNode,
    mutedPeerIds,
    errorMsg,
    noiseGateMode,
    hasHeadset,
    investigatingCompetitors,
    voiceSessionHistory,
    currentVoiceActivity,
    setNoiseGateMode,
    joinVoice,
    leaveVoice,
    toggleMic,
    muteMicrophone,
    toggleDeafen,
    switchChannelMode,
    toggleMutePeer,
    clearVoiceHistory,
  } = useVoiceChat();

  const [expandedPeers, setExpandedPeers] = useState(false);
  const [showVoiceHistory, setShowVoiceHistory] = useState(false);

  const audioUiLabels = useMemo(() => {
    const code = (lang || 'pt').slice(0, 2);
    if (code === 'en') {
      return {
        headsetDetected: 'Headset connected · Near-field voice only',
        headsetAdvice: 'Use earphones for 0 echo · Ambient noise filter active',
        strictModeBtn: 'Near Voice Only',
        balancedModeBtn: 'Balanced',
        meterTitle: 'Post-Filter Voice Output',
        meterAria: 'Microphone level after High-Pass and Noise Gate',
        stateMuted: 'Mic Off',
        stateVoice: 'Voice Active',
        stateSuppressed: 'Noise Blocked',
        stateClean: 'Clean Silence',
        muteMicBtn: 'Mute Microphone',
        muteMicShort: 'Mute',
        mutedBadge: 'Muted',
        unmuteMicBtn: 'Unmute',
        mutedBanner: 'Microphone muted · Audio stream cut',
        investigatingBadge: 'INVESTIGATING',
        investigatingTitle: 'Anomalous movement detected',
        reasonSpeed: 'Impossible speed',
        reasonLane: 'Rapid lane switching',
        reasonTeleport: 'Position jump',
        historyBtn: 'Voice Stats',
        historyTitle: 'Speaking Activity Log (IndexedDB)',
        historyEmpty: 'No past race voice sessions logged yet.',
        historyClear: 'Clear',
        historySessions: 'Sessions',
        historySpeakingTime: 'Speaking Time',
        historyFrequency: 'Frequency',
        historyBurstsUnit: 'turns',
        historyPerMin: '/min',
        historyRoundLabel: 'Round',
        historyLobbyLabel: 'Lobby',
        historyLiveTag: 'LIVE',
      };
    }
    if (code === 'es') {
      return {
        headsetDetected: 'Auriculares detectados · Solo voz de cerca',
        headsetAdvice: 'Usa auriculares para 0 eco · Filtro ambiental activo',
        strictModeBtn: 'Solo Voz Cerca',
        balancedModeBtn: 'Normal',
        meterTitle: 'Salida Vocal Filtrada',
        meterAria: 'Nivel tras filtro High-Pass y Noise Gate',
        stateMuted: 'Mic Off',
        stateVoice: 'Voz Activa',
        stateSuppressed: 'Ruido Bloqueado',
        stateClean: 'Silencio Limpio',
        muteMicBtn: 'Silenciar Micrófono',
        muteMicShort: 'Silenciar',
        mutedBadge: 'Silenciado',
        unmuteMicBtn: 'Activar',
        mutedBanner: 'Micrófono silenciado · Flujo de audio cortado',
        investigatingBadge: 'INVESTIGANDO',
        investigatingTitle: 'Movimiento anómalo detectado',
        reasonSpeed: 'Velocidad imposible',
        reasonLane: 'Cambio rápido de carril',
        reasonTeleport: 'Salto de posición',
        historyBtn: 'Historial Voz',
        historyTitle: 'Actividad Vocal por Sesión (IndexedDB)',
        historyEmpty: 'Aún no hay sesiones de voz registradas.',
        historyClear: 'Limpiar',
        historySessions: 'Sesiones',
        historySpeakingTime: 'Tiempo Hablado',
        historyFrequency: 'Frecuencia',
        historyBurstsUnit: 'turnos',
        historyPerMin: '/min',
        historyRoundLabel: 'Ronda',
        historyLobbyLabel: 'Sala',
        historyLiveTag: 'VIVO',
      };
    }
    if (code === 'fr') {
      return {
        headsetDetected: 'Écouteurs détectés · Voix proche uniquement',
        headsetAdvice: 'Utilisez des écouteurs (0 écho) · Filtre bruit actif',
        strictModeBtn: 'Voix Proche',
        balancedModeBtn: 'Normal',
        meterTitle: 'Sortie Vocale Filtrée',
        meterAria: 'Niveau après filtre passe-haut et Noise Gate',
        stateMuted: 'Micro Off',
        stateVoice: 'Voix Active',
        stateSuppressed: 'Bruit Bloqué',
        stateClean: 'Silence Propre',
        muteMicBtn: 'Couper le Micro',
        muteMicShort: 'Couper',
        mutedBadge: 'Coupé',
        unmuteMicBtn: 'Activer',
        mutedBanner: 'Micro coupé · Flux audio interrompu',
        investigatingBadge: 'ENQUÊTE',
        investigatingTitle: 'Mouvement anormal détecté',
        reasonSpeed: 'Vitesse impossible',
        reasonLane: 'Changements de voie rapides',
        reasonTeleport: 'Téléportation',
        historyBtn: 'Stats Voix',
        historyTitle: 'Activité Vocale par Session (IndexedDB)',
        historyEmpty: 'Aucune session vocale enregistrée.',
        historyClear: 'Effacer',
        historySessions: 'Sessions',
        historySpeakingTime: 'Temps de Parole',
        historyFrequency: 'Fréquence',
        historyBurstsUnit: 'tours',
        historyPerMin: '/min',
        historyRoundLabel: 'Manche',
        historyLobbyLabel: 'Salon',
        historyLiveTag: 'DIRECT',
      };
    }
    return {
      headsetDetected: 'Auriculares ligados · Só voz de perto (0 eco)',
      headsetAdvice: 'Use auriculares para captar só voz de perto e evitar eco',
      strictModeBtn: 'Só Voz de Perto',
      balancedModeBtn: 'Normal',
      meterTitle: 'Saída Pós High-Pass & Noise Gate',
      meterAria: 'Nível de áudio após filtro High-Pass e Noise Gate',
      stateMuted: 'Mic Off',
      stateVoice: 'Voz Ativa',
      stateSuppressed: 'Ruído Bloqueado',
      stateClean: 'Silêncio Limpo',
      muteMicBtn: 'Silenciar Microfone',
      muteMicShort: 'Silenciar',
      mutedBadge: 'Silenciado',
      unmuteMicBtn: 'Ativar',
      mutedBanner: 'Microfone silenciado · Fluxo de áudio cortado',
      investigatingBadge: 'A INVESTIGAR',
      investigatingTitle: 'Movimento anómalo detetado',
      reasonSpeed: 'Velocidade impossível',
      reasonLane: 'Troca excessiva de faixas',
      reasonTeleport: 'Salto de posição',
      historyBtn: 'Registo Voz',
      historyTitle: 'Atividade de Voz nas Corridas (IndexedDB)',
      historyEmpty: 'Ainda não há sessões de voz registadas.',
      historyClear: 'Limpar',
      historySessions: 'Sessões',
      historySpeakingTime: 'Tempo a Falar',
      historyFrequency: 'Frequência',
      historyBurstsUnit: 'vezes',
      historyPerMin: '/min',
      historyRoundLabel: 'Corrida',
      historyLobbyLabel: 'Sala',
      historyLiveTag: 'ATIVO',
    };
  }, [lang]);

  const investigationList = useMemo(
    () =>
      (Object.values(investigatingCompetitors) as TelemetryInvestigationEntry[]).filter(
        (entry) => entry.sessionStatus === 'investigating'
      ),
    [investigatingCompetitors]
  );

  const formatAnomalyReason = (reason: TelemetryAnomalyReason): string => {
    if (reason === 'impossible-speed') return audioUiLabels.reasonSpeed;
    if (reason === 'lane-switch-flood') return audioUiLabels.reasonLane;
    return audioUiLabels.reasonTeleport;
  };

  const mergedVoiceSessions = useMemo(() => {
    const byId = new Map<string, VoiceActivitySessionLog>();
    if (currentVoiceActivity) {
      byId.set(currentVoiceActivity.id, currentVoiceActivity);
    }
    for (const item of voiceSessionHistory) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.startedAt - a.startedAt);
  }, [currentVoiceActivity, voiceSessionHistory]);

  const voiceHistoryTotals = useMemo(() => {
    let totalSpeakingMs = 0;
    let totalConnectedMs = 0;
    let totalBursts = 0;
    for (const session of mergedVoiceSessions) {
      totalSpeakingMs += session.speakingDurationMs;
      totalConnectedMs += session.activeVoiceConnectedMs;
      totalBursts += session.speakingBurstCount;
    }
    const burstsPerMin =
      totalConnectedMs >= 15000
        ? Number(((totalBursts * 60000) / totalConnectedMs).toFixed(1))
        : totalBursts;
    return {
      sessionCount: mergedVoiceSessions.length,
      totalSpeakingMs,
      totalBursts,
      burstsPerMin,
    };
  }, [mergedVoiceSessions]);

  const formatDurationMs = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    if (ms > 0 && ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${secs}s`;
  };

  const formatBurstsPerMin = (session: VoiceActivitySessionLog): string => {
    if (session.activeVoiceConnectedMs < 15000) {
      return `${session.speakingBurstCount} ${audioUiLabels.historyBurstsUnit}`;
    }
    const rate = ((session.speakingBurstCount * 60000) / session.activeVoiceConnectedMs).toFixed(1);
    return `${session.speakingBurstCount} (${rate}${audioUiLabels.historyPerMin})`;
  };

  const renderVoiceHistoryDrawer = () => (
    <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2 text-[10px] font-mono">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-zinc-200 flex items-center gap-1.5">
          <Clock size={12} className="text-sky-400 shrink-0" />
          <span>{audioUiLabels.historyTitle}</span>
        </span>
        {voiceSessionHistory.length > 0 && (
          <button
            type="button"
            onClick={() => {
              void clearVoiceHistory();
            }}
            className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-rose-950/70 border border-zinc-700 hover:border-rose-500/50 text-zinc-400 hover:text-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 size={10} />
            <span>{audioUiLabels.historyClear}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="px-2 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <span className="text-[9px] text-zinc-400 block">{audioUiLabels.historySessions}</span>
          <span className="text-xs font-black text-zinc-100 tabular-nums">
            {voiceHistoryTotals.sessionCount}
          </span>
        </div>
        <div className="px-2 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <span className="text-[9px] text-zinc-400 block">{audioUiLabels.historySpeakingTime}</span>
          <span className="text-xs font-black text-emerald-300 tabular-nums">
            {formatDurationMs(voiceHistoryTotals.totalSpeakingMs)}
          </span>
        </div>
        <div className="px-2 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <span className="text-[9px] text-zinc-400 block">{audioUiLabels.historyFrequency}</span>
          <span className="text-xs font-black text-sky-300 tabular-nums">
            {voiceHistoryTotals.totalBursts} {audioUiLabels.historyBurstsUnit}
          </span>
        </div>
      </div>

      {mergedVoiceSessions.length === 0 ? (
        <p className="text-zinc-400 py-1">{audioUiLabels.historyEmpty}</p>
      ) : (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-0.5">
          {mergedVoiceSessions.slice(0, 12).map((session) => {
            const isLive = currentVoiceActivity?.id === session.id && session.endedAt === null;
            const speakRatioPct =
              session.activeVoiceConnectedMs > 0
                ? Math.min(
                    100,
                    Math.round((session.speakingDurationMs / session.activeVoiceConnectedMs) * 100)
                  )
                : 0;
            const timeStr = new Date(session.startedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={session.id}
                className={`px-2.5 py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                  isLive
                    ? 'bg-emerald-950/40 border-emerald-500/45 text-emerald-100'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold truncate">
                    {session.roomCode}{' '}
                    {session.raceRound > 0
                      ? `· ${audioUiLabels.historyRoundLabel} #${session.raceRound}`
                      : `· ${audioUiLabels.historyLobbyLabel}`}
                  </span>
                  {isLive && (
                    <span className="px-1 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[8px] font-black">
                      {audioUiLabels.historyLiveTag}
                    </span>
                  )}
                  <span className="text-[9px] text-zinc-500">{timeStr}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                  <span className="text-emerald-300 font-bold">
                    {formatDurationMs(session.speakingDurationMs)} ({speakRatioPct}%)
                  </span>
                  <span className="text-sky-300">{formatBurstsPerMin(session)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!isSupported) return null;

  const activeSpeaker = peers.find((p) => p.speaking && !p.muted && !mutedPeerIds.includes(p.peerId));
  const totalConnected = (isJoined ? 1 : 0) + peers.length;
  const isVoiceGateActive = isJoined && !isMicMuted && isLocalSpeaking;

  // ============================================================================
  // COMPACT RACE-TRACK BAR (Antes, Durante e Depois da Partida)
  // ============================================================================
  if (variant === 'compact') {
    return (
      <div
        className={`w-full max-w-[500px] mb-2 game-panel rounded-2xl px-3 py-2 flex flex-col gap-1.5 transition-[border-color,box-shadow,background-color] duration-200 ${
          isVoiceGateActive
            ? 'voice-speaking-glow border-emerald-400/80'
            : isJoined && isMicMuted
            ? 'border-rose-500/55 bg-rose-950/15'
            : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                !isJoined
                  ? 'bg-zinc-600'
                  : isMicMuted
                  ? 'bg-rose-500'
                  : connectionState === 'connected'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            <div className="flex items-center gap-1.5 min-w-0 text-xs font-mono">
              {channelMode === 'private' ? (
                <Lock size={12} className="text-amber-400 shrink-0" />
              ) : (
                <Globe size={12} className="text-sky-400 shrink-0" />
              )}
              <span className="font-bold text-zinc-200 truncate flex items-center gap-1.5">
                {!isJoined ? (
                  t.voice.compactIdleTitle
                ) : activeSpeaker ? (
                  <>
                    <AvatarDoll name={activeSpeaker.name} size={18} variant="bust" />
                    <span className="truncate">{activeSpeaker.name}</span>
                  </>
                ) : isLocalSpeaking ? (
                  t.voice.youSpeaking
                ) : channelMode === 'private' ? (
                  `${t.voice.privateShort} ${roomCode}`
                ) : (
                  `${t.voice.publicShort} (${totalConnected}/5)`
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isJoined ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowVoiceHistory((prev) => !prev)}
                  className={`px-2 py-1.5 min-h-[34px] rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    showVoiceHistory
                      ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                  title={audioUiLabels.historyTitle}
                >
                  <History size={12} />
                  {mergedVoiceSessions.length > 0 && (
                    <span className="tabular-nums">{mergedVoiceSessions.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => joinVoice({ mode: channelMode, withMic: false })}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-xl game-btn-secondary text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  title={t.voice.listenOnlyTip}
                >
                  <Volume2 size={13} className="text-emerald-400" />
                  <span>{t.voice.listenBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => joinVoice({ mode: channelMode, withMic: true })}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-xl game-btn-gold text-[11px] font-black flex items-center gap-1 cursor-pointer"
                  title={t.voice.joinSpeakTip}
                >
                  <Mic size={13} />
                  <span>{t.voice.speakBtn}</span>
                </button>
              </>
            ) : (
              <>
                {isMicMuted && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    className="px-2.5 py-1.5 min-h-[34px] rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer border bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/60 text-emerald-300 transition-colors"
                    title={t.voice.micUnmuteTip}
                  >
                    <Mic size={13} />
                    <span>{audioUiLabels.unmuteMicBtn}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={muteMicrophone}
                  disabled={isMicMuted}
                  aria-pressed={isMicMuted}
                  aria-label={audioUiLabels.muteMicBtn}
                  className={`px-2.5 py-1.5 min-h-[34px] rounded-xl text-[11px] font-black flex items-center gap-1 border transition-all ${
                    isMicMuted
                      ? 'bg-rose-600/90 border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.35)] cursor-default'
                      : 'bg-rose-500/15 hover:bg-rose-500/30 border-rose-500/60 text-rose-200 cursor-pointer'
                  }`}
                  title={audioUiLabels.muteMicBtn}
                >
                  <MicOff size={13} />
                  <span>
                    {isMicMuted ? audioUiLabels.mutedBadge : audioUiLabels.muteMicShort}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleDeafen}
                  className={`px-2 py-1.5 min-h-[34px] rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                    isDeafened
                      ? 'bg-rose-950/70 border-rose-500/60 text-rose-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title={isDeafened ? t.voice.unmuteAudioTip : t.voice.muteAudioTip}
                >
                  {isDeafened ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowVoiceHistory((prev) => !prev)}
                  className={`px-2 py-1.5 min-h-[34px] rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    showVoiceHistory
                      ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                  title={audioUiLabels.historyTitle}
                >
                  <History size={12} />
                </button>

                <button
                  type="button"
                  onClick={() => setExpandedPeers((prev) => !prev)}
                  className="px-2 py-1.5 min-h-[34px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                  title={t.voice.peersListTitle}
                >
                  <Users size={12} />
                  <span>{totalConnected}/5</span>
                  {expandedPeers ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                <button
                  type="button"
                  onClick={leaveVoice}
                  className="p-1.5 min-h-[34px] min-w-[34px] rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800 text-rose-300 flex items-center justify-center cursor-pointer"
                  title={t.voice.leaveBtn}
                >
                  <PhoneOff size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feedback visual claro quando o microfone está silenciado ou medidor em tempo real */}
        {isJoined && isMicMuted && (
          <div className="px-2.5 py-1 rounded-xl bg-rose-950/65 border border-rose-500/55 text-rose-200 text-[10px] font-mono font-bold flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate">
              <MicOff size={12} className="text-rose-400 shrink-0" />
              <span className="truncate">{audioUiLabels.mutedBanner}</span>
            </span>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-400/50 text-rose-100 shrink-0">
              {audioUiLabels.mutedBadge}
            </span>
          </div>
        )}

        {isJoined && !isMicMuted && (
          <div className="pt-1 border-t border-zinc-800/70">
            <DynamicVoiceAnalyserMeter
              analyserNode={analyserNode}
              isMuted={isMicMuted}
              isSpeaking={isLocalSpeaking}
              isNoiseSuppressed={isNoiseSuppressed}
              fallbackLevel={localMicLevel}
              preGateLevel={preGateMicLevel}
              compact
              labels={audioUiLabels}
            />
          </div>
        )}

        {/* Barra expandida discreta (canal privado/público, filtro só voz de perto, auriculares e peers) */}
        {isJoined && expandedPeers && (
          <div className="pt-1.5 border-t border-zinc-800/80 flex flex-col gap-1.5 text-[11px] font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => switchChannelMode('private')}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                    channelMode === 'private'
                      ? 'bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  🔒 {t.voice.privateTab}
                </button>
                <button
                  type="button"
                  onClick={() => switchChannelMode('public')}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                    channelMode === 'public'
                      ? 'bg-sky-500 text-zinc-950 border-sky-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  🌐 {t.voice.publicTab}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNoiseGateMode(noiseGateMode === 'strict' ? 'balanced' : 'strict')}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                  noiseGateMode === 'strict'
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                }`}
              >
                <ShieldCheck size={11} />
                <span>
                  {noiseGateMode === 'strict'
                    ? audioUiLabels.strictModeBtn
                    : audioUiLabels.balancedModeBtn}
                </span>
              </button>
            </div>

            <div
              className={`px-2 py-1 rounded-lg border text-[10px] flex items-center justify-between gap-1.5 ${
                hasHeadset
                  ? 'bg-emerald-950/45 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/35 text-amber-200'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Headphones size={12} className="shrink-0" />
                <span className="truncate">
                  {hasHeadset ? audioUiLabels.headsetDetected : audioUiLabels.headsetAdvice}
                </span>
              </span>
              <span className="text-[9px] text-zinc-500 shrink-0">{activeRoomKey}</span>
            </div>

            {peers.length === 0 ? (
              <span className="text-[10px] text-zinc-400">
                {isOnline ? t.voice.waitingPeers : t.voice.offlineNote}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {peers.map((p) => {
                  const isPeerMuted = mutedPeerIds.includes(p.peerId);
                  const isInvestigating =
                    investigatingCompetitors[p.peerId]?.sessionStatus === 'investigating';
                  return (
                    <button
                      key={p.peerId}
                      type="button"
                      onClick={() => toggleMutePeer(p.peerId)}
                      className={`px-2 py-1 rounded-lg border flex items-center gap-1 text-[10px] cursor-pointer ${
                        isInvestigating
                          ? 'bg-amber-950/75 border-amber-400 text-amber-200'
                          : isPeerMuted
                          ? 'bg-zinc-900 border-rose-500/40 text-zinc-500 line-through'
                          : p.speaking && !p.muted
                          ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                      }`}
                      title={isPeerMuted ? t.voice.unmutePeerTip : t.voice.mutePeerTip}
                    >
                      <AvatarDoll name={p.name} size={16} variant="bust" />
                      <span className="max-w-[85px] truncate">{p.name}</span>
                      {isInvestigating && (
                        <span className="px-1 py-0.2 rounded bg-amber-500/25 border border-amber-400/60 text-amber-200 text-[8px] font-black">
                          ⚠️ {audioUiLabels.investigatingBadge}
                        </span>
                      )}
                      <span>{isPeerMuted || p.muted ? '🔇' : p.speaking ? '🎙️' : '🔊'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {investigationList.length > 0 && (
          <div
            role="status"
            className="px-2.5 py-1.5 rounded-xl bg-amber-950/75 border border-amber-500/70 text-amber-200 text-[10px] font-mono flex flex-wrap items-center justify-between gap-1.5"
          >
            <span className="flex items-center gap-1.5 min-w-0 font-bold">
              <AlertTriangle size={12} className="text-amber-400 shrink-0" />
              <span className="truncate">
                {investigationList
                  .map((item) => `${item.competitorName} (${formatAnomalyReason(item.reason)})`)
                  .join(' · ')}
              </span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-amber-100 text-[9px] font-black uppercase tracking-wider shrink-0">
              {audioUiLabels.investigatingBadge}
            </span>
          </div>
        )}

        {showVoiceHistory && renderVoiceHistoryDrawer()}

        {errorMsg && <span className="text-[10px] font-mono text-amber-300">{errorMsg}</span>}
      </div>
    );
  }

  // ============================================================================
  // LOBBY ARENA CARD (Prioridade para Link/QR da Sala + Canal Aleatório)
  // ============================================================================
  return (
    <div
      className={`p-3.5 game-subplate rounded-2xl flex flex-col gap-3 transition-[border-color,box-shadow] duration-200 ${
        isVoiceGateActive
          ? 'voice-speaking-glow border-emerald-400/80'
          : isJoined && isMicMuted
          ? 'border-rose-500/55'
          : 'border-emerald-500/35'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Radio size={15} />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300 block">
              {t.voice.lobbyTitle}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 block">
              {isOnline ? t.voice.lobbyOnlineSub : t.voice.offlineNote}
            </span>
          </div>
        </div>

        {/* Prioridade Sala Link vs Aleatório */}
        <div className="flex items-center gap-1 game-panel rounded-xl p-0.5 text-[10px] font-mono">
          <button
            type="button"
            onClick={() => switchChannelMode('private')}
            className={`px-2 py-1 rounded-lg font-bold cursor-pointer flex items-center gap-1 transition-colors ${
              channelMode === 'private'
                ? 'bg-amber-500 text-zinc-950 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Lock size={11} />
            <span>{t.voice.privateTab}</span>
          </button>
          <button
            type="button"
            onClick={() => switchChannelMode('public')}
            className={`px-2 py-1 rounded-lg font-bold cursor-pointer flex items-center gap-1 transition-colors ${
              channelMode === 'public'
                ? 'bg-sky-500 text-zinc-950 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe size={11} />
            <span>{t.voice.publicTab}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowVoiceHistory((prev) => !prev)}
            className={`px-2 py-1 rounded-lg font-bold cursor-pointer flex items-center gap-1 transition-colors ${
              showVoiceHistory
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                : 'text-zinc-300 hover:text-white'
            }`}
            title={audioUiLabels.historyTitle}
          >
            <History size={11} />
            <span>{audioUiLabels.historyBtn}</span>
          </button>
        </div>
      </div>

      {/* Aviso de Auriculares + Filtro Anti-Ruído / Anti-Eco */}
      <div
        className={`px-2.5 py-2 rounded-xl border text-[10px] font-mono flex flex-wrap items-center justify-between gap-2 ${
          hasHeadset
            ? 'bg-emerald-950/45 border-emerald-500/45 text-emerald-200'
            : 'bg-amber-950/35 border-amber-500/35 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Headphones size={14} className="shrink-0" />
          <span className="truncate font-bold">
            {hasHeadset ? audioUiLabels.headsetDetected : audioUiLabels.headsetAdvice}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setNoiseGateMode(noiseGateMode === 'strict' ? 'balanced' : 'strict')}
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
            noiseGateMode === 'strict'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300'
          }`}
        >
          <ShieldCheck size={11} />
          <span>
            {noiseGateMode === 'strict'
              ? audioUiLabels.strictModeBtn
              : audioUiLabels.balancedModeBtn}
          </span>
        </button>
      </div>

      {/* Controlos Principais de Voz (Falar, Desligar Mic para só ouvir, Sair) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {!isJoined ? (
          <>
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => joinVoice({ mode: channelMode, withMic: true })}
              className="col-span-1 sm:col-span-2 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Mic size={14} />
              <span>{isConnecting ? '...' : t.voice.joinSpeakBtn}</span>
            </button>
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => joinVoice({ mode: channelMode, withMic: false })}
              className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              title={t.voice.listenOnlyTip}
            >
              <Volume2 size={14} className="text-amber-400" />
              <span>{t.voice.listenOnlyBtn}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={muteMicrophone}
              disabled={isMicMuted}
              aria-pressed={isMicMuted}
              aria-label={audioUiLabels.muteMicBtn}
              className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 border transition-all ${
                isMicMuted
                  ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.35)] cursor-default'
                  : 'bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border-rose-500/60 cursor-pointer'
              }`}
              title={audioUiLabels.muteMicBtn}
            >
              <MicOff size={14} />
              <span>{isMicMuted ? audioUiLabels.mutedBadge : audioUiLabels.muteMicBtn}</span>
            </button>

            <button
              type="button"
              onClick={toggleMic}
              className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                !isMicMuted
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-300'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
              }`}
            >
              <Mic size={14} />
              <span>{!isMicMuted ? t.voice.micActiveBtn : audioUiLabels.unmuteMicBtn}</span>
            </button>

            <button
              type="button"
              onClick={toggleDeafen}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                isDeafened
                  ? 'bg-rose-950/70 text-rose-300 border-rose-600'
                  : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{isDeafened ? t.voice.audioOffBtn : t.voice.audioOnBtn}</span>
            </button>

            <button
              type="button"
              onClick={leaveVoice}
              className="col-span-2 sm:col-span-3 py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <PhoneOff size={14} />
              <span>{t.voice.leaveBtn}</span>
            </button>
          </>
        )}
      </div>

      {/* Feedback visual dedicado quando o utilizador está silenciado */}
      {isJoined && isMicMuted && (
        <div className="px-3 py-2 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-[11px] font-mono font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <MicOff size={14} className="text-rose-400 shrink-0" />
            <span className="truncate">{audioUiLabels.mutedBanner}</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/50 text-[10px] uppercase tracking-wider text-rose-100 shrink-0">
            {audioUiLabels.mutedBadge}
          </span>
        </div>
      )}

      {/* Medidor pós High-Pass & Noise Gate + Lista de Jogadores Ligados na Voz */}
      {isJoined && (
        <div className="flex flex-col gap-2 pt-1.5 border-t border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <DynamicVoiceAnalyserMeter
                analyserNode={analyserNode}
                isMuted={isMicMuted}
                isSpeaking={isLocalSpeaking}
                isNoiseSuppressed={isNoiseSuppressed}
                fallbackLevel={localMicLevel}
                preGateLevel={preGateMicLevel}
                labels={audioUiLabels}
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums shrink-0 self-end pb-1">
              {totalConnected}/5
            </span>
          </div>

          {peers.length === 0 ? (
            <p className="text-[11px] font-mono text-zinc-400">
              {isOnline ? t.voice.waitingPeers : t.voice.offlineNote}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {peers.map((p) => {
                const isPeerMuted = mutedPeerIds.includes(p.peerId);
                const isInvestigating =
                  investigatingCompetitors[p.peerId]?.sessionStatus === 'investigating';
                return (
                  <div
                    key={p.peerId}
                    className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      isInvestigating
                        ? 'bg-amber-950/55 border-amber-400/75'
                        : p.speaking && !p.muted && !isPeerMuted
                        ? 'bg-emerald-950/50 border-emerald-400/70'
                        : 'bg-zinc-900/90 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AvatarDoll name={p.name} size={22} variant="bust" />
                      <span className="font-bold text-zinc-200 truncate text-[11px]">{p.name}</span>
                      {isInvestigating && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-amber-200 text-[9px] font-mono font-black shrink-0">
                          ⚠️ {audioUiLabels.investigatingBadge}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMutePeer(p.peerId)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer shrink-0 ${
                        isPeerMuted
                          ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                      title={isPeerMuted ? t.voice.unmutePeerTip : t.voice.mutePeerTip}
                    >
                      {isPeerMuted ? '🔇' : p.muted ? 'Mic Off' : p.speaking ? '🎙️' : '🔊'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {investigationList.length > 0 && (
        <div
          role="status"
          className="px-3 py-2 rounded-xl bg-amber-950/75 border border-amber-500/70 text-amber-200 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2 min-w-0 font-bold">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span className="truncate">
              {audioUiLabels.investigatingTitle}:{' '}
              {investigationList
                .map((item) => `${item.competitorName} (${formatAnomalyReason(item.reason)})`)
                .join(', ')}
            </span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/60 text-[10px] font-black uppercase tracking-wider text-amber-100 shrink-0">
            ⚠️ {audioUiLabels.investigatingBadge}
          </span>
        </div>
      )}

      {showVoiceHistory && renderVoiceHistoryDrawer()}

      {errorMsg && <span className="text-[11px] font-mono text-amber-300">{errorMsg}</span>}
    </div>
  );
};
