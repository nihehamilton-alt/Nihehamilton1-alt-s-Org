import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Award, Crown, Flame, Sparkles, Trophy, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

export interface Top3CelebrationPayload {
  key: number;
  rank: 1 | 2 | 3;
  streak: number;
}

interface Top3StreakCelebrationOverlayProps {
  celebration: Top3CelebrationPayload | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

interface CelebrationSpark {
  id: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
  delay: number;
  duration: number;
  color: string;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 19.371 + 41.19) * 43758.5453;
  return x - Math.floor(x);
}

export const Top3StreakCelebrationOverlay: React.FC<Top3StreakCelebrationOverlayProps> = ({
  celebration,
  onDismiss,
  autoDismissMs = 4200,
}) => {
  const { lang } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const langCode = (lang || 'pt').slice(0, 2);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [celebration, autoDismissMs, onDismiss]);

  const copy = useMemo(() => {
    const rank = celebration?.rank ?? 1;
    const streak = celebration?.streak ?? 1;

    if (langCode === 'en') {
      const rankLabel =
        rank === 1 ? '1st Place Victory' : rank === 2 ? '2nd Place Podium' : '3rd Place Podium';
      const milestone =
        streak >= 5
          ? 'Royal Legend'
          : streak >= 3
          ? 'Unstoppable Streak'
          : streak === 2
          ? 'Heating Up'
          : 'Podium Streak Started';
      return {
        kicker: `${rankLabel} · ${milestone}`,
        streakHeadline: `${streak}x Top 3 Streak`,
        incrementLabel: '+1 Streak',
        subtext:
          streak >= 3
            ? `${streak} consecutive Top 3 finishes — keep the crown momentum alive!`
            : streak === 2
            ? 'Back-to-back Top 3 finishes! One more for an unstoppable run.'
            : 'Top 3 finish locked in! Stay on the podium next round to build your streak.',
        dismissLabel: 'Dismiss celebration',
      };
    }

    if (langCode === 'es') {
      const rankLabel =
        rank === 1 ? 'Victoria 1º Lugar' : rank === 2 ? 'Podio 2º Lugar' : 'Podio 3º Lugar';
      const milestone =
        streak >= 5
          ? 'Leyenda Real'
          : streak >= 3
          ? 'Racha Imparable'
          : streak === 2
          ? 'En Llamas'
          : 'Racha Iniciada';
      return {
        kicker: `${rankLabel} · ${milestone}`,
        streakHeadline: `Racha ${streak}x Top 3`,
        incrementLabel: '+1 Racha',
        subtext:
          streak >= 3
            ? `¡${streak} podios consecutivos en el Top 3 — mantén el ritmo campeón!`
            : streak === 2
            ? '¡Dos Top 3 seguidos! Uno más para entrar en racha imparable.'
            : '¡Top 3 asegurado! Repite podio en la próxima ronda para subir tu racha.',
        dismissLabel: 'Cerrar celebración',
      };
    }

    if (langCode === 'fr') {
      const rankLabel =
        rank === 1 ? 'Victoire 1re Place' : rank === 2 ? 'Podium 2e Place' : 'Podium 3e Place';
      const milestone =
        streak >= 5
          ? 'Légende Royale'
          : streak >= 3
          ? 'Série Inarrêtable'
          : streak === 2
          ? 'En Pleine Forme'
          : 'Série Lancée';
      return {
        kicker: `${rankLabel} · ${milestone}`,
        streakHeadline: `Série ${streak}x Top 3`,
        incrementLabel: '+1 Série',
        subtext:
          streak >= 3
            ? `${streak} podiums Top 3 consécutifs — gardez cet élan royal !`
            : streak === 2
            ? 'Deux Top 3 d’affilée ! Encore un pour une série inarrêtable.'
            : 'Top 3 validé ! Restez sur le podium au prochain tour pour prolonger la série.',
        dismissLabel: 'Fermer la célébration',
      };
    }

    const rankLabel =
      rank === 1 ? 'Vitória em 1º Lugar' : rank === 2 ? 'Pódio em 2º Lugar' : 'Pódio em 3º Lugar';
    const milestone =
      streak >= 5
        ? 'Lenda Real'
        : streak >= 3
        ? 'Sequência Imparável'
        : streak === 2
        ? 'A Aquecer'
        : 'Sequência Iniciada';
    return {
      kicker: `${rankLabel} · ${milestone}`,
      streakHeadline: `${streak}x Seguidas no Top 3`,
      incrementLabel: '+1 Sequência',
      subtext:
        streak >= 3
          ? `${streak} corridas seguidas no Top 3 — ritmo imparável na Marginal!`
          : streak === 2
          ? 'Dois Top 3 consecutivos! Mais um pódio para incendiar a pista.'
          : 'Chegaste ao Top 3! Mantém o pódio na próxima corrida para ampliar a sequência.',
      dismissLabel: 'Fechar celebração',
    };
  }, [celebration?.rank, celebration?.streak, langCode]);

  const theme = useMemo(() => {
    const rank = celebration?.rank ?? 1;
    if (rank === 1) {
      return {
        border: 'border-amber-300/80',
        glow: 'shadow-[0_18px_55px_-10px_rgba(245,158,11,0.55)]',
        ring: 'border-amber-400/75',
        accentText: 'text-amber-300',
        emblemBg: 'bg-gradient-to-br from-amber-400/30 via-yellow-500/20 to-orange-500/25 border-amber-300/70',
        barFill: 'bg-amber-400',
        sparkColors: ['#fde047', '#f59e0b', '#fb923c', '#ffffff'],
      };
    }
    if (rank === 2) {
      return {
        border: 'border-sky-300/75',
        glow: 'shadow-[0_18px_55px_-10px_rgba(56,189,248,0.45)]',
        ring: 'border-sky-400/75',
        accentText: 'text-sky-300',
        emblemBg: 'bg-gradient-to-br from-sky-400/30 via-cyan-500/20 to-amber-500/20 border-sky-300/70',
        barFill: 'bg-sky-400',
        sparkColors: ['#7dd3fc', '#38bdf8', '#facc15', '#ffffff'],
      };
    }
    return {
      border: 'border-orange-400/75',
      glow: 'shadow-[0_18px_55px_-10px_rgba(249,115,22,0.45)]',
      ring: 'border-orange-400/75',
      accentText: 'text-orange-300',
      emblemBg: 'bg-gradient-to-br from-orange-400/30 via-amber-500/20 to-rose-500/20 border-orange-400/70',
      barFill: 'bg-orange-400',
      sparkColors: ['#fb923c', '#f59e0b', '#fde047', '#fda4af'],
    };
  }, [celebration?.rank]);

  const sparks = useMemo<CelebrationSpark[]>(() => {
    if (!celebration || shouldReduceMotion) return [];
    const count = Math.min(26, 14 + celebration.streak * 2);
    return Array.from({ length: count }).map((_, i) => {
      const r1 = seededRandom(i + celebration.key % 97);
      const r2 = seededRandom(i * 3 + 11);
      const r3 = seededRandom(i * 7 + 29);
      const angle = (i / count) * Math.PI * 2 + (r1 - 0.5) * 0.35;
      const radius = 95 + r2 * 145;
      return {
        id: i,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * (radius * 0.52),
        size: 6 + Math.round(r3 * 6),
        rotate: (r1 - 0.5) * 320,
        delay: (i % 5) * 0.04,
        duration: 1.15 + r2 * 0.55,
        color: theme.sparkColors[i % theme.sparkColors.length],
      };
    });
  }, [celebration, shouldReduceMotion, theme.sparkColors]);

  const streakSegments = Math.max(5, Math.min(7, celebration?.streak ?? 1));

  return (
    <AnimatePresence>
      {celebration && (
        <div
          key={celebration.key}
          data-testid="top3-celebration-overlay"
          aria-live="polite"
          className="fixed inset-0 z-[60] pointer-events-none flex flex-col items-center justify-start pt-4 sm:pt-7 px-4 overflow-hidden"
        >
          {/* Radial Shockwave & Particle Burst behind the banner */}
          <div className="relative w-full max-w-md flex flex-col items-center">
            {!shouldReduceMotion && (
              <>
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0.85, scale: 0.3 }}
                  animate={{ opacity: [0.85, 0.3, 0], scale: [0.3, 1.45, 2.0] }}
                  transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute top-12 w-48 h-48 rounded-full border-2 ${theme.ring} pointer-events-none`}
                />
                <div
                  aria-hidden="true"
                  className="absolute top-14 left-1/2 -translate-x-1/2 w-0 h-0 pointer-events-none"
                >
                  {sparks.map((spark) => (
                    <motion.span
                      key={spark.id}
                      initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
                      animate={{
                        x: [0, spark.x * 0.72, spark.x],
                        y: [0, spark.y * 0.72, spark.y + 18],
                        scale: [0, 1.25, 0.75, 0],
                        opacity: [0, 1, 0.9, 0],
                        rotate: [0, spark.rotate],
                      }}
                      transition={{
                        duration: spark.duration,
                        delay: spark.delay,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{
                        position: 'absolute',
                        width: spark.size,
                        height: spark.size,
                        backgroundColor: spark.color,
                        borderRadius: spark.id % 2 === 0 ? '9999px' : '2px',
                        willChange: 'transform, opacity',
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Celebratory Top 3 Streak Card */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.88 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 360, damping: 22 }}
              className={`pointer-events-auto relative w-full game-panel-gold rounded-2xl p-4 border ${theme.border} ${theme.glow} backdrop-blur-md`}
            >
              <div className="flex items-start gap-3">
                {/* Animated Rank + Flame Emblem */}
                <motion.div
                  initial={shouldReduceMotion ? false : { scale: 0.65, rotate: -14 }}
                  animate={shouldReduceMotion ? undefined : { scale: [0.65, 1.16, 1], rotate: [ -14, 6, 0 ] }}
                  transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className={`relative w-12 h-12 rounded-xl border ${theme.emblemBg} flex items-center justify-center shrink-0`}
                >
                  {celebration.rank === 1 ? (
                    <Crown className="w-6 h-6 text-amber-300" />
                  ) : celebration.rank === 2 ? (
                    <Trophy className="w-6 h-6 text-sky-300" />
                  ) : (
                    <Award className="w-6 h-6 text-orange-300" />
                  )}
                  <motion.span
                    aria-hidden="true"
                    animate={shouldReduceMotion ? undefined : { scale: [1, 1.22, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                    className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-lg bg-zinc-950 border border-orange-400/70 flex items-center justify-center shadow"
                  >
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                  </motion.span>
                </motion.div>

                {/* Copy & Emphasized top3Streak Counter */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold text-zinc-300 truncate">
                      {copy.kicker}
                    </span>
                    <button
                      type="button"
                      onClick={onDismiss}
                      aria-label={copy.dismissLabel}
                      data-testid="top3-celebration-dismiss"
                      className="w-7 h-7 rounded-lg game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-baseline gap-2.5 mt-0.5 flex-wrap">
                    <motion.span
                      key={`streak-num-${celebration.key}-${celebration.streak}`}
                      initial={shouldReduceMotion ? false : { scale: 0.75, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.12 }}
                      data-testid="top3-celebration-streak-count"
                      className={`text-xl sm:text-2xl font-black font-display tracking-wide tabular-nums ${theme.accentText}`}
                    >
                      {copy.streakHeadline}
                    </motion.span>
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-300">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{copy.incrementLabel}</span>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-snug mt-1">{copy.subtext}</p>

                  {/* Streak Milestone Meter */}
                  <div className="mt-2.5 flex items-center gap-1.5" aria-hidden="true">
                    {Array.from({ length: streakSegments }).map((_, idx) => {
                      const active = idx < celebration.streak;
                      return (
                        <motion.span
                          key={idx}
                          initial={shouldReduceMotion ? false : { scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            duration: 0.25,
                            delay: 0.14 + idx * 0.05,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className={`h-1.5 flex-1 origin-left rounded-full ${
                            active ? theme.barFill : 'bg-zinc-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
