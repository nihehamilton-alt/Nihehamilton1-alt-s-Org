import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Flame, Music, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { GameStatus, RoomDesyncAlert, TelemetryAnomalyReason, TimeMode, ViewMode } from '../types/game';
import { useI18n } from '../contexts/I18nContext';
import { TOTAL_GAME_TIME_SECONDS, HARD_MODE_START_SECONDS } from '../game/constants';
import { sounds } from '../audio/soundEffects';

interface GameHeaderProps {
  status: GameStatus;
  elapsedSeconds: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  bgmEnabled?: boolean;
  onToggleBgm?: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  onOpenProvablyFair: () => void;
  onOpenRules: () => void;
  coinsCollected: number;
  onResetBalance: () => void;
  isDemo: boolean;
  onToggleDemo: () => void;
  onOpenLobby: () => void;
  onOpenRanking: () => void;
  onOpenShop: () => void;
  onOpenAdmin: () => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  timeMode: TimeMode;
  onToggleTimeMode: () => void;
  rttMs?: number | null;
  serverConnected?: boolean;
  canSpectate?: boolean;
  isSpectating?: boolean;
  onSpectate?: () => void;
  onOpenSpectatorOverview?: () => void;
  top3Streak?: number;
  desyncAlerts?: RoomDesyncAlert[];
  onDismissDesyncAlert?: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  status,
  elapsedSeconds,
  soundEnabled,
  onToggleSound,
  bgmEnabled = true,
  onToggleBgm,
  volume,
  onVolumeChange,
  onOpenProvablyFair,
  onOpenRules,
  coinsCollected,
  onResetBalance,
  isDemo,
  onToggleDemo,
  onOpenLobby,
  onOpenRanking,
  onOpenShop,
  onOpenAdmin,
  viewMode,
  onToggleViewMode,
  timeMode,
  onToggleTimeMode,
  rttMs = null,
  serverConnected = false,
  canSpectate = false,
  isSpectating = false,
  onSpectate,
  onOpenSpectatorOverview,
  top3Streak = 0,
  desyncAlerts = [],
  onDismissDesyncAlert,
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = React.useState<boolean>(false);
  const volumePopoverRef = React.useRef<HTMLDivElement | null>(null);
  const prevStreakRef = React.useRef<number>(top3Streak);
  const [streakPulseKey, setStreakPulseKey] = React.useState<number>(0);
  const [newlyFilledIdx, setNewlyFilledIdx] = React.useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { t, lang, langMeta, currencyMeta, geoInfo, openModal } = useI18n();
  const remaining = Math.max(0, TOTAL_GAME_TIME_SECONDS - Math.floor(elapsedSeconds));
  const isHardMode = elapsedSeconds >= HARD_MODE_START_SECONDS;
  const langCode = (lang || 'pt').slice(0, 2);

  React.useEffect(() => {
    const prev = prevStreakRef.current;
    if (top3Streak > prev) {
      setStreakPulseKey((k) => k + 1);
      setNewlyFilledIdx(Math.min(4, Math.max(0, top3Streak - 1)));
      const clearTimer = setTimeout(() => {
        setNewlyFilledIdx(null);
      }, 1100);
      prevStreakRef.current = top3Streak;
      return () => clearTimeout(clearTimer);
    }
    prevStreakRef.current = top3Streak;
    return undefined;
  }, [top3Streak]);

