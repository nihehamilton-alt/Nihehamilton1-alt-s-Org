import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Gauge, Target, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import { RacePerformanceMetrics } from '../types/game';
import { useI18n } from '../contexts/I18nContext';

interface PerformanceAnalysisWidgetProps {
  performance: RacePerformanceMetrics | null | undefined;
  userRank?: number;
  compact?: boolean;
  onInteract?: () => void;
}

interface LocalizedPerfCopy {
  title: string;
  subtitle: string;
  reactionLabel: string;
  bestLabel: string;
  accuracyLabel: string;
  jumpPrecisionLabel: string;
  evadedLabel: string;
  hitsLabel: string;
  tipTitle: string;
  noThreats: string;
  grades: {
    elite: string;
    strong: string;
    steady: string;
    train: string;
  };
  tips: Record<RacePerformanceMetrics['actionableTipKey'], string>;
}

const PERF_COPY_PT: LocalizedPerfCopy = {
  title: 'Análise de Desempenho',
  subtitle: 'Leitura tática da sua corrida',
  reactionLabel: 'Tempo Médio de Reação',
  bestLabel: 'Melhor reflexo',
  accuracyLabel: 'Precisão de Desvios',
  jumpPrecisionLabel: 'Saltos & Especiais',
  evadedLabel: 'Desviados',
  hitsLabel: 'Impactos',
  tipTitle: 'Como Melhorar',
  noThreats: 'Pista livre',
  grades: {
    elite: 'Reflexo Real',
    strong: 'Ritmo Forte',
    steady: 'Em Evolução',
    train: 'Foco na Pista',
  },
  tips: {
    'clean-master': 'Corrida limpa sem colisões! Use o Dash (duplo toque) nas retas livres para ganhar metros extra.',
    'fast-reflex': 'Antecipe os obstáculos olhando para o topo da pista para reagir abaixo de 400 ms.',
    'jump-early': 'Salte ou baixe um instante antes nos buracos, tambores e fios para manter a velocidade máxima.',
    'lane-switch': 'Em barreiras e candongueiros parados, mude de faixa cedo para evitar perder ritmo.',
    'keep-focus': 'Bom controlo! Combine saltos limpos com o Dash a cada 4s para disputar sempre o 1º lugar.',
  },
};

const PERF_COPY_EN: LocalizedPerfCopy = {
  title: 'Performance Analysis',
  subtitle: 'Tactical breakdown of your race',
  reactionLabel: 'Avg Reaction Time',
  bestLabel: 'Best reflex',
  accuracyLabel: 'Dodge Accuracy',
  jumpPrecisionLabel: 'Jumps & Clears',
  evadedLabel: 'Evaded',
  hitsLabel: 'Hits',
  tipTitle: 'How to Improve',
  noThreats: 'Clear track',
  grades: {
    elite: 'Royal Reflex',
    strong: 'Strong Pace',
    steady: 'Steady Run',
    train: 'Stay Sharp',
  },
  tips: {
    'clean-master': 'Zero collisions! Trigger Dash (double tap) on clear lanes to build an unbeatable lead.',
    'fast-reflex': 'Scan further up the track to bring your reaction speed under 400 ms.',
    'jump-early': 'Jump or duck slightly earlier on holes, drums, and wires to preserve top speed.',
    'lane-switch': 'Switch lanes earlier before barriers and parked buses to avoid slowdowns.',
    'keep-focus': 'Solid control! Pair clean jumps with Dash every 4s to lock down 1st place.',
  },
};

const PERF_COPY_ES: LocalizedPerfCopy = {
  title: 'Análisis de Rendimiento',
  subtitle: 'Lectura táctica de tu carrera',
  reactionLabel: 'Tiempo Medio de Reacción',
  bestLabel: 'Mejor reflejo',
  accuracyLabel: 'Precisión de Esquive',
  jumpPrecisionLabel: 'Saltos y Maniobras',
  evadedLabel: 'Esquivados',
  hitsLabel: 'Impactos',
  tipTitle: 'Cómo Mejorar',
  noThreats: 'Pista libre',
  grades: {
    elite: 'Reflejo Real',
    strong: 'Buen Ritmo',
    steady: 'En Progreso',
    train: 'Más Atención',
  },
  tips: {
    'clean-master': '¡Carrera impecable sin choques! Usa el Dash (doble toque) en rectas libres para sacar ventaja.',
    'fast-reflex': 'Observa la parte alta de la pista para reaccionar en menos de 400 ms.',
    'jump-early': 'Salta o agáchate un instante antes en baches, tambores y cables para mantener la velocidad.',
    'lane-switch': 'Cambia de carril antes frente a barreras y autobuses parados para no frenar.',
    'keep-focus': '¡Buen control! Combina saltos limpios con el Dash cada 4s para asegurar el 1º puesto.',
  },
};

