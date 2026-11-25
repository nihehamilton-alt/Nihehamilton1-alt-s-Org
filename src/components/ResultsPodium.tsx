import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion, Variants } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Share2, Check, LogOut, Crown } from 'lucide-react';
import {
  Competitor,
  ThreeTorneirasSplit,
  RacePerformanceMetrics,
  RoomStandingEntry,
} from '../types/game';
import { CoronationCeremony } from './CoronationCeremony';
import { CelebrationExplosion } from './CelebrationExplosion';
import { Top1GoldenBurst } from './Top1GoldenBurst';
import { FirstPlaceParticleExplosion } from './FirstPlaceParticleExplosion';
import { FirstPlaceFireworksCanvas } from './FirstPlaceFireworksCanvas';
import { ConfettiCannonCanvas } from './ConfettiCannonCanvas';
import { PerformanceAnalysisWidget } from './PerformanceAnalysisWidget';
import { AiCoachPanel } from './AiCoachPanel';
import { useI18n } from '../contexts/I18nContext';
import { sounds } from '../audio/soundEffects';
import { AvatarDoll } from './AvatarDoll';
import { getMultiplayerStrings } from '../utils/multiplayerStrings';

interface ResultsPodiumProps {
  competitors: Competitor[];
  userWonPayout: number;
  userRank: number;
  betAmountKz: number;
  threeTorneiras: ThreeTorneirasSplit;
  authoritativeRankings?: RoomStandingEntry[] | null;
  streak?: number;
  performance?: RacePerformanceMetrics | null;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  isDemo: boolean;
  showPodium?: boolean;
  canPlayAgain?: boolean;
  returnTarget?: 'room' | 'lobby';
  isSpectator?: boolean;
}

// ============================================================================
// COROA DOURADA ICÓNICA SOBRE O AVATAR DO 1º LUGAR
// ============================================================================
const GoldenCrownIconOverlay: React.FC<{
  size?: 'lg' | 'sm';
  shouldReduceMotion: boolean;
}> = ({ size = 'lg', shouldReduceMotion }) => {
  if (size === 'sm') {
    return (
      <motion.div
        initial={shouldReduceMotion ? false : { y: -8, scale: 0.4, opacity: 0 }}
        animate={
          shouldReduceMotion
            ? { y: 0, scale: 1, opacity: 1 }
            : { y: [0, -1.5, 0], scale: 1, opacity: 1 }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.1 }
            : {
                y: { repeat: Infinity, duration: 1.8, type: 'tween', ease: 'easeInOut', delay: 0.7 },
                scale: { type: 'spring', stiffness: 440, damping: 14, delay: 0.32 },
                opacity: { duration: 0.2, delay: 0.3 },
              }
        }
        aria-hidden="true"
        data-testid="first-place-crown-badge"
        className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
      >
        <span className="absolute inset-0 rounded-full bg-amber-400/50 blur-[3px]" />
        <Crown
          className="relative w-3.5 h-3.5 text-amber-300 fill-yellow-400 drop-shadow-[0_1px_4px_rgba(250,204,21,0.95)]"
          strokeWidth={2.2}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { y: -22, scale: 0.3, rotate: -14, opacity: 0 }}
      animate={
        shouldReduceMotion
          ? { y: 0, scale: 1, rotate: 0, opacity: 1 }
          : { y: [0, -4, 0], scale: 1, rotate: [0, -2, 2, 0], opacity: 1 }
      }
      transition={
        shouldReduceMotion
          ? { duration: 0.1 }
          : {
              y: { repeat: Infinity, duration: 1.9, type: 'tween', ease: 'easeInOut', delay: 0.9 },
              rotate: { repeat: Infinity, duration: 3.4, type: 'tween', ease: 'easeInOut', delay: 0.9 },
              scale: { type: 'spring', stiffness: 380, damping: 13, delay: 0.66 },
              opacity: { duration: 0.25, delay: 0.62 },
            }
      }
      aria-hidden="true"
      data-testid="first-place-golden-crown"
      className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
    >
      {/* Aura dourada radiante */}
      <motion.span
        animate={
          shouldReduceMotion
            ? undefined
            : { scale: [0.92, 1.22, 0.92], opacity: [0.45, 0.85, 0.45] }
        }
        transition={{ repeat: Infinity, duration: 2.1, type: 'tween', ease: 'easeInOut' }}
        className="absolute w-10 h-7 rounded-full bg-amber-400/50 blur-md"
      />

      {/* Brilhos laterais */}
      {!shouldReduceMotion && (
        <>
          <motion.span
            animate={{ scale: [0.6, 1.25, 0.6], opacity: [0.35, 1, 0.35] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            className="absolute -left-2.5 top-1 w-1.5 h-1.5 rounded-full bg-yellow-200 shadow-[0_0_6px_#fef08a]"
          />
          <motion.span
            animate={{ scale: [1.1, 0.5, 1.1], opacity: [0.9, 0.3, 0.9] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut', delay: 0.35 }}
            className="absolute -right-2.5 top-0.5 w-1.5 h-1.5 rounded-full bg-amber-100 shadow-[0_0_6px_#fde68a]"
          />
        </>
      )}

      {/* Coroa Dourada Metálica SVG com joias */}
      <svg
        width="38"
        height="28"
        viewBox="0 0 40 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative drop-shadow-[0_3px_10px_rgba(245,158,11,0.95)]"
      >
        <defs>
          <linearGradient id="goldenCrownGrad" x1="20" y1="3" x2="20" y2="27" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF9C3" />
            <stop offset="35%" stopColor="#FACC15" />
            <stop offset="75%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="goldenCrownRim" x1="6" y1="22" x2="34" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#B45309" />
            <stop offset="50%" stopColor="#FEF08A" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>

        {/* Corpo da coroa */}
        <path
          d="M6.5 22.5L4 9.5L12.5 15.5L20 5.5L27.5 15.5L36 9.5L33.5 22.5H6.5Z"
          fill="url(#goldenCrownGrad)"
          stroke="#78350F"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        {/* Faixa de base */}
        <rect
          x="6.2"
          y="21.5"
          width="27.6"
          height="4.4"
          rx="2.1"
          fill="url(#goldenCrownRim)"
          stroke="#78350F"
          strokeWidth="1.3"
        />

        {/* Esferas douradas nas pontas */}
        <circle cx="4" cy="8.5" r="2.1" fill="#FEF08A" stroke="#92400E" strokeWidth="1" />
        <circle cx="20" cy="4.2" r="2.6" fill="#FEF9C3" stroke="#92400E" strokeWidth="1.1" />
        <circle cx="36" cy="8.5" r="2.1" fill="#FEF08A" stroke="#92400E" strokeWidth="1" />

        {/* Joias incrustadas */}
        <polygon points="20,12.5 22.4,16 20,19.5 17.6,16" fill="#EF4444" stroke="#7F1D1D" strokeWidth="0.8" />
        <circle cx="12.2" cy="17.8" r="1.45" fill="#10B981" stroke="#064E3B" strokeWidth="0.7" />
        <circle cx="27.8" cy="17.8" r="1.45" fill="#38BDF8" stroke="#0C4A6E" strokeWidth="0.7" />

        {/* Reflexo especular */}
        <path
          d="M11 23.2H29"
          stroke="#FEF9C3"
          strokeWidth="1"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
      </svg>
    </motion.div>
  );
};

// ============================================================================
// SISTEMA DE CONFETES E PARTÍCULAS TRIUNFAIS COM FRAMER MOTION
// ============================================================================
const FramerConfettiOverlay: React.FC = () => {
  const particles = useMemo(() => {
    const emojis = ['👑', '✨', '🪙', '💎', '🎉', '🏆', '⭐'];
    const colors = ['#f59e0b', '#dc2626', '#16a34a', '#06b6d4', '#facc15', '#ec4899'];
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      isEmoji: i % 3 === 0,
      content: i % 3 === 0 ? emojis[i % emojis.length] : null,
      color: colors[i % colors.length],
      left: `${(i * 4.8) % 95}%`,
      delay: (i * 0.16) % 2.4,
      duration: 3.2 + ((i * 0.28) % 2.4),
      sway: 18 + ((i * 7) % 30),
      size: i % 3 === 0 ? 18 : 8 + ((i * 3) % 10),
      width: i % 3 === 0 ? undefined : 6 + ((i * 2) % 6),
      height: i % 3 === 0 ? undefined : 12 + ((i * 3) % 12),
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -60, x: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: ['-5vh', '115vh'],
            x: [0, p.sway, -p.sway, p.sway / 2, 0],
            opacity: [0, 1, 1, 0.8, 0],
            rotate: [0, 180, 360, 540, 720],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            left: p.left,
            top: 0,
            fontSize: p.isEmoji ? `${p.size}px` : undefined,
            width: !p.isEmoji ? `${p.width}px` : undefined,
            height: !p.isEmoji ? `${p.height}px` : undefined,
            backgroundColor: !p.isEmoji ? p.color : undefined,
            borderRadius: !p.isEmoji ? '2px' : undefined,
            willChange: 'transform, opacity',
          }}
        >
          {p.isEmoji && p.content}
        </motion.div>
      ))}
    </div>
  );
};

