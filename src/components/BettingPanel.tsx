import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe } from 'lucide-react';
import { Competitor, GameStatus, Lane } from '../types/game';
import {
  MIN_BET_KZ,
  MAX_BET_KZ,
  calculateThreeTorneiras,
  convertCurrencyToKz,
  convertKzToCurrency,
  getCrossBorderStakeParity,
  getQuickBetChipsKz,
} from '../data/currency';
import { getLocalizedBot } from '../data/translations';
import { useI18n } from '../contexts/I18nContext';
import { sounds } from '../audio/soundEffects';
import { TOTAL_GAME_TIME_SECONDS } from '../game/constants';
import { AvatarDoll } from './AvatarDoll';
import { getMultiplayerStrings } from '../utils/multiplayerStrings';

interface BettingPanelProps {
  status: GameStatus;
  balanceKz: number;
  betAmountKz: number;
  elapsedSeconds: number;
  playerRank: number;
  onBetChange: (amount: number) => void;
  onStartRound: () => void;
  lastPayoutKz: number | null;
  lastRank: number | null;
  isDemo: boolean;
  playerAvatar?: { id?: string; avatar: string; name: string; color?: string };
  competitors?: Competitor[];
  maxPlayers?: number;
  isMultiplayerGuest?: boolean;
  hostName?: string;
  waitingForOpponent?: boolean;
  waitingOpponentNames?: string[];
  connectedHumansCount?: number;
  onRechargeDemo?: () => void;
  onEditingStateChange?: (isEditing: boolean) => void;
}

function formatEditableLocalAmount(kz: number, decimals: number, rate: number): string {
  const localVal = kz / (rate || 1);
  if (decimals === 0) {
    return String(Math.round(localVal));
  }
  return Number(localVal.toFixed(decimals)).toString();
}