const PERF_COPY_FR: LocalizedPerfCopy = {
  title: 'Analyse de Performance',
  subtitle: 'Bilan tactique de votre course',
  reactionLabel: 'Temps de Réaction Moyen',
  bestLabel: 'Meilleur réflexe',
  accuracyLabel: 'Précision d’Esquive',
  jumpPrecisionLabel: 'Sauts & Esquives',
  evadedLabel: 'Évités',
  hitsLabel: 'Impacts',
  tipTitle: 'Comment Progresser',
  noThreats: 'Voie libre',
  grades: {
    elite: 'Réflexe Royal',
    strong: 'Rythme Solide',
    steady: 'Régulier',
    train: 'Restez Alerte',
  },
  tips: {
    'clean-master': 'Course parfaite sans choc ! Activez le Dash (double tap) sur voie libre pour creuser l’écart.',
    'fast-reflex': 'Anticipez plus haut sur la piste pour passer sous les 400 ms de réaction.',
    'jump-early': 'Sautez ou baissez-vous un peu plus tôt sur les obstacles bas pour garder votre vitesse.',
    'lane-switch': 'Changez de voie plus tôt face aux barrières et bus arrêtés.',
    'keep-focus': 'Bon contrôle ! Combinez sauts propres et Dash toutes les 4s pour viser la 1re place.',
  },
};

function getLocalizedPerfCopy(lang: string): LocalizedPerfCopy {
  if (lang === 'en') return PERF_COPY_EN;
  if (lang.startsWith('es')) return PERF_COPY_ES;
  if (lang === 'fr') return PERF_COPY_FR;
  return PERF_COPY_PT;
}