  const STREAK_SEGMENTS = 5;
  const filledSegments = Math.max(0, Math.min(STREAK_SEGMENTS, top3Streak));
  const streakLabel =
    langCode === 'pt'
      ? 'Série Top 3'
      : langCode === 'es'
      ? 'Racha Top 3'
      : langCode === 'fr'
      ? 'Série Top 3'
      : 'Top 3 Streak';
  const streakTooltip =
    langCode === 'pt'
      ? `Série consecutiva no pódio (Top 3): ${top3Streak} corrida(s)`
      : langCode === 'es'
      ? `Racha consecutiva en el podio (Top 3): ${top3Streak} carrera(s)`
      : langCode === 'fr'
      ? `Série consécutive sur le podium (Top 3) : ${top3Streak} course(s)`
      : `Consecutive podium finishes (Top 3): ${top3Streak} race(s)`;
  const spectateLabel =
    langCode === 'pt'
      ? 'Assistir'
      : langCode === 'es'
      ? 'Espectador'
      : langCode === 'fr'
      ? 'Regarder'
      : 'Spectate';
  const spectatingActiveLabel =
    langCode === 'pt'
      ? 'A Assistir'
      : langCode === 'es'
      ? 'Observando'
      : langCode === 'fr'
      ? 'Spectateur'
      : 'Spectating';
  const spectateTooltip =
    langCode === 'pt'
      ? 'Assistir aos corredores ao vivo (Modo Fantasma)'
      : langCode === 'es'
      ? 'Ver corredores en vivo (Modo Espectador)'
      : langCode === 'fr'
      ? 'Regarder les coureurs en direct (Mode Spectateur)'
      : 'Watch live runners (Spectator Mode)';
  const overviewLabel =
    langCode === 'pt'
      ? 'Visão Geral'
      : langCode === 'es'
      ? 'Vista Espectador'
      : langCode === 'fr'
      ? 'Aperçu'
      : 'Overview';
  const overviewTooltip =
    langCode === 'pt'
      ? 'Abrir classificação, faixas e estado ao vivo dos corredores'
      : langCode === 'es'
      ? 'Abrir clasificación, carriles y estado en vivo'
      : langCode === 'fr'
      ? 'Ouvrir le classement, les voies et le statut en direct'
      : 'Open live leaderboard of runners, lanes, and status';
  const isSfxActive = soundEnabled && volume > 0;
  const sfxOnLabel =
    langCode === 'pt' ? 'Som On' : langCode === 'es' ? 'Sonido' : langCode === 'fr' ? 'Son On' : 'SFX On';
  const sfxMutedLabel =
    langCode === 'pt' ? 'Mudo' : langCode === 'es' ? 'Silencio' : langCode === 'fr' ? 'Muet' : 'Muted';
  const sfxToggleTooltip = isSfxActive
    ? langCode === 'pt'
      ? 'Efeitos sonoros ativos — clique para silenciar'
      : langCode === 'es'
      ? 'Efectos de sonido activos — clic para silenciar'
      : langCode === 'fr'
      ? 'Effets sonores actifs — cliquer pour couper'
      : 'Race sound effects active — click to mute'
    : langCode === 'pt'
    ? 'Efeitos sonoros silenciados — clique para ativar'
    : langCode === 'es'
    ? 'Efectos de sonido silenciados — clic para activar'
    : langCode === 'fr'
    ? 'Effets sonores coupés — cliquer pour activer'
    : 'Race sound effects muted — click to unmute';
  const isBgmPlayable = bgmEnabled && isSfxActive;
  const bgmOnLabel = 'BGM On';
  const bgmOffLabel = 'BGM Off';
  const bgmToggleTooltip = bgmEnabled
    ? !isSfxActive
      ? langCode === 'pt'
        ? 'BGM ativado (áudio geral silenciado) — clique para desligar a música de fundo'
        : langCode === 'es'
        ? 'BGM activado (audio general silenciado) — clic para apagar la música de fondo'
        : langCode === 'fr'
        ? 'BGM activé (son général coupé) — cliquer pour couper la musique de fond'
        : 'Race BGM enabled (master sound muted) — click to turn off background music'
      : langCode === 'pt'
      ? 'Música de fundo da corrida (BGM) ativa — clique para desligar e ouvir a sua própria música'
      : langCode === 'es'
      ? 'Música de fondo (BGM) activa — clic para apagar y escuchar tu propia música'
      : langCode === 'fr'
      ? 'Musique de fond (BGM) active — cliquer pour couper et écouter votre propre musique'
      : 'Background race music (BGM) active — click to turn off and play your own music'
    : langCode === 'pt'
    ? 'Música de fundo da corrida (BGM) desligada — clique para ativar'
    : langCode === 'es'
    ? 'Música de fondo (BGM) apagada — clic para activar'
    : langCode === 'fr'
    ? 'Musique de fond (BGM) coupée — cliquer pour activer'
    : 'Background race music (BGM) off — click to turn on';

  const formatAnomalyReason = (reason: TelemetryAnomalyReason): string => {
    if (reason === 'impossible-speed') {
      return langCode === 'pt'
        ? 'Velocidade impossível'
        : langCode === 'es'
        ? 'Velocidad imposible'
        : langCode === 'fr'
        ? 'Vitesse impossible'
        : 'Impossible speed';
    }
    if (reason === 'lane-switch-flood') {
      return langCode === 'pt'
        ? 'Troca de faixa excessiva'
        : langCode === 'es'
        ? 'Cambio de carril excesivo'
        : langCode === 'fr'
        ? 'Changements de voie excessifs'
        : 'Lane switch flood';
    }
    return langCode === 'pt'
      ? 'Teleporte de posição'
      : langCode === 'es'
      ? 'Teletransporte de posición'
      : langCode === 'fr'
      ? 'Téléportation de position'
      : 'Position teleport';
  };