export const BettingPanel: React.FC<BettingPanelProps> = ({
  status,
  balanceKz,
  betAmountKz,
  elapsedSeconds,
  playerRank,
  onBetChange,
  onStartRound,
  lastPayoutKz,
  lastRank,
  isDemo,
  playerAvatar,
  competitors,
  maxPlayers,
  isMultiplayerGuest = false,
  hostName,
  waitingForOpponent = false,
  waitingOpponentNames = [],
  connectedHumansCount = 1,
  onRechargeDemo,
  onEditingStateChange,
}) => {
  const { lang, currency, currencyMeta, t, rates, fxState, formatMoney, openModal } = useI18n();
  const mpStrings = useMemo(() => getMultiplayerStrings(lang), [lang]);

  const isRunning = status === 'running';
  const isStarting = status === 'starting';

  const activePlayerCount = Math.max(2, Math.min(5, competitors?.length || maxPlayers || 5));
  const torneiras = calculateThreeTorneiras(betAmountKz, activePlayerCount);
  const timeLeft = Math.max(0, TOTAL_GAME_TIME_SECONDS - Math.floor(elapsedSeconds));

  const rateForCurrency = rates[currency] || currencyMeta.defaultKzPerUnit || 1;
  const [localInput, setLocalInput] = useState<string>(() =>
    formatEditableLocalAmount(betAmountKz, currencyMeta.decimals, rateForCurrency)
  );
  const [isEditingInput, setIsEditingInput] = useState(false);
  const [inputRangeError, setInputRangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditingInput) {
      setLocalInput(
        formatEditableLocalAmount(betAmountKz, currencyMeta.decimals, rateForCurrency)
      );
      setInputRangeError(null);
    }
  }, [betAmountKz, currency, currencyMeta.decimals, rateForCurrency, isEditingInput]);

  const quickChips = useMemo(
    () => getQuickBetChipsKz(currency, rates),
    [currency, rates]
  );

  const parityItems = useMemo(
    () => getCrossBorderStakeParity(betAmountKz, rates),
    [betAmountKz, rates]
  );

  const bot1 = useMemo(() => getLocalizedBot('bot-kota-banza', lang), [lang]);
  const bot2 = useMemo(() => getLocalizedBot('bot-zito-kuduro', lang), [lang]);
  const bot4 = useMemo(() => getLocalizedBot('bot-tia-maria', lang), [lang]);
  const bot5 = useMemo(() => getLocalizedBot('bot-beto-candonga', lang), [lang]);

  const minLocal = useMemo(
    () => convertKzToCurrency(MIN_BET_KZ, currency, rates),
    [currency, rates]
  );
  const maxLocal = useMemo(
    () => convertKzToCurrency(MAX_BET_KZ, currency, rates),
    [currency, rates]
  );
  const rangeText = `${formatMoney(MIN_BET_KZ)} – ${formatMoney(MAX_BET_KZ)}`;

  const handleChipClick = (kzAmount: number) => {
    sounds.playCoin();
    setIsEditingInput(false);
    setInputRangeError(null);
    onEditingStateChange?.(false);
    onBetChange(kzAmount);
  };

  const handleLocalInputChange = (raw: string) => {
    setLocalInput(raw);
    const normalized = raw.replace(',', '.').trim();
    if (!normalized) {
      setInputRangeError(`${mpStrings.betRangeHint} ${rangeText}`);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setInputRangeError(`${mpStrings.betRangeHint} ${rangeText}`);
      return;
    }
    const nextKz = convertCurrencyToKz(parsed, currency, rates);
    if (nextKz < MIN_BET_KZ || nextKz > MAX_BET_KZ) {
      setInputRangeError(`${mpStrings.betRangeHint} ${rangeText}`);
      return;
    }
    setInputRangeError(null);
    onBetChange(nextKz);
  };

  const handleLocalInputBlur = () => {
    setIsEditingInput(false);
    onEditingStateChange?.(false);
    const normalized = localInput.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      const convertedKz = convertCurrencyToKz(parsed, currency, rates);
      const clampedKz = Math.max(MIN_BET_KZ, Math.min(MAX_BET_KZ, convertedKz));
      onBetChange(clampedKz);
      setLocalInput(
        formatEditableLocalAmount(clampedKz, currencyMeta.decimals, rateForCurrency)
      );
      setInputRangeError(null);
      return;
    }
    setLocalInput(
      formatEditableLocalAmount(betAmountKz, currencyMeta.decimals, rateForCurrency)
    );
    setInputRangeError(null);
  };

  const stepAmount = currencyMeta.decimals === 0 ? 1 : 0.01;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="game-panel-gold rounded-2xl p-4 flex flex-col gap-4 relative overflow-hidden"
    >
      {/* Barra de Identidade da Operadora White-Label */}
      <div
        className="absolute top-0 inset-x-0 h-1"
        style={{
          background: 'linear-gradient(90deg, var(--op-primary, #f59e0b), var(--op-accent, #dc2626))',
        }}
      />

      {/* Top Header: Saldo e Moeda */}
      <div className="flex items-center justify-between pt-0.5 pb-3 border-b border-white/10 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.65)]"
            style={{ backgroundColor: 'var(--op-primary, #f59e0b)' }}
          />
          <span className="text-xs font-black text-amber-400 uppercase tracking-wider font-mono truncate">
            {isDemo ? t.betting.demoModeTitle : `${t.betting.realModeTitle} (${currency})`} · {TOTAL_GAME_TIME_SECONDS}s
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono shrink-0 game-subplate px-2.5 py-1 rounded-lg">
          <span className="text-zinc-500 font-sans text-[11px]">{t.betting.balanceLabel}</span>
          <motion.span
            key={`${balanceKz}-${currency}`}
            initial={{ scale: 1.12 }}
            animate={{ scale: 1 }}
            className="font-black text-sm text-zinc-100 tabular-nums"
          >
            {formatMoney(balanceKz)}
          </motion.span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isRunning && !isStarting ? (
          // ==========================================
          // CONFIGURAÇÃO DA CORRIDA E APOSTA
          // ==========================================
          <motion.div
            key="bet-setup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3.5"
          >
            {/* Grelha de Largada Dinâmica nas 5 Faixas (2 a 5 jogadores reais/bots) */}
            <div className="game-subplate rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase tracking-wider gap-2">
                <span className="text-amber-400 font-bold flex items-center gap-1 truncate">
                  <span>🏁</span> {t.betting.startGridTitle}
                </span>
                <span className="text-zinc-400 shrink-0 font-bold flex items-center gap-1.5">
                  {connectedHumansCount > 1 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[9px]">
                      🟢 {connectedHumansCount}
                    </span>
                  )}
                  <span>
                    {activePlayerCount}/5 · {t.betting.lanesRunnersSub}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                {([0, 1, 2, 3, 4] as Lane[]).map((laneIdx) => {
                  const fallbackBots = [bot1, bot2, null, bot4, bot5];
                  const occupant = competitors
                    ? competitors.find((c) => c.lane === laneIdx)
                    : laneIdx === 2
                    ? {
                        id: 'player-rei-zero',
                        name: playerAvatar?.name || 'REI ZERO',
                        avatar: playerAvatar?.avatar || '🤴🏾',
                        avatarId: playerAvatar?.id || 'rei-zero',
                        color: playerAvatar?.color || '#f59e0b',
                        isPlayer: true,
                        isBot: false,
                        betAmount: betAmountKz,
                      }
                    : fallbackBots[laneIdx]
                    ? {
                        id: `fallback-${laneIdx}`,
                        name: fallbackBots[laneIdx]!.name,
                        avatar: fallbackBots[laneIdx]!.avatar,
                        avatarId: fallbackBots[laneIdx]!.avatarId,
                        color: fallbackBots[laneIdx]!.color,
                        isPlayer: false,
                        isBot: true,
                        betAmount: betAmountKz,
                      }
                    : undefined;

                  if (!occupant) {
                    return (
                      <div
                        key={laneIdx}
                        className="bg-zinc-950/60 border border-dashed border-zinc-800 rounded-xl p-1.5 text-center flex flex-col items-center justify-center opacity-55"
                      >
                        <span className="text-[9px] font-bold text-zinc-500">F{laneIdx + 1}</span>
                        <span className="text-base my-1 text-zinc-600">—</span>
                        <span className="text-[8px] text-zinc-600 truncate w-full">—</span>
                      </div>
                    );
                  }

                  const occupantBet =
                    'betAmount' in occupant && typeof occupant.betAmount === 'number'
                      ? occupant.betAmount
                      : betAmountKz;
                  const occupantIsHost = 'isHost' in occupant && Boolean(occupant.isHost);

                  if (occupant.isPlayer) {
                    return (
                      <div
                        key={laneIdx}
                        className="bg-gradient-to-b from-amber-500/25 to-amber-500/10 border-2 border-amber-400 rounded-xl p-1.5 text-center flex flex-col items-center shadow-[0_0_16px_rgba(245,158,11,0.3)]"
                      >
                        <span className="text-[9px] font-black text-amber-200 truncate w-full">
                          {occupantIsHost ? '👑 ' : ''}
                          {laneIdx === 2 ? t.betting.centerLaneLabel : `F${laneIdx + 1} · ${t.lobby.youBadge}`}
                        </span>
                        <div
                          className="my-0.5 flex items-center justify-center"
                          title={`${playerAvatar?.name || occupant.name} ${t.youTag}`}
                        >
                          <AvatarDoll
                            avatarId={playerAvatar?.id || occupant.avatarId || 'rei-zero'}
                            name={playerAvatar?.name || occupant.name}
                            color={playerAvatar?.color || occupant.color}
                            size={32}
                            variant="full"
                          />
                        </div>
                        <span className="text-[8px] font-black text-amber-300 truncate w-full">
                          {playerAvatar?.name || occupant.name}
                        </span>
                        <span className="text-[8px] font-mono font-black text-emerald-300 truncate w-full tabular-nums">
                          {formatMoney(occupantBet)}
                        </span>
                      </div>
                    );
                  }

                  const isSelectingProfile = 'profileReady' in occupant && occupant.profileReady === false;
                  const isLiveHuman = !occupant.isBot && !occupant.id.startsWith('friend-');

                  return (
                    <div
                      key={laneIdx}
                      className={`game-panel rounded-xl p-1.5 text-center flex flex-col items-center ${
                        isSelectingProfile
                          ? 'border border-amber-500/50'
                          : isLiveHuman
                          ? 'border border-emerald-500/55 bg-emerald-950/20'
                          : ''
                      }`}
                    >
                      <span className="text-[9px] font-bold text-zinc-400">
                        F{laneIdx + 1}{' '}
                        {isSelectingProfile
                          ? '⏳'
                          : occupantIsHost
                          ? '👑'
                          : isLiveHuman
                          ? '🟢'
                          : !occupant.isBot
                          ? '🤝'
                          : ''}
                      </span>
                      <div
                        className="my-0.5 flex items-center justify-center"
                        title={`${occupant.name} [${occupant.isBot ? t.lobby.botBadge : 'Online'}]`}
                      >
                        <AvatarDoll
                          avatarId={occupant.avatarId}
                          name={occupant.name}
                          color={occupant.color}
                          size={28}
                          variant="full"
                        />
                      </div>
                      <span className="text-[8px] text-zinc-300 truncate w-full font-medium">
                        {occupant.name}
                      </span>
                      <span className="text-[8px] font-mono font-bold text-amber-300 truncate w-full tabular-nums">
                        {formatMoney(occupantBet)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Input de Aposta na Moeda Local com Conversão Automática Global */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold text-zinc-200 flex items-center justify-between gap-2">
                <span>
                  {t.betting.betPerPlayer} ({currencyMeta.flag} {currency})
                </span>
                <button
                  type="button"
                  onClick={openModal}
                  className="text-amber-400 hover:text-amber-300 text-[10px] font-mono underline underline-offset-2 cursor-pointer flex items-center gap-1"
                >
                  <Globe size={11} />
                  <span>{t.betting.minMaxLabel}</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-amber-400 font-black font-mono">
                    {currencyMeta.symbol}
                  </span>
                  <input
                    type="number"
                    min={Number(minLocal.toFixed(currencyMeta.decimals))}
                    max={Number(maxLocal.toFixed(currencyMeta.decimals))}
                    step={stepAmount}
                    value={localInput}
                    placeholder={mpStrings.manualBetPlaceholder}
                    disabled={isMultiplayerGuest}
                    onFocus={() => {
                      setIsEditingInput(true);
                      onEditingStateChange?.(true);
                    }}
                    onChange={(e) => handleLocalInputChange(e.target.value)}
                    onBlur={handleLocalInputBlur}
                    className={`w-full game-subplate rounded-xl pl-12 pr-8 py-2.5 text-zinc-100 font-mono font-black text-base focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                      inputRangeError
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'focus:border-amber-400'
                    }`}
                  />
                  {!isMultiplayerGuest && localInput !== '' && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsEditingInput(true);
                        setLocalInput('');
                        setInputRangeError(`${mpStrings.betRangeHint} ${rangeText}`);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400 hover:text-amber-300 cursor-pointer px-1"
                      aria-label="Clear"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isMultiplayerGuest}
                  onClick={() => {
                    setIsEditingInput(false);
                    setInputRangeError(null);
                    onBetChange(Math.max(MIN_BET_KZ, Math.floor(betAmountKz / 2)));
                  }}
                  className="px-2.5 py-2.5 game-btn-secondary text-zinc-200 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ½
                </button>
                <button
                  type="button"
                  disabled={isMultiplayerGuest}
                  onClick={() => {
                    setIsEditingInput(false);
                    setInputRangeError(null);
                    onBetChange(Math.min(MAX_BET_KZ, betAmountKz * 2));
                  }}
                  className="px-2.5 py-2.5 game-btn-secondary text-zinc-200 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  2X
                </button>
                <button
                  type="button"
                  disabled={isMultiplayerGuest}
                  onClick={() => {
                    setIsEditingInput(false);
                    setInputRangeError(null);
                    onBetChange(Math.max(MIN_BET_KZ, Math.min(MAX_BET_KZ, Math.floor(balanceKz))));
                  }}
                  className="px-2.5 py-2.5 game-btn-secondary text-amber-400 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.betting.maxBtn}
                </button>
              </div>
              {inputRangeError && (
                <span className="text-[11px] font-mono font-bold text-rose-400">
                  {inputRangeError}
                </span>
              )}
              {isMultiplayerGuest && (
                <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/35 text-[10px] font-mono text-amber-300 flex items-center justify-between gap-2">
                  <span>👑 {mpStrings.onlyLeaderControlsRoom}</span>
                  {hostName && <strong className="text-amber-200 shrink-0">{hostName}</strong>}
                </div>
              )}

              {/* Conversão Global Automática em Tempo Real (Equivalência Mundial da Partida) */}
              <div className="game-subplate rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="text-amber-400 font-bold uppercase tracking-wider truncate">
                    🌐 {t.betting.parityTitle}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${
                      fxState.isLive
                        ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {t.betting.parityLiveBadge}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-snug">{t.betting.paritySub}</p>
                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  {parityItems.map((item) => (
                    <div
                      key={item.currency}
                      className={`px-1.5 py-1 rounded-lg border text-[10px] font-mono flex items-center justify-between gap-1 ${
                        item.currency === currency
                          ? 'bg-amber-500/15 border-amber-400/70 text-amber-200 font-black'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <span>{item.flag}</span>
                      <span className="truncate tabular-nums">{item.formatted}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chips Rápidos na moeda do utilizador */}
              <div className="grid grid-cols-7 gap-1 pt-0.5">
                {quickChips.map((chip, idx) => {
                  const isActive = Math.abs(betAmountKz - chip.kz) <= Math.max(2, chip.kz * 0.01);
                  return (
                    <button
                      key={`${currency}-${idx}`}
                      type="button"
                      disabled={isMultiplayerGuest}
                      onClick={() => handleChipClick(chip.kz)}
                      className={`py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all border cursor-pointer truncate px-0.5 disabled:opacity-45 disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 border-amber-300 font-black shadow-sm'
                          : 'bg-zinc-950/90 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* As 3 Torneiras do Rei (Distribuição Matemática Oficial) */}
            <div className="p-3 game-subplate rounded-xl border border-amber-500/30 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">
                  {t.betting.totalPotLabel} {formatMoney(betAmountKz)}):
                </span>
                <span className="font-black text-amber-300 text-sm">
                  {formatMoney(torneiras.totalPotKz)}
                </span>
              </div>

              {/* Barra Visual Proporcional 70% / 20% / 10% */}
              <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-zinc-900 border border-white/5">
                <div className="h-full bg-emerald-500" style={{ width: '70%' }} />
                <div className="h-full bg-slate-500" style={{ width: '20%' }} />
                <div className="h-full bg-amber-400" style={{ width: '10%' }} />
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center font-mono">
                <div className="game-panel p-2 rounded-lg border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-400 font-bold block">
                    {t.betting.winners70}
                  </span>
                  <span className="text-xs font-black text-emerald-300">
                    {formatMoney(torneiras.winnersPotKz)}
                  </span>
                </div>
                <div className="game-panel p-2 rounded-lg border border-zinc-700/60">
                  <span className="text-[10px] text-zinc-400 font-bold block">
                    {t.betting.house20}
                  </span>
                  <span className="text-xs font-black text-zinc-200">
                    {formatMoney(torneiras.houseFeeKz)}
                  </span>
                </div>
                <div className="game-panel p-2 rounded-lg border border-amber-500/40">
                  <span className="text-[10px] text-amber-400 font-bold block">
                    {t.betting.creator10}
                  </span>
                  <span className="text-xs font-black text-amber-300">
                    {formatMoney(torneiras.creatorRoyaltyKz)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/10 pt-1.5 font-mono gap-1">
                <span>
                  {t.betting.firstLabel}{' '}
                  <strong className="text-emerald-400">{formatMoney(torneiras.firstPrizeKz)}</strong>
                </span>
                <span>
                  {t.betting.secondLabel}{' '}
                  <strong className="text-emerald-400">{formatMoney(torneiras.secondPrizeKz)}</strong>
                </span>
                <span className="text-zinc-500 truncate">{t.betting.fourthFifthLose}</span>
              </div>
            </div>

            {balanceKz < betAmountKz && (
              <div className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[11px] font-mono text-rose-300 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span>{t.betting.insufficientBalance}</span>
                  <div className="flex items-center gap-2">
                    {isDemo && onRechargeDemo && (
                      <button
                        type="button"
                        onClick={onRechargeDemo}
                        className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 font-black text-amber-300 hover:bg-amber-500/30 cursor-pointer shrink-0"
                      >
                        {t.header.addDemoBtn}
                      </button>
                    )}
                    {balanceKz >= MIN_BET_KZ && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingInput(false);
                          setInputRangeError(null);
                          onBetChange(Math.floor(balanceKz));
                        }}
                        className="font-black text-amber-300 hover:underline cursor-pointer shrink-0"
                      >
                        {t.betting.useMax} ({formatMoney(balanceKz)})
                      </button>
                    )}
                  </div>
                </div>
                {!isDemo && balanceKz <= 0 && (
                  <span className="text-[10px] text-amber-300/90 leading-snug">
                    {t.betting.realZeroHint}
                  </span>
                )}
              </div>
            )}

            {waitingForOpponent && (
              <div className="p-3 rounded-xl bg-amber-500/15 border-2 border-amber-400 text-amber-200 text-xs font-mono font-bold flex flex-col gap-1 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">⏳</span>
                  <span>{mpStrings.waitingOpponentSelecting}</span>
                </div>
                {waitingOpponentNames.length > 0 && (
                  <span className="text-[11px] text-amber-300 pl-6">
                    {mpStrings.waitingOpponentNamesPrefix} {waitingOpponentNames.join(', ')}
                  </span>
                )}
              </div>
            )}

            {/* Botão de Disputa */}
            <motion.button
              whileHover={{ scale: isMultiplayerGuest ? 1 : 1.015 }}
              whileTap={{ scale: isMultiplayerGuest ? 1 : 0.985 }}
              type="button"
              onClick={onStartRound}
              disabled={balanceKz < betAmountKz || Boolean(inputRangeError) || isMultiplayerGuest}
              className="w-full py-4 rounded-xl font-black text-base game-btn-gold flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed px-2 text-center"
            >
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-950 flex items-center gap-1.5">
                <span>👑</span>{' '}
                {isMultiplayerGuest
                  ? mpStrings.waitingHostToStartBtn
                  : t.betting.ctaTop}
              </span>
              <span className="text-lg font-mono font-black">
                {t.betting.ctaBottom} {formatMoney(betAmountKz)}
              </span>
            </motion.button>
          </motion.div>
        ) : isStarting ? (
          // Contagem Regressiva
          <motion.div
            key="starting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 gap-3 game-subplate rounded-xl border border-amber-500/40 text-center px-3"
          >
            <span className="text-4xl animate-bounce">👑</span>
            <h4 className="text-base font-black uppercase text-amber-400">
              {t.betting.startingTitle}
            </h4>
            <p className="text-xs text-zinc-400">{t.betting.startingSub}</p>
          </motion.div>
        ) : (
          // ==========================================
          // PARTIDA ATIVA
          // ==========================================
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3.5"
          >
            <div className="p-4 game-subplate rounded-xl border border-amber-500/40 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">
                    {t.betting.timeToThrone}
                  </span>
                  <span className="text-3xl font-black font-mono text-amber-400 tabular-nums">
                    ⏱️ {timeLeft}s
                  </span>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">
                    {t.betting.yourPosition}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono leading-none ${
                        playerRank === 1
                          ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                          : playerRank === 2
                          ? 'text-sky-400'
                          : playerRank === 3
                          ? 'text-orange-400'
                          : playerRank === 4
                          ? 'text-zinc-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {playerRank === 1
                        ? '🥇 1'
                        : playerRank === 2
                        ? '🥈 2'
                        : playerRank === 3
                        ? '🥉 3'
                        : playerRank === 4
                        ? '⚡ 4'
                        : '⚠️ 5'}
                    </span>
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-400">
                      {playerRank === 1
                        ? t.betting.leaderTag
                        : playerRank <= 3
                        ? t.betting.podiumTag
                        : t.betting.behindTag}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra de Progresso dos 40 segundos */}
              <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-white/10">
                <div
                  className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 h-full transition-all duration-100 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  style={{ width: `${Math.min(100, (elapsedSeconds / TOTAL_GAME_TIME_SECONDS) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-white/10 font-mono">
                <span>
                  {t.betting.firstWins}{' '}
                  <strong className="text-emerald-400">{formatMoney(torneiras.firstPrizeKz)}</strong>
                </span>
                <span>
                  {t.betting.secondWins}{' '}
                  <strong className="text-emerald-400">{formatMoney(torneiras.secondPrizeKz)}</strong>
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/35 text-center text-xs text-amber-300">
              <span className="font-bold block">{t.betting.skillTipTitle}</span>
              <span className="text-[11px] text-zinc-300">{t.betting.skillTipSub}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notificação da Última Partida */}
      <AnimatePresence>
        {lastRank !== null && !isRunning && !isStarting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              lastRank <= 2
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                : 'game-subplate text-zinc-300'
            }`}
          >
            <div>
              <span className="font-black block">
                {lastRank === 1
                  ? t.betting.lastChampionTitle
                  : lastRank === 2
                  ? t.betting.lastRunnerUpTitle
                  : `${t.betting.lastFinishedPrefix} #${lastRank}`}
              </span>
              <span className="text-[10px] opacity-80">
                {lastRank <= 2 ? t.betting.lastCreditedSub : t.betting.lastTop3Sub}
              </span>
            </div>
            {lastPayoutKz !== null && lastPayoutKz > 0 && (
              <span className="font-mono font-black text-emerald-400 text-base">
                +{formatMoney(lastPayoutKz)}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
