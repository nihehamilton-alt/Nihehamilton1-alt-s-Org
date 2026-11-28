import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { GameStatus, ViewMode, TimeMode } from '../types/game';
import { useI18n } from '../contexts/I18nContext';
import { TOTAL_GAME_TIME_SECONDS, HARD_MODE_START_SECONDS } from '../game/constants';
import { sounds } from '../audio/soundEffects';

interface GameHeaderProps {
  status: GameStatus;
  elapsedSeconds: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
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
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  status,
  elapsedSeconds,
  soundEnabled,
  onToggleSound,
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
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = React.useState<boolean>(false);
  const volumePopoverRef = React.useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { t, lang, langMeta, currencyMeta, geoInfo, openModal } = useI18n();
  const remaining = Math.max(0, TOTAL_GAME_TIME_SECONDS - Math.floor(elapsedSeconds));
  const isHardMode = elapsedSeconds >= HARD_MODE_START_SECONDS;
  const langCode = (lang || 'pt').slice(0, 2);
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
              className="px-2.5 h-8 rounded-xl bg-cyan-950/85 border border-cyan-400/60 text-cyan-200 text-xs font-black flex items-center gap-1.5"
              title={spectateTooltip}
            >
              <span>👻</span>
              <span className="hidden sm:inline">{spectatingActiveLabel}</span>
            </span>
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
            className="relative flex items-center game-subplate rounded-xl p-0.5 border border-white/10"
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
              className={`px-2.5 h-7 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border transition-colors duration-300 ${
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

            <button
              type="button"
              onClick={() => setShowVolumeSlider((prev) => !prev)}
              className="px-1.5 h-7 rounded-lg text-[10px] text-amber-400 font-mono font-bold hover:bg-white/5 flex items-center gap-0.5 cursor-pointer transition-colors"
              title={t.header.volumeTitle}
              aria-label={t.header.volumeTitle}
              aria-expanded={showVolumeSlider}
            >
              <span className="tabular-nums">
                {isSfxActive ? `${Math.round(volume * 100)}%` : '0%'}
              </span>
              <span className="text-[9px] text-zinc-400">▾</span>
            </button>

            {showVolumeSlider && (
              <div className="absolute right-0 top-10 z-50 game-panel-gold rounded-xl p-3 flex flex-col gap-2.5 w-48">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-zinc-200">{t.header.volumeTitle}</span>
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    {soundEnabled ? t.header.mute : t.header.unmute}
                  </button>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soundEnabled ? Math.round(volume * 100) : 0}
                  onChange={(e) => {
                    const val = Number(e.target.value) / 100;
                    onVolumeChange(val);
                    if (!soundEnabled && val > 0) onToggleSound();
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                  {[0, 25, 50, 75, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        onVolumeChange(preset / 100);
                        if (!soundEnabled && preset > 0) onToggleSound();
                      }}
                      className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 hover:text-amber-300 cursor-pointer"
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
    </header>
  );
};