  const desyncBannerDetail = React.useMemo(() => {
    if (!desyncAlerts || desyncAlerts.length === 0) return null;
    const names = desyncAlerts.map((a) => a.competitorName).join(', ');
    const latest = desyncAlerts[desyncAlerts.length - 1];
    const reasonText = formatAnomalyReason(latest.reason);
    if (langCode === 'pt') {
      return `Movimento consistentemente impossível detetado na sala (${names} · ${reasonText})`;
    }
    if (langCode === 'es') {
      return `Movimiento consistentemente imposible detectado en la sala (${names} · ${reasonText})`;
    }
    if (langCode === 'fr') {
      return `Mouvement systématiquement impossible détecté dans la salle (${names} · ${reasonText})`;
    }
    return `Consistently impossible movement detected in room (${names} · ${reasonText})`;
  }, [desyncAlerts, langCode]);

  const rttDisplay = React.useMemo(() => {
    const langCode = (lang || 'pt').slice(0, 2);
    const hasValue = serverConnected && typeof rttMs === 'number' && Number.isFinite(rttMs);
    if (!serverConnected) {
      return {
        dotClass: 'bg-zinc-500',
        textClass: 'text-zinc-400',
        borderClass: 'border-white/10',
        valueText: '-- ms',
        label:
          langCode === 'en'
            ? 'Server connection offline'
            : langCode === 'es'
            ? 'Conexión sin servidor'
            : langCode === 'fr'
            ? 'Connexion hors ligne'
            : 'Ligação local (sem servidor)',
      };
    }
    if (!hasValue) {
      return {
        dotClass: 'bg-amber-400 animate-pulse',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-500/30',
        valueText: '... ms',
        label:
          langCode === 'en'
            ? 'Measuring latency (RTT)'
            : langCode === 'es'
            ? 'Midiendo latencia (RTT)'
            : langCode === 'fr'
            ? 'Mesure de la latence (RTT)'
            : 'A medir latência (RTT)',
      };
    }
    const ms = Math.max(0, Math.round(rttMs));
    if (ms <= 70) {
      return {
        dotClass: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]',
        textClass: 'text-emerald-300',
        borderClass: 'border-emerald-500/35',
        valueText: `${ms}ms`,
        label:
          langCode === 'en'
            ? `Connection quality: Excellent (${ms}ms RTT)`
            : langCode === 'es'
            ? `Calidad de conexión: Excelente (${ms}ms RTT)`
            : langCode === 'fr'
            ? `Qualité de connexion : Excellente (${ms}ms RTT)`
            : `Qualidade da ligação: Excelente (${ms}ms RTT)`,
      };
    }
    if (ms <= 150) {
      return {
        dotClass: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-500/35',
        valueText: `${ms}ms`,
        label:
          langCode === 'en'
            ? `Connection quality: Fair (${ms}ms RTT)`
            : langCode === 'es'
            ? `Calidad de conexión: Media (${ms}ms RTT)`
            : langCode === 'fr'
            ? `Qualité de connexion : Moyenne (${ms}ms RTT)`
            : `Qualidade da ligação: Moderada (${ms}ms RTT)`,
      };
    }
    return {
      dotClass: 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]',
      textClass: 'text-rose-300',
      borderClass: 'border-rose-500/40',
      valueText: `${ms}ms`,
      label:
        langCode === 'en'
          ? `Connection quality: High latency (${ms}ms RTT)`
          : langCode === 'es'
          ? `Calidad de conexión: Latencia alta (${ms}ms RTT)`
          : langCode === 'fr'
          ? `Qualité de connexion : Latence élevée (${ms}ms RTT)`
          : `Qualidade da ligação: Latência alta (${ms}ms RTT)`,
    };
  }, [lang, rttMs, serverConnected]);

  React.useEffect(() => {
    if (!showVolumeSlider) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (volumePopoverRef.current && !volumePopoverRef.current.contains(e.target as Node)) {
        setShowVolumeSlider(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowVolumeSlider(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showVolumeSlider]);

  return (
    <header className="w-full game-panel border-x-0 border-t-0 border-b border-amber-500/25 px-3 py-2.5 flex flex-col gap-2.5 backdrop-blur-md">
      {/* Top Banner: Assinatura, Frase Oficial e Latência RTT */}
      <div className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-2 text-[11px] border-b border-white/10 pb-1.5 text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold tracking-wide">👑 {t.officialPhrase}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900/80 border ${rttDisplay.borderClass} text-[10px] font-mono`}
            title={rttDisplay.label}
            aria-label={rttDisplay.label}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rttDisplay.dotClass}`} />
            <span className="text-zinc-500 uppercase tracking-wider">RTT</span>
            <span className={`font-bold tabular-nums ${rttDisplay.textClass}`}>
              {rttDisplay.valueText}
            </span>
          </div>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <span className="text-amber-300 font-semibold">{t.creatorSignature}</span>
        </div>
      </div>

      {/* Main Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto w-full">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/25 via-amber-500/15 to-red-600/20 border border-amber-400/45 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.28)]">
            <span className="text-2xl filter drop-shadow-[0_2px_6px_rgba(245,158,11,0.65)]">👑</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-amber-400 uppercase leading-none font-display flex items-center gap-2 whitespace-nowrap">
              <span className="drop-shadow-[0_2px_10px_rgba(245,158,11,0.35)]">REI RUN</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/15 text-amber-200 border border-amber-400/50">
                REI ZERO
              </span>
            </h1>
            <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
              {t.header.subtitle}
            </span>
          </div>
        </div>

        {/* 2D vs 3D & Dia vs Noite Toggles */}
        <div className="flex items-center gap-2">
          <div className="p-0.5 game-subplate rounded-xl flex items-center">
            <button
              type="button"
              onClick={() => {
                if (viewMode !== '2d') onToggleViewMode();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === '2d'
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 font-black shadow-[0_2px_10px_rgba(245,158,11,0.35)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🎮 2D
            </button>
            <button
              type="button"
              onClick={() => {
                if (viewMode !== '3d') onToggleViewMode();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 font-black shadow-[0_2px_10px_rgba(245,158,11,0.35)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🧊 3D
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleTimeMode}
            className="px-2.5 py-1.5 rounded-xl game-btn-secondary text-xs font-bold text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            title={timeMode === 'day' ? t.header.day : t.header.night}
          >
            <span>{timeMode === 'day' ? t.header.day : t.header.night}</span>
          </button>

          <div className="p-0.5 game-subplate rounded-xl flex items-center">
            <button
              type="button"
              disabled={status === 'running' || status === 'starting'}
              onClick={() => {
                if (!isDemo) onToggleDemo();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                isDemo
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 font-black shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.header.demo}
            </button>
            <button
              type="button"
              disabled={status === 'running' || status === 'starting'}
              onClick={() => {
                if (isDemo) onToggleDemo();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                !isDemo
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-zinc-950 font-black shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.header.real}
            </button>
          </div>
        </div>

        {/* Cronômetro e Ondas */}
        <div className="flex items-center gap-3 game-subplate px-3.5 py-1.5 rounded-xl font-mono border border-amber-500/20">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase font-bold text-zinc-500">{t.header.time}</span>
            <span
              className={`text-base font-black tabular-nums leading-none ${
                remaining <= 10 && status === 'running'
                  ? 'text-rose-400'
                  : 'text-zinc-100'
              }`}
            >
              {remaining}s
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase font-bold text-amber-500">{t.header.pace}</span>
            <span
              className={`text-xs font-black leading-none ${
                isHardMode ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {isHardMode ? t.header.modeKing : t.header.modeEasy}
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase font-bold text-zinc-500">{t.header.coins}</span>
            <span className="text-xs font-black text-amber-300 leading-none tabular-nums">
              🪙 {coinsCollected}
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          {/* Top 3 Streak Segmented Indicator */}
          <motion.div
            data-testid="header-top3-streak"
            data-streak-count={top3Streak}
            animate={
              newlyFilledIdx !== null && !shouldReduceMotion
                ? { scale: [1, 1.08, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.42, ease: 'easeOut' }}
            className="flex flex-col items-start gap-1"
            title={streakTooltip}
            aria-label={streakTooltip}
          >
            <div className="flex items-center justify-between gap-1.5 w-full leading-none">
              <span className="text-[9px] uppercase font-bold text-orange-400/90 flex items-center gap-0.5">
                <Flame
                  className={`w-2.5 h-2.5 ${
                    top3Streak > 0 ? 'text-orange-400 fill-orange-400/80' : 'text-zinc-500'
                  }`}
                  strokeWidth={2.4}
                />
                <span>{streakLabel}</span>
              </span>
              <motion.span
                key={`streak-num-${top3Streak}`}
                initial={
                  streakPulseKey > 0 && !shouldReduceMotion
                    ? { scale: 1.35, color: '#fde047' }
                    : false
                }
                animate={{
                  scale: 1,
                  color: top3Streak > 0 ? '#fdba74' : '#71717a',
                }}
                transition={{ duration: 0.3 }}
                className="text-[11px] font-black tabular-nums leading-none"
              >
                {top3Streak}x
              </motion.span>
            </div>

            <div
              className="flex items-center gap-1"
              role="progressbar"
              aria-label={streakLabel}
              aria-valuemin={0}
              aria-valuemax={STREAK_SEGMENTS}
              aria-valuenow={filledSegments}
              aria-valuetext={`${top3Streak}x`}
            >
              {Array.from({ length: STREAK_SEGMENTS }).map((_, idx) => {
                const isFilled = idx < filledSegments;
                const isJustFilled = idx === newlyFilledIdx && streakPulseKey > 0;
                const isMaxed = top3Streak >= STREAK_SEGMENTS;
                return (
                  <div
                    key={idx}
                    data-testid={`streak-segment-${idx}`}
                    data-filled={isFilled ? 'true' : 'false'}
                    className={`relative w-3.5 h-1.5 rounded-full overflow-hidden border transition-colors duration-300 ${
                      isFilled
                        ? isMaxed
                          ? 'bg-amber-950/80 border-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                          : 'bg-orange-950/70 border-orange-400/60 shadow-[0_0_6px_rgba(249,115,22,0.35)]'
                        : 'bg-zinc-900/95 border-white/10'
                    }`}
                  >
                    <AnimatePresence initial={false}>
                      {isFilled && (
                        <motion.div
                          key={`fill-${idx}`}
                          initial={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : isJustFilled
                              ? { scaleX: 0, opacity: 0.4 }
                              : { scaleX: 1, opacity: 1 }
                          }
                          animate={{
                            scaleX: 1,
                            opacity: 1,
                          }}
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { scaleX: 0, opacity: 0 }
                          }
                          transition={
                            shouldReduceMotion
                              ? { duration: 0.1 }
                              : {
                                  duration: isJustFilled ? 0.42 : 0.22,
                                  ease: [0.22, 1, 0.36, 1],
                                }
                          }
                          className={`w-full h-full origin-left rounded-full ${
                            isMaxed
                              ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400'
                              : 'bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300'
                          }`}
                        />
                      )}
                    </AnimatePresence>
                    {isJustFilled && !shouldReduceMotion && (
                      <motion.div
                        key={`flash-${streakPulseKey}`}
                        initial={{ opacity: 0.9, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.4 }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                        className="pointer-events-none absolute inset-0 rounded-full bg-yellow-200/80"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {isDemo && status !== 'running' && status !== 'starting' && (
            <>
              <div className="h-6 w-px bg-white/10" />
              <button
                type="button"
                onClick={onResetBalance}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[10px] font-black cursor-pointer transition-colors"
              >
                {t.header.addDemoBtn}
              </button>
            </>
          )}
        </div>

        {/* Global Language/Currency Switcher + Rooms + Shop + Ranking + Audio */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Language, Geo-Location & Currency Button */}
          <button
            type="button"
            onClick={openModal}
            className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-sky-500/25 to-amber-500/25 hover:from-sky-500/35 hover:to-amber-500/35 border border-amber-400/50 text-[11px] font-black text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            title={`${t.header.langButtonTooltip} (${geoInfo.flag} ${geoInfo.countryName})`}
          >
            <span>🌐</span>
            <span>{langMeta.flag}</span>
            <span className="hidden sm:inline max-w-[90px] truncate">{langMeta.nativeName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 font-mono">
              {currencyMeta.code}
            </span>
          </button>

          {canSpectate && onSpectate && (
            <button
              type="button"
              onClick={onSpectate}
              className="px-2.5 h-8 rounded-xl bg-gradient-to-r from-sky-500/30 to-cyan-500/25 hover:from-sky-500/45 hover:to-cyan-500/40 border border-sky-400/75 text-sky-100 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-[0_0_14px_rgba(56,189,248,0.28)] transition-all"
              title={spectateTooltip}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse shrink-0" />
              <span>👻</span>
              <span>{spectateLabel}</span>
            </button>
          )}

          {isSpectating && !canSpectate && (
            <span
              className="px-2.5 h-8 rounded-xl bg-cyan-950/85 border border-cyan-400/60 text-cyan-200 text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title={spectateTooltip}
            >
              <span>👻</span>
              <span className="hidden sm:inline">{spectatingActiveLabel}</span>
            </span>
          )}

          {(canSpectate || isSpectating) && onOpenSpectatorOverview && (
            <button
              type="button"
              data-testid="header-spectator-overview-btn"
              onClick={onOpenSpectatorOverview}
              className="px-2.5 h-8 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/60 text-sky-100 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors whitespace-nowrap shrink-0"
              title={overviewTooltip}
            >
              <span>📊</span>
              <span>{overviewLabel}</span>
            </button>
          )}

          <button
            type="button"
            disabled={status === 'running' || status === 'starting'}
            onClick={onOpenLobby}
            className="px-2.5 h-8 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-50"
            title={t.header.inviteFriends}
          >
            <span>👥</span>
            <span className="hidden sm:inline">{t.header.inviteFriends}</span>
          </button>

          <button
            type="button"
            disabled={status === 'running' || status === 'starting'}
            onClick={onOpenShop}
            className="px-2.5 h-8 rounded-xl game-btn-secondary text-xs font-semibold text-amber-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title={t.header.shop}
          >
            <span>🛍️</span>
            <span className="hidden md:inline">{t.header.shop}</span>
          </button>

          <button
            type="button"
            disabled={status === 'running' || status === 'starting'}
            onClick={onOpenRanking}
            className="px-2.5 h-8 rounded-xl game-btn-secondary text-xs font-semibold text-amber-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title={t.header.rankingTitle}
          >
            <span>🏆</span>
          </button>

          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-2.5 h-8 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
            title="/admin-rei-zero"
          >
            <span>🛡️</span>
            <span className="hidden lg:inline">/admin-rei-zero</span>
          </button>

          <div
            className="relative flex items-center gap-1.5 game-subplate rounded-xl p-0.5 pr-1.5 border border-white/10"
            ref={volumePopoverRef}
          >
            <motion.button
              type="button"
              data-testid="sfx-toggle-button"
              data-sfx-state={isSfxActive ? 'active' : 'muted'}
              onClick={() => {
                if (!isSfxActive) {
                  sounds.unlockAudio();
                  if (!soundEnabled) onToggleSound();
                  if (volume <= 0) onVolumeChange(0.7);
                } else {
                  onToggleSound();
                }
              }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
              animate={{
                backgroundColor: isSfxActive
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(76, 5, 25, 0.8)',
                borderColor: isSfxActive
                  ? 'rgba(52, 211, 153, 0.55)'
                  : 'rgba(244, 63, 94, 0.55)',
              }}
              transition={{ duration: shouldReduceMotion ? 0.05 : 0.25, ease: 'easeOut' }}
              aria-pressed={isSfxActive}
              aria-label={sfxToggleTooltip}
              title={sfxToggleTooltip}
              className={`px-2.5 h-7 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border transition-colors duration-300 whitespace-nowrap shrink-0 ${
                isSfxActive
                  ? 'hover:bg-emerald-500/30 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'hover:bg-rose-900/85 text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.16)]'
              }`}
            >
              <motion.span
                animate={{
                  backgroundColor: isSfxActive ? '#34d399' : '#fb7185',
                  scale: shouldReduceMotion ? 1 : isSfxActive ? [1, 1.25, 1] : 1,
                }}
                transition={{ duration: shouldReduceMotion ? 0.05 : 0.3 }}
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isSfxActive
                    ? 'animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.85)]'
                    : ''
                }`}
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isSfxActive ? (volume > 0.5 ? 'sfx-high' : 'sfx-low') : 'sfx-muted'}
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          scale: 0.7,
                          y: isSfxActive ? 3 : -3,
                          rotate: isSfxActive ? -12 : 12,
                        }
                  }
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 1,
                          scale: [0.8, 1.18, 1],
                          y: [isSfxActive ? 2 : -2, isSfxActive ? -1.5 : 1.5, 0],
                          rotate: 0,
                          color: isSfxActive ? '#6ee7b7' : '#fda4af',
                        }
                  }
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.72, y: isSfxActive ? -2 : 2 }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.08 }
                      : { duration: 0.24, ease: 'easeOut' }
                  }
                  className="inline-flex items-center justify-center shrink-0"
                >
                  {isSfxActive ? (
                    volume > 0.5 ? (
                      <Volume2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.3} />
                    ) : (
                      <Volume1 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.3} />
                    )
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 shrink-0" strokeWidth={2.3} />
                  )}
                </motion.span>
              </AnimatePresence>
              <span className="font-mono uppercase tracking-tight text-[10px] transition-colors duration-200">
                {isSfxActive ? sfxOnLabel : sfxMutedLabel}
              </span>
            </motion.button>

            {/* Visual Progress-Style Volume Slider */}
            {(() => {
              const displayVolumePct = isSfxActive ? Math.round(volume * 100) : 0;
              const fillScale = Math.max(0, Math.min(1, displayVolumePct / 100));
              const handlePrecisionVolume = (nextPct: number) => {
                const clamped = Math.max(0, Math.min(100, Math.round(nextPct)));
                const nextVol = clamped / 100;
                sounds.unlockAudio();
                onVolumeChange(nextVol);
                if (clamped > 0 && !soundEnabled) {
                  onToggleSound();
                } else if (clamped === 0 && soundEnabled) {
                  onToggleSound();
                }
              };

              return (
                <>
                  <div
                    className="relative flex items-center w-20 sm:w-28 h-6 px-1 group/vol select-none shrink-0"
                    title={`${t.header.volumeTitle}: ${displayVolumePct}%`}
                  >
                    <div className="relative w-full h-2 rounded-full bg-zinc-900/95 border border-white/15 overflow-hidden shadow-inner">
                      <div
                        className={`h-full w-full origin-left transition-transform duration-100 ease-out rounded-full ${
                          isSfxActive
                            ? 'bg-gradient-to-r from-emerald-400 via-amber-400 to-yellow-300'
                            : 'bg-zinc-600/50'
                        }`}
                        style={{ transform: `scaleX(${fillScale})` }}
                      />
                    </div>
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border transition-[transform,background-color,border-color] duration-100 group-hover/vol:scale-110 group-focus-within/vol:scale-115 ${
                        isSfxActive
                          ? 'bg-amber-300 border-zinc-950 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                          : 'bg-zinc-400 border-zinc-900'
                      }`}
                      style={{ left: `calc(4px + (100% - 8px) * ${fillScale})` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={displayVolumePct}
                      data-testid="header-volume-slider"
                      aria-label={t.header.volumeTitle}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={displayVolumePct}
                      aria-valuetext={`${displayVolumePct}%`}
                      onChange={(e) => handlePrecisionVolume(Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowVolumeSlider((prev) => !prev)}
                    className="px-1.5 h-7 rounded-lg text-[10px] text-amber-300 font-mono font-bold hover:bg-white/5 flex items-center gap-0.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    title={t.header.volumeTitle}
                    aria-label={t.header.volumeTitle}
                    aria-expanded={showVolumeSlider}
                  >
                    <span className="tabular-nums min-w-[2.3rem] text-right">{displayVolumePct}%</span>
                    <span className="text-[9px] text-zinc-400">▾</span>
                  </button>

                  {showVolumeSlider && (
                    <div className="absolute right-0 top-10 z-50 game-panel-gold rounded-xl p-3 flex flex-col gap-2.5 w-52 shadow-2xl">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-zinc-200">{t.header.volumeTitle}</span>
                        <span className="font-black text-amber-300 tabular-nums">
                          {displayVolumePct}%
                        </span>
                      </div>

                      <div className="relative flex items-center w-full h-6 group/popvol select-none">
                        <div className="relative w-full h-2.5 rounded-full bg-zinc-900/95 border border-white/15 overflow-hidden shadow-inner">
                          <div
                            className={`h-full w-full origin-left transition-transform duration-100 ease-out rounded-full ${
                              isSfxActive
                                ? 'bg-gradient-to-r from-emerald-400 via-amber-400 to-yellow-300'
                                : 'bg-zinc-600/50'
                            }`}
                            style={{ transform: `scaleX(${fillScale})` }}
                          />
                        </div>
                        <div
                          aria-hidden="true"
                          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border transition-transform duration-100 group-hover/popvol:scale-110 ${
                            isSfxActive
                              ? 'bg-amber-300 border-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.75)]'
                              : 'bg-zinc-400 border-zinc-900'
                          }`}
                          style={{ left: `calc(6px + (100% - 12px) * ${fillScale})` }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={displayVolumePct}
                          aria-label={t.header.volumeTitle}
                          onChange={(e) => handlePrecisionVolume(Number(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 gap-1">
                        {[0, 25, 50, 75, 100].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handlePrecisionVolume(preset)}
                            className={`flex-1 py-1 rounded-lg cursor-pointer transition-colors tabular-nums ${
                              displayVolumePct === preset
                                ? 'bg-amber-500 text-zinc-950 font-black'
                                : 'bg-zinc-800 hover:bg-zinc-700 hover:text-amber-300'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {onToggleBgm && (
            <motion.button
              type="button"
              data-testid="bgm-toggle-button"
              data-bgm-state={bgmEnabled ? 'active' : 'off'}
              onClick={() => {
                if (!bgmEnabled) {
                  sounds.unlockAudio();
                }
                onToggleBgm();
              }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
              animate={{
                backgroundColor: bgmEnabled
                  ? isBgmPlayable
                    ? 'rgba(139, 92, 246, 0.22)'
                    : 'rgba(139, 92, 246, 0.12)'
                  : 'rgba(39, 39, 42, 0.8)',
                borderColor: bgmEnabled
                  ? isBgmPlayable
                    ? 'rgba(167, 139, 250, 0.6)'
                    : 'rgba(167, 139, 250, 0.35)'
                  : 'rgba(113, 113, 122, 0.45)',
              }}
              transition={{ duration: shouldReduceMotion ? 0.05 : 0.22, ease: 'easeOut' }}
              aria-pressed={bgmEnabled}
              aria-label={bgmToggleTooltip}
              title={bgmToggleTooltip}
              className={`px-2.5 h-8 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border transition-colors duration-200 whitespace-nowrap shrink-0 ${
                bgmEnabled
                  ? 'hover:bg-violet-500/30 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.22)]'
                  : 'hover:bg-zinc-700/80 text-zinc-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                  bgmEnabled
                    ? isBgmPlayable
                      ? 'bg-violet-400 animate-pulse shadow-[0_0_6px_rgba(167,139,250,0.85)]'
                      : 'bg-violet-400/55'
                    : 'bg-zinc-500'
                }`}
              />
              <span className="relative inline-flex items-center justify-center shrink-0">
                <Music className="w-3.5 h-3.5 shrink-0" strokeWidth={2.3} />
                {!bgmEnabled && (
                  <span
                    aria-hidden="true"
                    className="absolute w-4 h-[1.75px] bg-rose-400 rotate-[-45deg] rounded-full shadow-[0_0_2px_rgba(0,0,0,0.8)]"
                  />
                )}
              </span>
              <span className="font-mono uppercase tracking-tight text-[10px]">
                {bgmEnabled ? bgmOnLabel : bgmOffLabel}
              </span>
            </motion.button>
          )}

          <button
            type="button"
            onClick={onOpenProvablyFair}
            className="px-2.5 h-8 rounded-xl bg-emerald-950/75 hover:bg-emerald-900/75 border border-emerald-500/45 text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title={t.header.auditable}
          >
            <span>🛡️</span>
            <span className="hidden sm:inline text-[11px]">{t.header.auditable}</span>
          </button>

          <button
            type="button"
            onClick={onOpenRules}
            className="w-8 h-8 rounded-xl game-btn-secondary text-zinc-200 flex items-center justify-center text-xs cursor-pointer"
            title={t.header.rulesTitle}
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* Room-Wide Flashing Suspected Desync Warning */}
      <AnimatePresence>
        {desyncAlerts.length > 0 && desyncBannerDetail && (
          <motion.div
            key="header-desync-warning"
            data-testid="header-desync-warning"
            role="alert"
            aria-live="assertive"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : {
                    opacity: [1, 0.78, 1],
                    y: 0,
                    scale: 1,
                    borderColor: [
                      'rgba(244, 63, 94, 0.88)',
                      'rgba(251, 191, 36, 0.92)',
                      'rgba(244, 63, 94, 0.88)',
                    ],
                    boxShadow: [
                      '0 0 18px rgba(244, 63, 94, 0.35)',
                      '0 0 24px rgba(251, 191, 36, 0.45)',
                      '0 0 18px rgba(244, 63, 94, 0.35)',
                    ],
                  }
            }
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.12 }
                : {
                    y: { duration: 0.22, ease: 'easeOut' },
                    scale: { duration: 0.22, ease: 'easeOut' },
                    opacity: { duration: 1.05, repeat: Infinity, ease: 'easeInOut' },
                    borderColor: { duration: 1.05, repeat: Infinity, ease: 'easeInOut' },
                    boxShadow: { duration: 1.05, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
            className="max-w-6xl mx-auto w-full rounded-xl border bg-gradient-to-r from-rose-950/90 via-red-950/85 to-amber-950/85 px-3 py-2 flex items-center justify-between gap-2.5 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-rose-500/25 border border-rose-400/60 flex items-center justify-center shrink-0">
                <AlertTriangle
                  className={`w-4 h-4 text-amber-300 ${shouldReduceMotion ? '' : 'animate-pulse'}`}
                  strokeWidth={2.4}
                />
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                <span className="px-2 py-0.5 rounded-md bg-rose-500/30 border border-rose-400/60 text-rose-100 font-black uppercase tracking-wider text-[10px] shrink-0">
                  Suspected desync
                </span>
                <span className="text-amber-100 font-semibold truncate sm:whitespace-normal">
                  {desyncBannerDetail}
                </span>
              </div>
            </div>

            {onDismissDesyncAlert && (
              <button
                type="button"
                onClick={onDismissDesyncAlert}
                aria-label="Dismiss suspected desync alert"
                className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.4} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