export const PerformanceAnalysisWidget: React.FC<PerformanceAnalysisWidgetProps> = ({
  performance,
  userRank = 1,
  compact = false,
  onInteract,
}) => {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  if (!performance) return null;

  const copy = getLocalizedPerfCopy(lang);
  const {
    avgReactionTimeMs,
    bestReactionTimeMs,
    dodgeAccuracyPct,
    jumpAccuracyPct,
    evadedCount,
    hitCount,
    totalFaced,
    actionableTipKey,
  } = performance;

  const reactionFast = avgReactionTimeMs !== null && avgReactionTimeMs <= 380;
  const reactionGood = avgReactionTimeMs !== null && avgReactionTimeMs <= 540;

  const gradeText =
    dodgeAccuracyPct >= 90 && hitCount === 0
      ? copy.grades.elite
      : dodgeAccuracyPct >= 75
      ? copy.grades.strong
      : dodgeAccuracyPct >= 55
      ? copy.grades.steady
      : copy.grades.train;

  const accuracyColorClass =
    dodgeAccuracyPct >= 85
      ? 'text-emerald-400'
      : dodgeAccuracyPct >= 65
      ? 'text-amber-400'
      : 'text-rose-400';

  const accuracyBarClass =
    dodgeAccuracyPct >= 85
      ? 'from-emerald-500 to-teal-400'
      : dodgeAccuracyPct >= 65
      ? 'from-amber-500 to-yellow-400'
      : 'from-rose-500 to-orange-400';

  return (
    <motion.section
      onClick={onInteract}
      onMouseEnter={onInteract}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl game-panel-gold ${
        compact ? 'p-3.5' : 'p-4'
      }`}
      aria-label={copy.title}
    >
      {/* Subtle highlight sweep on entrance */}
      {!prefersReducedMotion && (
        <motion.div
          initial={{ opacity: 0, x: '-100%' }}
          animate={{ opacity: [0, 0.35, 0], x: ['-100%', '100%', '120%'] }}
          transition={{ duration: 1.15, delay: 0.25, type: 'tween', ease: 'easeInOut' }}
          className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-400/15 to-transparent"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            <TrendingUp size={14} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-100 truncate">
              {copy.title}
            </h3>
            {!compact && (
              <p className="text-[10px] font-mono text-zinc-400 truncate">{copy.subtitle}</p>
            )}
          </div>
        </div>

        <motion.span
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.22 }}
          className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-mono font-black uppercase tracking-wide shrink-0 ${
            userRank === 1 || (dodgeAccuracyPct >= 88 && hitCount === 0)
              ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}
        >
          {gradeText}
        </motion.span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Reaction Time Card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl game-subplate p-2.5 flex flex-col justify-between gap-1.5"
        >
          <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-zinc-400">
            <span className="truncate font-bold uppercase">{copy.reactionLabel}</span>
            <Gauge size={13} className="text-sky-400 shrink-0" />
          </div>

          <div className="flex items-baseline gap-1.5">
            <motion.span
              initial={prefersReducedMotion ? { scale: 1 } : { scale: 0.88 }}
              animate={
                prefersReducedMotion
                  ? { scale: 1 }
                  : { scale: [0.88, 1.07, 1] }
              }
              transition={{ duration: 0.5, delay: 0.24, type: 'tween', ease: 'easeOut' }}
              className={`text-xl sm:text-2xl font-mono font-black tabular-nums leading-none ${
                avgReactionTimeMs === null
                  ? 'text-zinc-300'
                  : reactionFast
                  ? 'text-emerald-400'
                  : reactionGood
                  ? 'text-sky-300'
                  : 'text-amber-300'
              }`}
            >
              {avgReactionTimeMs !== null ? `${avgReactionTimeMs} ms` : '—'}
            </motion.span>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/80">
            <span>{copy.bestLabel}:</span>
            <span className="font-bold text-zinc-200 tabular-nums">
              {bestReactionTimeMs !== null ? `${bestReactionTimeMs} ms` : copy.noThreats}
            </span>
          </div>
        </motion.div>

        {/* Jump / Dodge Accuracy Card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl game-subplate p-2.5 flex flex-col justify-between gap-1.5"
        >
          <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-zinc-400">
            <span className="truncate font-bold uppercase">{copy.accuracyLabel}</span>
            <Target size={13} className="text-amber-400 shrink-0" />
          </div>

          <div className="flex items-baseline justify-between gap-1">
            <motion.span
              initial={prefersReducedMotion ? { scale: 1 } : { scale: 0.88 }}
              animate={
                prefersReducedMotion
                  ? { scale: 1 }
                  : { scale: [0.88, 1.07, 1] }
              }
              transition={{ duration: 0.5, delay: 0.3, type: 'tween', ease: 'easeOut' }}
              className={`text-xl sm:text-2xl font-mono font-black tabular-nums leading-none ${accuracyColorClass}`}
            >
              {dodgeAccuracyPct}%
            </motion.span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {copy.jumpPrecisionLabel}: <strong className="text-zinc-200">{jumpAccuracyPct}%</strong>
            </span>
          </div>

          {/* Animated Accuracy Bar */}
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              initial={prefersReducedMotion ? { scaleX: dodgeAccuracyPct / 100 } : { scaleX: 0 }}
              animate={{ scaleX: Math.max(0.04, Math.min(1, dodgeAccuracyPct / 100)) }}
              transition={{ duration: 0.65, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ originX: 0 }}
              className={`h-full w-full rounded-full bg-gradient-to-r ${accuracyBarClass}`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
            <span className="text-emerald-400 font-bold tabular-nums">
              ✓ {evadedCount}/{Math.max(evadedCount, totalFaced)} {copy.evadedLabel}
            </span>
            <span className={`font-bold tabular-nums ${hitCount > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
              {hitCount} {copy.hitsLabel}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Actionable Tip */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.32 }}
        className="mt-2.5 rounded-xl game-subplate px-3 py-2 flex items-start gap-2"
      >
        {hitCount === 0 ? (
          <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <Zap size={14} className="text-amber-400 shrink-0 mt-0.5" />
        )}
        <p className="text-[11px] leading-snug text-zinc-300">
          <strong className="text-amber-300 font-bold">{copy.tipTitle}: </strong>
          {copy.tips[actionableTipKey]}
        </p>
      </motion.div>
    </motion.section>
  );
};