const PODIUM_MODAL_SPRING = {
  type: 'spring' as const,
  stiffness: 255,
  damping: 24,
  mass: 0.92,
};

const PODIUM_ITEM_SPRING = {
  type: 'spring' as const,
  stiffness: 315,
  damping: 25,
  mass: 0.82,
};

const podiumContainerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 84,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...PODIUM_MODAL_SPRING,
      when: 'beforeChildren',
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const podiumSlideUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 36,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: PODIUM_ITEM_SPRING,
  },
};

export const ResultsPodium: React.FC<ResultsPodiumProps> = ({
  competitors,
  userWonPayout,
  userRank,
  betAmountKz,
  threeTorneiras,
  authoritativeRankings = null,
  streak = 0,
  performance = null,
  onPlayAgain,
  onBackToLobby,
  isDemo: _isDemo,
  showPodium = true,
  canPlayAgain = true,
  returnTarget = 'lobby',
  isSpectator = false,
}) => {
  const { lang, t, formatMoney } = useI18n();
  const mpStrings = useMemo(() => getMultiplayerStrings(lang), [lang]);
  const shouldReduceMotion = useReducedMotion();
  const isFirstPlaceWinner = !isSpectator && userRank === 1;
  const [activeTab, setActiveTab] = useState<'ceremony' | 'podium' | 'both'>('ceremony');
  const isCeremonyCalmMode = activeTab === 'ceremony';
  const victoryRibbonLabel = useMemo(() => {
    const code = (lang || 'pt').slice(0, 2);
    if (code === 'en') return '1ST PLACE VICTORY · ROYAL CHAMPION';
    if (code === 'es') return 'VICTORIA 1º LUGAR · CAMPEÓN REAL';
    if (code === 'fr') return 'VICTOIRE 1RE PLACE · CHAMPION ROYAL';
    return 'VITÓRIA 1º LUGAR · CAMPEÃO DO TRONO';
  }, [lang]);
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied'>('idle');
  const [ceremonyFinished, setCeremonyFinished] = useState<boolean>(false);
  const [autoReturnSeconds, setAutoReturnSeconds] = useState<number | null>(null);
  const autoReturnCancelledRef = useRef<boolean>(false);
  const autoReturnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReturnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onBackToLobbyRef = useRef(onBackToLobby);
  onBackToLobbyRef.current = onBackToLobby;

  const cancelAutoReturn = useCallback(() => {
    autoReturnCancelledRef.current = true;
    if (autoReturnRef.current) {
      clearTimeout(autoReturnRef.current);
      autoReturnRef.current = null;
    }
    if (autoReturnIntervalRef.current) {
      clearInterval(autoReturnIntervalRef.current);
      autoReturnIntervalRef.current = null;
    }
    setAutoReturnSeconds(null);
  }, []);

  const handleCeremonyFinish = useCallback(() => {
    setCeremonyFinished(true);
  }, []);

  const handleCeremonyReplay = useCallback(() => {
    cancelAutoReturn();
    setCeremonyFinished(false);
  }, [cancelAutoReturn]);

  const handleManualExitToLobby = useCallback(() => {
    cancelAutoReturn();
    sounds.stopCelebrationAudio();
    onBackToLobbyRef.current();
  }, [cancelAutoReturn]);

  const [explosionKey, setExplosionKey] = useState<number>(1);
  const podiumAudioPlayedRef = useRef<boolean>(false);

  const handleTriggerExplosion = () => {
    cancelAutoReturn();
    setExplosionKey((prev) => prev + 1);
    try {
      sounds.playCelebratorySound(userRank === 1);
    } catch (e) {
      console.error('Erro ao acionar som comemorativo:', e);
    }
  };

  useEffect(() => {
    if (!showPodium) {
      podiumAudioPlayedRef.current = false;
      sounds.stopCelebrationAudio();
      return;
    }

    if (!podiumAudioPlayedRef.current) {
      podiumAudioPlayedRef.current = true;
      try {
        if (isFirstPlaceWinner) {
          if (sounds.wasVictoryFanfareTriggeredRecently()) {
            sounds.playCheeringCrowd(4.4, 0.06);
          } else {
            sounds.playFirstPlaceVictoryCelebration();
          }
        } else {
          sounds.playCelebratorySound(false);
        }
      } catch (e) {
        console.error('Erro ao acionar som comemorativo no Pódio:', e);
      }
    }

    // Efeito exclusivo de Confetes e Salvas de Vitória quando o jogador vence em 1º lugar
    if (!isFirstPlaceWinner || shouldReduceMotion) {
      return;
    }

    const championColors = ['#facc15', '#f59e0b', '#dc2626', '#16a34a', '#ffffff'];

    try {
      confetti({
        particleCount: 85,
        spread: 88,
        startVelocity: 42,
        origin: { y: 0.52 },
        colors: championColors,
        zIndex: 70,
        disableForReducedMotion: true,
      });
    } catch {
      // ignore confetti canvas error
    }

    const secondBurst = setTimeout(() => {
      try {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 62,
          startVelocity: 48,
          origin: { x: 0.02, y: 0.78 },
          colors: ['#facc15', '#dc2626', '#ffffff'],
          zIndex: 70,
          disableForReducedMotion: true,
        });
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 62,
          startVelocity: 48,
          origin: { x: 0.98, y: 0.78 },
          colors: ['#16a34a', '#facc15', '#ffffff'],
          zIndex: 70,
          disableForReducedMotion: true,
        });
      } catch {
        // ignore
      }
    }, 360);

    const thirdBurst = setTimeout(() => {
      try {
        confetti({
          particleCount: 70,
          spread: 100,
          startVelocity: 36,
          origin: { y: 0.28, x: 0.5 },
          colors: ['#facc15', '#fbbf24', '#38bdf8', '#10b981', '#f59e0b'],
          zIndex: 70,
          disableForReducedMotion: true,
        });
      } catch {
        // ignore
      }
    }, 950);

    return () => {
      clearTimeout(secondBurst);
      clearTimeout(thirdBurst);
    };
  }, [showPodium, isFirstPlaceWinner, shouldReduceMotion, explosionKey]);

  useEffect(() => {
    return () => {
      sounds.stopCelebrationAudio();
    };
  }, []);

  // Inicia contagem regressiva de encerramento após a cerimónia 3D concluir (retorno rápido em modo cerimónia)
  useEffect(() => {
    if (!showPodium || !ceremonyFinished || autoReturnCancelledRef.current) return;

    const totalWaitSec = activeTab === 'ceremony' ? 2 : 8;
    const totalWaitMs = activeTab === 'ceremony' ? 1800 : 8000;
    setAutoReturnSeconds(totalWaitSec);
    autoReturnIntervalRef.current = setInterval(() => {
      setAutoReturnSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : prev));
    }, 1000);

    autoReturnRef.current = setTimeout(() => {
      onBackToLobbyRef.current();
    }, totalWaitMs);

    return () => {
      if (autoReturnRef.current) {
        clearTimeout(autoReturnRef.current);
        autoReturnRef.current = null;
      }
      if (autoReturnIntervalRef.current) {
        clearInterval(autoReturnIntervalRef.current);
        autoReturnIntervalRef.current = null;
      }
    };
  }, [showPodium, ceremonyFinished, activeTab]);

  // Salvaguarda: caso a cerimónia 3D não emita onFinish a tempo, liberta o regresso automático
  useEffect(() => {
    if (!showPodium || ceremonyFinished) return;
    const fallbackTimer = setTimeout(() => {
      setCeremonyFinished(true);
    }, 10_000);
    return () => clearTimeout(fallbackTimer);
  }, [showPodium, ceremonyFinished]);

  const sorted = useMemo(() => {
    if (authoritativeRankings && authoritativeRankings.length > 0) {
      const compMap = new Map(competitors.map((c) => [c.id, c]));
      return [...authoritativeRankings]
        .sort((a, b) => a.rank - b.rank)
        .map((r) => {
          const existing = compMap.get(r.id);
          return (
            existing
              ? {
                  ...existing,
                  progressDistance: r.progressDistance,
                  rank: r.rank,
                }
              : {
                  id: r.id,
                  name: r.name,
                  avatar: r.avatar,
                  avatarId: r.avatarId,
                  color: r.color,
                  lane: r.lane,
                  targetLane: r.lane,
                  laneX: 0,
                  yOffset: 0,
                  progressDistance: r.progressDistance,
                  action: 'running' as const,
                  jumpY: 0,
                  isBot: r.isBot,
                  isPlayer: false,
                  stumbling: false,
                  finished: true,
                  rank: r.rank,
                }
          );
        });
    }
    return [...competitors].sort((a, b) => b.progressDistance - a.progressDistance);
  }, [authoritativeRankings, competitors]);

  const breakdownRows = useMemo(() => {
    return sorted.map((runner, idx) => {
      const rank = idx + 1;
      const auth = authoritativeRankings?.find((a) => a.id === runner.id);
      const runnerBet = auth?.betAmount ?? betAmountKz;
      const runnerPayout =
        auth?.payoutKz ??
        (rank === 1
          ? threeTorneiras.firstPrizeKz
          : rank === 2
          ? threeTorneiras.secondPrizeKz
          : 0);
      return {
        runner,
        rank,
        betAmount: runnerBet,
        payoutKz: runnerPayout,
      };
    });
  }, [sorted, authoritativeRankings, betAmountKz, threeTorneiras.firstPrizeKz, threeTorneiras.secondPrizeKz]);

  const netResultKz = userWonPayout - betAmountKz;

  const renderRunnerName = (comp: Competitor) => {
    if (!comp.isPlayer || comp.name.includes(t.youTag)) return comp.name;
    return `${comp.name} ${t.youTag}`;
  };

  // Função para Partilhar Resultado (Share Result) via Web Share API com fallback
  const handleShareResult = async () => {
    cancelAutoReturn();

    const player = competitors.find((c) => c.isPlayer) || sorted.find((c) => c.isPlayer);
    const playerDist = player ? Math.floor(player.progressDistance) : 0;
    const shareUrl =
      typeof window !== 'undefined' ? window.location.href : 'https://reirun.ao';

    const prizeStr =
      userWonPayout > 0 ? `${t.podium.prizeLabel}: +${formatMoney(userWonPayout)}` : '';

    const headline = t.podium.shareTemplate
      .replace('{rank}', String(userRank))
      .replace('{streak}', String(streak))
      .replace('{prize}', prizeStr)
      .replace('{dist}', String(playerDist));

    const shareMessage = `${headline}\n👑 ${t.officialPhrase}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Rei Run — ${t.podium.shareBtn}`,
          text: shareMessage,
          url: shareUrl,
        });
        setShareState('shared');
        try {
          sounds.playCoin();
        } catch {}
        setTimeout(() => setShareState('idle'), 3000);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }

    const clipboardText = `${shareMessage}\n${shareUrl}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = clipboardText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setShareState('copied');
      try {
        sounds.playCoin();
      } catch {}
      setTimeout(() => setShareState('idle'), 3000);
    } catch (err) {
      console.warn('Erro ao partilhar/copiar resultado:', err);
    }
  };

  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  const rankBackdropClass =
    userRank === 1
      ? 'podium-bg-rank-1'
      : userRank === 2
      ? 'podium-bg-rank-2'
      : userRank === 3
      ? 'podium-bg-rank-3'
      : 'podium-bg-rank-other';

  const rankModalAccentClass =
    userRank === 1
      ? 'border-amber-400/80 shadow-[0_0_95px_rgba(245,158,11,0.46)]'
      : userRank === 2
      ? 'border-slate-300/60 shadow-[0_0_70px_rgba(148,163,184,0.32)]'
      : userRank === 3
      ? 'border-amber-600/65 shadow-[0_0_55px_rgba(217,119,6,0.26)]'
      : 'border-zinc-700/70 shadow-[0_0_40px_rgba(24,24,27,0.7)]';

  const skipVerticalMotion = Boolean(shouldReduceMotion) || isCeremonyCalmMode;

  return (
    <motion.div
      initial={skipVerticalMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden podium-bg-base ${
        isCeremonyCalmMode ? 'podium-ceremony-still' : rankBackdropClass
      }`}
    >
      {showPodium && isFirstPlaceWinner && (
        <>
          <ConfettiCannonCanvas burstKey={explosionKey} />
          {!shouldReduceMotion && <FramerConfettiOverlay />}
          <FirstPlaceParticleExplosion burstKey={explosionKey} />
          {!isCeremonyCalmMode && (
            <>
              <div aria-hidden="true" className="podium-rank1-shimmer" />
              <div aria-hidden="true" className="podium-rank1-flare" />
              <div aria-hidden="true" className="podium-rank1-glint" />
              <FirstPlaceFireworksCanvas burstKey={explosionKey} />
              <CelebrationExplosion key={explosionKey} playAudio={false} />
            </>
          )}
        </>
      )}

      <motion.div
        variants={skipVerticalMotion ? undefined : podiumContainerVariants}
        initial={skipVerticalMotion ? { opacity: 1 } : 'hidden'}
        animate={skipVerticalMotion ? { opacity: 1 } : 'visible'}
        exit={skipVerticalMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
        className={`relative z-10 game-panel-gold rounded-3xl max-w-2xl w-full p-4 sm:p-6 flex flex-col gap-3.5 text-zinc-100 my-auto max-h-[92vh] overflow-y-auto overscroll-contain ${rankModalAccentClass}`}
      >
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-72 h-36 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none" />

        {!isCeremonyCalmMode && !isSpectator && userRank === 1 && (
          <Top1GoldenBurst burstKey={explosionKey} variant="overlay" />
        )}

        {/* Botões de Ação no topo direito */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          {!isSpectator && (
            <button
              type="button"
              onClick={handleShareResult}
              className={`p-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold shadow ${
                shareState !== 'idle'
                  ? 'bg-emerald-950/90 border border-emerald-400 text-emerald-300'
                  : 'game-btn-secondary text-amber-300 hover:text-amber-200'
              }`}
              title={t.podium.shareBtn}
            >
              {shareState !== 'idle' ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Share2 size={14} />
              )}
              <span className="hidden sm:inline">
                {shareState === 'shared'
                  ? t.podium.sharedBtn
                  : shareState === 'copied'
                  ? t.podium.copiedBtn
                  : t.podium.shareBtn}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleManualExitToLobby}
            className="p-2 px-2.5 rounded-xl game-btn-secondary text-zinc-300 hover:text-amber-300 cursor-pointer flex items-center gap-1 text-xs font-mono"
            title={t.podium.mainMenuBtn}
          >
            <span>✕</span>
            <span className="hidden sm:inline">{t.podium.mainMenuBtn}</span>
          </button>
        </div>

        {!isCeremonyCalmMode && !isSpectator && userRank === 1 && (
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-[radial-gradient(circle,rgba(245,158,11,0.08)_0%,transparent_65%)] pointer-events-none -z-10"
          />
        )}

        {/* 1. Header com Coroa Real */}
        <motion.div
          variants={skipVerticalMotion ? undefined : podiumSlideUpVariants}
          className="flex flex-col items-center text-center relative z-10 pt-6 sm:pt-0"
        >
          {isFirstPlaceWinner && (
            <motion.div
              key={`victory-ribbon-${explosionKey}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: -16, scale: 0.84 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.06 }}
              className="mb-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/25 via-yellow-400/30 to-amber-500/25 border border-amber-300/75 text-amber-200 text-[10px] sm:text-[11px] font-mono font-black tracking-widest uppercase shadow-[0_0_24px_rgba(250,204,21,0.4)]"
            >
              <span aria-hidden="true">🏆</span>
              <span>{victoryRibbonLabel}</span>
              <span aria-hidden="true">✨</span>
            </motion.div>
          )}

          <motion.div
            initial={skipVerticalMotion ? false : { y: 26, scale: 0.55, opacity: 0, rotate: -18 }}
            animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.08 }}
            className="relative mb-1"
          >
            {isFirstPlaceWinner && !shouldReduceMotion && (
              <motion.span
                aria-hidden="true"
                animate={{ scale: [0.95, 1.35, 0.95], opacity: [0.35, 0.85, 0.35] }}
                transition={{ repeat: Infinity, duration: 2.1, ease: 'easeInOut' }}
                className="absolute inset-0 -m-2 rounded-full bg-amber-400/30 blur-md pointer-events-none"
              />
            )}
            <span className="relative text-4xl sm:text-5xl filter drop-shadow-[0_0_20px_rgba(245,158,11,0.9)]">
              {isSpectator ? '👻' : '👑'}
            </span>
            {isFirstPlaceWinner && (
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.8, type: 'tween', ease: 'easeInOut' }}
                className="absolute -top-1 -right-2 text-xl"
              >
                ✨
              </motion.span>
            )}
          </motion.div>

          <motion.h2
            initial={skipVerticalMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...PODIUM_ITEM_SPRING, delay: 0.12 }}
            className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider text-amber-400 font-sans"
          >
            {isSpectator
              ? first
                ? `🏆 ${first.name}`
                : mpStrings.spectatorResultsBadge
              : userRank === 1
              ? t.podium.rank1Title
              : userRank === 2
              ? t.podium.rank2Title
              : userRank === 3
              ? t.podium.rank3Title
              : `${t.podium.rankOtherPrefix} #${userRank}`}
          </motion.h2>

          <motion.p
            initial={skipVerticalMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...PODIUM_ITEM_SPRING, delay: 0.16 }}
            className="text-[11px] font-mono text-zinc-400 mt-0.5"
          >
            &quot;{t.officialPhrase}&quot;
          </motion.p>

          {isSpectator ? (
            <div className="my-2 px-4 py-1.5 rounded-xl bg-sky-950/75 border border-sky-400/55 text-sky-200 text-xs font-mono font-bold flex flex-col items-center gap-0.5">
              <span>👻 {mpStrings.spectatorResultsBadge}</span>
              <span className="text-[10px] text-sky-300/90 font-normal">
                {mpStrings.noBetSpectatorNote}
              </span>
            </div>
          ) : (
            <>
              {streak > 0 && (
                <motion.div
                  initial={isCeremonyCalmMode ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.28, type: 'spring' }}
                  className={`my-1 px-3.5 py-1 rounded-full border flex items-center gap-1.5 font-mono text-xs font-bold ${
                    streak >= 3
                      ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-red-500/25 border-orange-400 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                      : 'game-subplate border-amber-500/40 text-amber-300'
                  }`}
                >
                  <span className="text-sm">🔥</span>
                  <span>
                    {t.podium.streakLabel} <strong>{streak}x {t.podium.consecutiveSuffix}</strong>
                  </span>
                  {streak >= 3 && (
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black">
                      {t.podium.hotBadge}
                    </span>
                  )}
                </motion.div>
              )}

              {userWonPayout > 0 ? (
                <motion.div
                  initial={isCeremonyCalmMode ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.35, type: 'spring' }}
                  className="my-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-emerald-900/60 to-emerald-950/90 border border-emerald-400/60 text-emerald-300 flex items-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {t.podium.prizeLabel} (#{userRank}):
                  </span>
                  <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                    +{formatMoney(userWonPayout)}
                  </span>
                </motion.div>
              ) : (
                <div className="my-1.5 px-3 py-1 rounded-xl game-subplate text-xs text-zinc-400 font-mono">
                  {t.podium.finishedInSub} <strong className="text-amber-400 font-bold">#{userRank}</strong>
                </div>
              )}

              {/* Resumo Financeiro da Tua Partida: Apostaste · Ganhaste · Saldo Líquido */}
              <div className="w-full grid grid-cols-3 gap-2 my-1 font-mono">
                <div className="p-2 rounded-xl game-subplate border border-zinc-700/70 flex flex-col items-center">
                  <span className="text-[9px] uppercase text-zinc-400 font-bold">
                    {mpStrings.youBetLabel}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-zinc-100 tabular-nums">
                    {formatMoney(betAmountKz)}
                  </span>
                </div>
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center ${
                    userWonPayout > 0
                      ? 'bg-emerald-950/75 border-emerald-500/50'
                      : 'game-subplate border-zinc-700/70'
                  }`}
                >
                  <span className="text-[9px] uppercase text-zinc-400 font-bold">
                    {mpStrings.youWonLabel}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-black tabular-nums ${
                      userWonPayout > 0 ? 'text-emerald-400' : 'text-zinc-400'
                    }`}
                  >
                    {userWonPayout > 0 ? `+${formatMoney(userWonPayout)}` : formatMoney(0)}
                  </span>
                </div>
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center ${
                    netResultKz > 0
                      ? 'bg-amber-500/15 border-amber-400/60'
                      : netResultKz === 0
                      ? 'game-subplate border-zinc-700/70'
                      : 'bg-rose-950/50 border-rose-500/40'
                  }`}
                >
                  <span className="text-[9px] uppercase text-zinc-400 font-bold">
                    {mpStrings.netResultLabel}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-black tabular-nums ${
                      netResultKz > 0
                        ? 'text-amber-300'
                        : netResultKz === 0
                        ? 'text-zinc-200'
                        : 'text-rose-400'
                    }`}
                  >
                    {netResultKz > 0 ? '+' : ''}
                    {formatMoney(netResultKz)}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Seletor de visualização */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 game-subplate p-1 rounded-xl border border-amber-500/35 text-xs font-mono mt-1">
            <button
              onClick={() => {
                cancelAutoReturn();
                setActiveTab('both');
              }}
              type="button"
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'both'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.podium.tabFull}
            </button>
            <button
              onClick={() => {
                cancelAutoReturn();
                setActiveTab('ceremony');
              }}
              type="button"
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'ceremony'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.podium.tabCeremony}
            </button>
            <button
              onClick={() => {
                cancelAutoReturn();
                setActiveTab('podium');
              }}
              type="button"
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'podium'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.podium.tabPodium}
            </button>
            {(isFirstPlaceWinner || (!isCeremonyCalmMode && !isSpectator)) && (
              <button
                onClick={handleTriggerExplosion}
                type="button"
                className="px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 flex items-center gap-1 active:scale-95"
              >
                {t.podium.explodeBtn}
              </button>
            )}
          </div>
        </motion.div>

        {(activeTab === 'ceremony' || activeTab === 'both') && first && (
          <motion.div
            variants={skipVerticalMotion ? undefined : podiumSlideUpVariants}
            className="relative z-10"
          >
            <CoronationCeremony
              winner={first}
              onFinish={handleCeremonyFinish}
              onReplayRequest={handleCeremonyReplay}
            />
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {(activeTab === 'podium' || activeTab === 'both') && (
            <motion.div
              key={`podium-stage-${activeTab}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="relative z-10 pt-5 pb-1"
            >
              <div className="flex items-end justify-center gap-2 sm:gap-3 h-56 sm:h-64 relative">
                {/* Base luminosa do palco */}
                <div
                  aria-hidden="true"
                  className="absolute bottom-0 left-4 right-4 h-3 rounded-full bg-gradient-to-r from-transparent via-amber-400/30 to-transparent blur-sm pointer-events-none"
                />

                {second && (
                  <div className="flex-1 flex flex-col items-center max-w-[145px] relative">
                    <motion.div
                      initial={
                        shouldReduceMotion
                          ? false
                          : { y: 78, opacity: 0, scale: 0.42, rotate: -8 }
                      }
                      animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 265,
                        damping: 15,
                        mass: 0.9,
                        delay: shouldReduceMotion ? 0 : 0.36,
                      }}
                      className="flex flex-col items-center mb-1.5 text-center z-10"
                    >
                      <motion.div
                        initial={shouldReduceMotion ? false : { y: 16, scale: 0.65 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 320,
                          damping: 13,
                          delay: shouldReduceMotion ? 0 : 0.42,
                        }}
                        className="relative"
                      >
                        <AvatarDoll
                          avatarId={second.avatarId}
                          name={second.name}
                          color={second.color}
                          size={42}
                          variant="full"
                          className="filter drop-shadow-[0_6px_12px_rgba(148,163,184,0.35)]"
                        />
                        <motion.span
                          initial={shouldReduceMotion ? false : { scale: 0, rotate: -30 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 14,
                            delay: shouldReduceMotion ? 0 : 0.56,
                          }}
                          className="absolute -bottom-1 -right-1 text-xs"
                        >
                          🥈
                        </motion.span>
                      </motion.div>
                      <span className="text-[11px] font-black text-zinc-200 truncate w-full mt-0.5">
                        {renderRunnerName(second)}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {Math.floor(second.progressDistance)}m · {mpStrings.stakePerRunnerShort}:{' '}
                        {formatMoney(breakdownRows[1]?.betAmount ?? betAmountKz)}
                      </span>
                      <span className="text-[11px] font-mono font-black text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-800 mt-0.5">
                        +{formatMoney(breakdownRows[1]?.payoutKz ?? threeTorneiras.secondPrizeKz)}
                      </span>
                    </motion.div>

                    <motion.div
                      initial={shouldReduceMotion ? false : { scaleY: 0, y: 20, opacity: 0 }}
                      animate={{ scaleY: 1, y: 0, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        damping: 18,
                        stiffness: 230,
                        delay: shouldReduceMotion ? 0 : 0.22,
                      }}
                      style={{ originY: 1 }}
                      className="w-full h-22 sm:h-26 bg-gradient-to-t from-zinc-800 via-slate-700 to-slate-600 rounded-t-2xl border-t-2 border-x border-slate-400/60 shadow-lg flex flex-col items-center justify-center p-1 relative overflow-hidden"
                    >
                      <div className="text-2xl sm:text-3xl font-black font-mono text-slate-200">
                        2
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-300">
                        {t.podium.secondPlace}
                      </span>
                      <span className="text-[8px] font-mono text-slate-400">20%</span>
                    </motion.div>
                  </div>
                )}

                {first && (
                  <div className="flex-1 flex flex-col items-center max-w-[160px] relative">
                    {userRank === 1 && (
                      <Top1GoldenBurst burstKey={explosionKey} variant="pedestal" />
                    )}

                    <motion.div
                      animate={
                        shouldReduceMotion
                          ? undefined
                          : {
                              scale: [1, 1.25, 1],
                              opacity: [0.4, 0.85, 0.4],
                            }
                      }
                      transition={{ repeat: Infinity, duration: 2.2, type: 'tween', ease: 'easeInOut' }}
                      className="absolute top-2 w-28 h-28 bg-amber-400/30 rounded-full blur-2xl pointer-events-none"
                    />

                    {/* Onda dourada ao aterrar no degrau do 1º lugar */}
                    {!shouldReduceMotion && (
                      <motion.div
                        initial={{ scale: 0.45, opacity: 0 }}
                        animate={{ scale: [0.5, 1.45, 1.75], opacity: [0, 0.75, 0] }}
                        transition={{ duration: 0.85, delay: 0.62, ease: 'easeOut' }}
                        className="absolute top-10 w-20 h-20 rounded-full border-2 border-amber-300/70 pointer-events-none"
                      />
                    )}

                    <motion.div
                      initial={
                        shouldReduceMotion
                          ? false
                          : { y: 108, opacity: 0, scale: 0.34, rotate: -10 }
                      }
                      animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 245,
                        damping: 13,
                        mass: 0.96,
                        delay: shouldReduceMotion ? 0 : 0.52,
                      }}
                      className="flex flex-col items-center mb-1.5 text-center z-10"
                    >
                      <motion.div
                        initial={shouldReduceMotion ? false : { y: 20, scale: 0.55 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 310,
                          damping: 12,
                          delay: shouldReduceMotion ? 0 : 0.58,
                        }}
                        className="relative mt-2"
                      >
                        <GoldenCrownIconOverlay
                          size="lg"
                          shouldReduceMotion={Boolean(shouldReduceMotion)}
                        />
                        <AvatarDoll
                          avatarId={first.avatarId}
                          name={first.name}
                          color={first.color}
                          size={52}
                          variant="full"
                          className="filter drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]"
                        />
                        <motion.span
                          initial={shouldReduceMotion ? false : { scale: 0, rotate: 25 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 12,
                            delay: shouldReduceMotion ? 0 : 0.74,
                          }}
                          className="absolute -bottom-1 -right-1 text-sm"
                        >
                          🏆
                        </motion.span>
                      </motion.div>

                      <span className="text-xs font-black text-amber-300 truncate w-full mt-0.5">
                        {renderRunnerName(first)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {Math.floor(first.progressDistance)}m · {mpStrings.stakePerRunnerShort}:{' '}
                        {formatMoney(breakdownRows[0]?.betAmount ?? betAmountKz)}
                      </span>
                      <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-md border border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)] mt-0.5">
                        +{formatMoney(breakdownRows[0]?.payoutKz ?? threeTorneiras.firstPrizeKz)}
                      </span>
                    </motion.div>

                    <motion.div
                      initial={shouldReduceMotion ? false : { scaleY: 0, y: 24, opacity: 0 }}
                      animate={{ scaleY: 1, y: 0, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        damping: 16,
                        stiffness: 215,
                        delay: shouldReduceMotion ? 0 : 0.3,
                      }}
                      style={{ originY: 1 }}
                      className="w-full h-28 sm:h-32 bg-gradient-to-t from-amber-950 via-yellow-700 to-amber-500 rounded-t-2xl border-t-2 border-x border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.4)] flex flex-col items-center justify-center p-1 relative overflow-hidden"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
                      />
                      <div className="text-3xl sm:text-4xl font-black font-mono text-zinc-950 drop-shadow">
                        1
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider font-black text-amber-950">
                        {t.podium.championBadge}
                      </span>
                      <span className="text-[8px] font-mono text-amber-950/80 font-bold">50%</span>
                    </motion.div>
                  </div>
                )}

                {third && (
                  <div className="flex-1 flex flex-col items-center max-w-[145px] relative">
                    <motion.div
                      initial={
                        shouldReduceMotion
                          ? false
                          : { y: 66, opacity: 0, scale: 0.45, rotate: 8 }
                      }
                      animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 270,
                        damping: 15,
                        mass: 0.88,
                        delay: shouldReduceMotion ? 0 : 0.22,
                      }}
                      className="flex flex-col items-center mb-1.5 text-center z-10"
                    >
                      <motion.div
                        initial={shouldReduceMotion ? false : { y: 14, scale: 0.65 }}
                        animate={{ y: 0, scale: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 320,
                          damping: 14,
                          delay: shouldReduceMotion ? 0 : 0.28,
                        }}
                        className="relative"
                      >
                        <AvatarDoll
                          avatarId={third.avatarId}
                          name={third.name}
                          color={third.color}
                          size={40}
                          variant="full"
                          className="filter drop-shadow-[0_6px_12px_rgba(217,119,6,0.35)]"
                        />
                        <motion.span
                          initial={shouldReduceMotion ? false : { scale: 0, rotate: 20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 14,
                            delay: shouldReduceMotion ? 0 : 0.42,
                          }}
                          className="absolute -bottom-1 -right-1 text-xs"
                        >
                          🥉
                        </motion.span>
                      </motion.div>
                      <span className="text-[11px] font-black text-zinc-200 truncate w-full mt-0.5">
                        {renderRunnerName(third)}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {Math.floor(third.progressDistance)}m · {mpStrings.stakePerRunnerShort}:{' '}
                        {formatMoney(breakdownRows[2]?.betAmount ?? betAmountKz)}
                      </span>
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800/80 mt-0.5">
                        {t.podium.honorBadge}
                      </span>
                    </motion.div>

                    <motion.div
                      initial={shouldReduceMotion ? false : { scaleY: 0, y: 18, opacity: 0 }}
                      animate={{ scaleY: 1, y: 0, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        damping: 18,
                        stiffness: 235,
                        delay: shouldReduceMotion ? 0 : 0.12,
                      }}
                      style={{ originY: 1 }}
                      className="w-full h-16 sm:h-20 bg-gradient-to-t from-amber-950 via-yellow-900 to-yellow-800 rounded-t-2xl border-t-2 border-x border-amber-600/70 shadow-md flex flex-col items-center justify-center p-1 relative overflow-hidden"
                    >
                      <div className="text-xl sm:text-2xl font-black font-mono text-amber-200">
                        3
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-amber-300">
                        {t.podium.thirdPlace}
                      </span>
                      <span className="text-[8px] font-mono text-amber-400/80">
                        {t.podium.honorBadge}
                      </span>
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabela Completa: Quanto Cada Corredor Apostou e Ganhou */}
        <motion.div
          variants={skipVerticalMotion ? undefined : podiumSlideUpVariants}
          className="game-subplate rounded-2xl p-3 flex flex-col gap-2 font-mono text-xs border border-amber-500/25"
        >
          <div className="flex items-center justify-between text-[10px] text-amber-400 uppercase tracking-wider font-black px-1">
            <span>💰 {mpStrings.breakdownTitle}</span>
            <span className="text-zinc-400">
              {breakdownRows.length} {t.lobby.playersSuffix}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[9px] uppercase text-zinc-500 font-bold border-b border-white/10">
            <span className="col-span-5">{mpStrings.colRunner}</span>
            <span className="col-span-2 text-right">{mpStrings.colDistance}</span>
            <span className="col-span-2 text-right">{mpStrings.colBet}</span>
            <span className="col-span-3 text-right">{mpStrings.colWon}</span>
          </div>

          <div className="flex flex-col gap-1">
            {breakdownRows.map(({ runner, rank, betAmount: rBet, payoutKz }, idx) => (
              <motion.div
                key={runner.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 28, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 290,
                  damping: 20,
                  mass: 0.85,
                  delay: shouldReduceMotion ? 0 : 0.14 + idx * 0.08,
                }}
                className={`grid grid-cols-12 gap-1 items-center px-2 py-1.5 rounded-xl border ${
                  runner.isPlayer
                    ? 'bg-amber-500/15 border-amber-400/60 text-amber-100'
                    : rank <= 2
                    ? 'bg-emerald-950/35 border-emerald-500/30 text-zinc-200'
                    : 'game-panel border-zinc-800/80 text-zinc-300'
                }`}
              >
                <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                  <motion.span
                    initial={shouldReduceMotion ? false : { scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 15,
                      delay: shouldReduceMotion ? 0 : 0.22 + idx * 0.08,
                    }}
                    className={`text-[10px] font-black w-4 shrink-0 ${
                      rank === 1
                        ? 'text-amber-400'
                        : rank === 2
                        ? 'text-sky-400'
                        : rank === 3
                        ? 'text-orange-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}º`}
                  </motion.span>
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? false
                        : { y: 24, scale: 0.35, opacity: 0, rotate: -14 }
                    }
                    animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 340,
                      damping: 14,
                      mass: 0.8,
                      delay: shouldReduceMotion ? 0 : 0.18 + idx * 0.08,
                    }}
                    className="relative shrink-0"
                  >
                    {rank === 1 && (
                      <GoldenCrownIconOverlay
                        size="sm"
                        shouldReduceMotion={Boolean(shouldReduceMotion)}
                      />
                    )}
                    <AvatarDoll
                      avatarId={runner.avatarId}
                      name={runner.name}
                      color={runner.color}
                      size={20}
                      variant="bust"
                    />
                  </motion.div>
                  <span className="truncate font-sans font-bold text-[11px]">
                    {renderRunnerName(runner)}
                  </span>
                </div>
                <span className="col-span-2 text-right text-[10px] text-zinc-400 tabular-nums">
                  {Math.floor(runner.progressDistance)}m
                </span>
                <span className="col-span-2 text-right text-[10px] text-zinc-300 tabular-nums">
                  {formatMoney(rBet)}
                </span>
                <span
                  className={`col-span-3 text-right text-[11px] font-black tabular-nums ${
                    payoutKz > 0 ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {payoutKz > 0 ? `+${formatMoney(payoutKz)}` : formatMoney(0)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Widget Análise de Desempenho com Framer Motion */}
        {performance && (
          <motion.div variants={skipVerticalMotion ? undefined : podiumSlideUpVariants}>
            <PerformanceAnalysisWidget
              performance={performance}
              userRank={userRank}
              onInteract={cancelAutoReturn}
            />
          </motion.div>
        )}

        {/* Coach IA Tático com Gemini */}
        <motion.div variants={skipVerticalMotion ? undefined : podiumSlideUpVariants}>
          <AiCoachPanel
            playerName={
              competitors.find((c) => c.isPlayer)?.name || 'Corredor'
            }
            avatarName={
              competitors.find((c) => c.isPlayer)?.avatarId || 'rei-zero'
            }
            performance={performance}
            userRank={userRank}
            mode="post-race"
            onInteract={cancelAutoReturn}
          />
        </motion.div>

        <motion.div
          variants={skipVerticalMotion ? undefined : podiumSlideUpVariants}
          className="game-subplate p-2.5 rounded-2xl border border-amber-500/35 flex flex-wrap items-center justify-between text-[11px] font-mono gap-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">
              {t.podium.potSummary} {formatMoney(threeTorneiras.totalPotKz)}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-emerald-400">
              {t.podium.winnersShare} ({formatMoney(threeTorneiras.winnersPotKz)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">{t.podium.houseShare}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-amber-400 font-bold">
              {t.podium.creatorShare} ({formatMoney(threeTorneiras.creatorRoyaltyKz)})
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={skipVerticalMotion ? undefined : podiumSlideUpVariants}
          className="flex flex-col gap-2 mt-0.5"
        >
          {!isSpectator && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={handleShareResult}
              className={`w-full py-2.5 px-4 rounded-2xl font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg ${
                shareState !== 'idle'
                  ? 'bg-emerald-950/90 border border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'game-btn-secondary border-amber-500/40 text-amber-300 hover:border-amber-400 hover:text-amber-200'
              }`}
            >
              {shareState !== 'idle' ? (
                <>
                  <Check size={16} className="text-emerald-400 animate-bounce" />
                  <span>
                    {shareState === 'shared' ? t.podium.sharedBtn : t.podium.copiedBtn}
                  </span>
                </>
              ) : (
                <>
                  <Share2 size={16} className="text-amber-400" />
                  <span>{t.podium.shareBtn}</span>
                </>
              )}
            </motion.button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleManualExitToLobby}
              className="py-3 px-2 rounded-2xl game-btn-secondary text-zinc-100 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🏠</span>
              <span>{t.podium.mainMenuBtn}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => {
                cancelAutoReturn();
                sounds.stopCelebrationAudio();
                if (canPlayAgain) {
                  onPlayAgain();
                } else {
                  onBackToLobby();
                }
              }}
              className="py-3 px-2 rounded-2xl game-btn-gold text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{canPlayAgain ? '👑' : '💰'}</span>
              <span>{canPlayAgain ? t.podium.newMatchBtn : t.podium.adjustBetBtn}</span>
            </motion.button>
          </div>
          <footer className="mt-1 pt-2.5 border-t border-white/10 flex flex-col gap-2">
            {autoReturnSeconds !== null && (
              <div className="flex items-center justify-center gap-2 text-[11px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-xl py-1.5 px-3">
                <span>⏳</span>
                <span>
                  {returnTarget === 'room' ? t.podium.autoReturnRoom : t.podium.autoReturnLobby}{' '}
                  <strong className="tabular-nums">{autoReturnSeconds}s</strong>
                </span>
              </div>
            )}
            <button
              type="button"
              data-testid="exit-to-lobby-btn"
              onClick={handleManualExitToLobby}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-600/80 hover:border-amber-400/70 text-zinc-100 hover:text-amber-200 font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <LogOut size={15} className="text-amber-400" />
              <span>Sair para o Lobby</span>
            </button>
            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-400 font-mono text-center">
              <span>{t.podium.footerTip}</span>
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
