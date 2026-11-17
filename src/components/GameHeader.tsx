import React from 'react';
import { GameStatus, ViewMode, TimeMode } from '../types/game';
import { useI18n } from '../contexts/I18nContext';
import { TOTAL_GAME_TIME_SECONDS, HARD_MODE_START_SECONDS } from '../game/constants';

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
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = React.useState<boolean>(false);
  const volumePopoverRef = React.useRef<HTMLDivElement | null>(null);
  const { t, langMeta, currencyMeta, geoInfo, openModal } = useI18n();
  const remaining = Math.max(0, TOTAL_GAME_TIME_SECONDS - Math.floor(elapsedSeconds));
  const isHardMode = elapsedSeconds >= HARD_MODE_START_SECONDS;

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
      {/* Top Banner: Assinatura e Frase Oficial */}
      <div className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between text-[11px] border-b border-white/10 pb-1.5 text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold tracking-wide">👑 {t.officialPhrase}</span>
        </div>
        <div className="flex items-center gap-2">
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

          <div className="relative" ref={volumePopoverRef}>
            <button
              type="button"
              onClick={() => setShowVolumeSlider((prev) => !prev)}
              className="px-2.5 h-8 rounded-xl game-btn-secondary text-zinc-200 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title={t.header.volumeTitle}
            >
              <span>{soundEnabled && volume > 0 ? (volume > 0.5 ? '🔊' : '🔉') : '🔇'}</span>
              <span className="text-[10px] text-amber-400 font-mono">
                {soundEnabled ? `${Math.round(volume * 100)}%` : '0%'}
              </span>
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
