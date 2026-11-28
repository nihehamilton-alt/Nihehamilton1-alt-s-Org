import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Clock,
  Crown,
  Eye,
  Flag,
  Radio,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { Competitor, GameStatus, ServerRaceStatus } from '../types/game';
import { useI18n } from '../contexts/I18nContext';
import { TOTAL_GAME_TIME_SECONDS } from '../game/constants';
import { AvatarDoll } from './AvatarDoll';

interface SpectatorOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  runners: Competitor[];
  isSpectating: boolean;
  canSpectate: boolean;
  spectatedRunnerId: string | null;
  onSelectSpectatedRunner?: (id: string | null) => void;
  onEnterSpectatorMode?: (focusRunnerId?: string | null) => void;
  roomCode: string;
  raceRound: number;
  raceStatus: ServerRaceStatus | GameStatus;
  elapsedSeconds: number;
  betAmountKz: number;
  serverConnected?: boolean;
}

export const SpectatorOverviewModal: React.FC<SpectatorOverviewModalProps> = ({
  isOpen,
  onClose,
  runners,
  isSpectating,
  canSpectate,
  spectatedRunnerId,
  onSelectSpectatedRunner,
  onEnterSpectatorMode,
  roomCode,
  raceRound,
  raceStatus,
  elapsedSeconds,
  betAmountKz,
  serverConnected = false,
}) => {
  const { lang, formatMoney } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const langCode = (lang || 'pt').slice(0, 2);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copy = useMemo(() => {
    if (langCode === 'en') {
      return {
        title: 'Spectator Overview',
        subtitle: 'Live leaderboard of runners, lanes, and status',
        roomLabel: 'Room',
        roundLabel: 'Round',
        liveStatus: 'Live Race',
        startingStatus: 'Starting',
        completedStatus: 'Finished',
        idleStatus: 'Standby',
        timeLeftLabel: 'Time Left',
        leaderLabel: 'Current Leader',
        activeRunnersLabel: 'Runners',
        roomBetLabel: 'Stake',
        colRank: '#',
        colRunner: 'Runner',
        colLane: 'Lane',
        colProgress: 'Progress',
        colStatus: 'Status',
        colCamera: 'View',
        lanePrefix: 'Lane',
        leaderTag: 'Leader',
        hostTag: 'Leader',
        botTag: 'Bot',
        followingTag: 'Following',
        followBtn: 'Follow',
        autoLeaderBtn: 'Auto-Follow Leader',
        watchLiveBtn: 'Watch Live (Ghost)',
        closeBtn: 'Close',
        emptyRunners: 'Waiting for runner telemetry from the track...',
        statusFinished: 'Finished',
        statusStarting: 'On Grid',
        statusStumbling: 'Stumbling',
        statusDashing: 'Dashing',
        statusJumping: 'Jumping',
        statusSliding: 'Sliding',
        statusRunning: 'Running',
        statusPreparing: 'Ready',
        reviewTag: 'Review',
      };
    }

    if (langCode === 'es') {
      return {
        title: 'Vista de Espectador',
        subtitle: 'Clasificación en vivo de corredores, carril y estado',
        roomLabel: 'Sala',
        roundLabel: 'Ronda',
        liveStatus: 'En Vivo',
        startingStatus: 'Saliendo',
        completedStatus: 'Finalizada',
        idleStatus: 'En Espera',
        timeLeftLabel: 'Restante',
        leaderLabel: 'Líder Actual',
        activeRunnersLabel: 'Corredores',
        roomBetLabel: 'Apuesta',
        colRank: '#',
        colRunner: 'Corredor',
        colLane: 'Carril',
        colProgress: 'Progreso',
        colStatus: 'Estado',
        colCamera: 'Cámara',
        lanePrefix: 'Carril',
        leaderTag: 'Líder',
        hostTag: 'Líder',
        botTag: 'Bot',
        followingTag: 'Siguiendo',
        followBtn: 'Seguir',
        autoLeaderBtn: 'Seguir al Líder (Auto)',
        watchLiveBtn: 'Ver en Vivo (Fantasma)',
        closeBtn: 'Cerrar',
        emptyRunners: 'Esperando telemetría de los corredores en la pista...',
        statusFinished: 'Finalizó',
        statusStarting: 'En Salida',
        statusStumbling: 'Tropezando',
        statusDashing: 'Dash',
        statusJumping: 'Saltando',
        statusSliding: 'Deslizando',
        statusRunning: 'Corriendo',
        statusPreparing: 'Listo',
        reviewTag: 'Revisión',
      };
    }

    if (langCode === 'fr') {
      return {
        title: 'Aperçu Spectateur',
        subtitle: 'Classement en direct des coureurs, voies et statuts',
        roomLabel: 'Salle',
        roundLabel: 'Manche',
        liveStatus: 'En Direct',
        startingStatus: 'Départ',
        completedStatus: 'Terminée',
        idleStatus: 'En Attente',
        timeLeftLabel: 'Restant',
        leaderLabel: 'Leader Actuel',
        activeRunnersLabel: 'Coureurs',
        roomBetLabel: 'Mise',
        colRank: '#',
        colRunner: 'Coureur',
        colLane: 'Voie',
        colProgress: 'Progrès',
        colStatus: 'Statut',
        colCamera: 'Vue',
        lanePrefix: 'Voie',
        leaderTag: 'Leader',
        hostTag: 'Chef',
        botTag: 'Bot',
        followingTag: 'Suivi',
        followBtn: 'Suivre',
        autoLeaderBtn: 'Suivre le Leader (Auto)',
        watchLiveBtn: 'Regarder en Direct',
        closeBtn: 'Fermer',
        emptyRunners: 'En attente de la télémétrie des coureurs sur la piste...',
        statusFinished: 'Terminé',
        statusStarting: 'Sur la ligne',
        statusStumbling: 'Trébuche',
        statusDashing: 'Dash',
        statusJumping: 'Saute',
        statusSliding: 'Glisse',
        statusRunning: 'En course',
        statusPreparing: 'Prêt',
        reviewTag: 'Contrôle',
      };
    }

    return {
      title: 'Visão Geral de Espectador',
      subtitle: 'Classificação em direto dos corredores, faixa e estado na pista',
      roomLabel: 'Sala',
      roundLabel: 'Ronda',
      liveStatus: 'Ao Vivo',
      startingStatus: 'A Arrancar',
      completedStatus: 'Terminada',
      idleStatus: 'Em Espera',
      timeLeftLabel: 'Restante',
      leaderLabel: 'Líder Atual',
      activeRunnersLabel: 'Corredores',
      roomBetLabel: 'Aposta',
      colRank: '#',
      colRunner: 'Corredor',
      colLane: 'Faixa',
      colProgress: 'Progresso',
      colStatus: 'Estado',
      colCamera: 'Foco',
      lanePrefix: 'Faixa',
      leaderTag: 'Líder',
      hostTag: 'Líder',
      botTag: 'Bot',
      followingTag: 'A Seguir',
      followBtn: 'Seguir',
      autoLeaderBtn: 'Seguir Líder (Auto)',
      watchLiveBtn: 'Assistir Pista (Fantasma)',
      closeBtn: 'Fechar',
      emptyRunners: 'A aguardar telemetria dos corredores na pista...',
      statusFinished: 'Terminado',
      statusStarting: 'Na Largada',
      statusStumbling: 'Abrandou',
      statusDashing: 'Dash',
      statusJumping: 'Saltou',
      statusSliding: 'Deslizou',
      statusRunning: 'A Correr',
      statusPreparing: 'Pronto',
      reviewTag: 'Verificação',
    };
  }, [langCode]);

  const sortedRunners = useMemo(() => {
    const activeOnly = runners.filter((r) => !r.isSpectating);
    const list = activeOnly.length > 0 ? activeOnly : runners;
    return [...list].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished && typeof a.finishTime === 'number' && typeof b.finishTime === 'number') {
        if (Math.abs(a.finishTime - b.finishTime) > 0.001) {
          return a.finishTime - b.finishTime;
        }
      }
      const distDiff = (b.progressDistance || 0) - (a.progressDistance || 0);
      if (Math.abs(distDiff) > 0.0001) return distDiff;
      return (a.targetLane ?? a.lane ?? 0) - (b.targetLane ?? b.lane ?? 0);
    });
  }, [runners]);

  const remainingSeconds = Math.max(0, TOTAL_GAME_TIME_SECONDS - Math.floor(elapsedSeconds));
  const leaderDistance = Math.max(0, sortedRunners[0]?.progressDistance ?? 0);
  const progressScaleMax = Math.max(480, leaderDistance * 1.12, 1);

  const raceStatusLabel =
    raceStatus === 'running'
      ? copy.liveStatus
      : raceStatus === 'starting'
      ? copy.startingStatus
      : raceStatus === 'completed'
      ? copy.completedStatus
      : copy.idleStatus;

  const getRunnerStatusMeta = (runner: Competitor) => {
    if (runner.finished) {
      return {
        label: copy.statusFinished,
        textClass: 'text-emerald-300',
        borderClass: 'border-emerald-500/40 bg-emerald-950/60',
        icon: <Flag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      };
    }
    if (raceStatus === 'starting') {
      return {
        label: copy.statusStarting,
        textClass: 'text-amber-200',
        borderClass: 'border-amber-500/40 bg-amber-950/50',
        icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      };
    }
    if (runner.stumbling || runner.action === 'stumbling') {
      return {
        label: copy.statusStumbling,
        textClass: 'text-rose-300',
        borderClass: 'border-rose-500/45 bg-rose-950/60',
        icon: <Activity className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
      };
    }
    if (runner.action === 'dashing') {
      return {
        label: copy.statusDashing,
        textClass: 'text-amber-300',
        borderClass: 'border-amber-400/50 bg-amber-950/65',
        icon: <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
      };
    }
    if (runner.action === 'jumping') {
      return {
        label: copy.statusJumping,
        textClass: 'text-sky-300',
        borderClass: 'border-sky-500/40 bg-sky-950/60',
        icon: <ArrowUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
      };
    }
    if (runner.action === 'sliding') {
      return {
        label: copy.statusSliding,
        textClass: 'text-indigo-300',
        borderClass: 'border-indigo-500/40 bg-indigo-950/60',
        icon: <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />,
      };
    }
    return {
      label: raceStatus === 'idle' ? copy.statusPreparing : copy.statusRunning,
      textClass: 'text-emerald-200',
      borderClass: 'border-white/10 bg-zinc-900/75',
      icon: <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
    };
  };

  const handleRowFocusAction = (runnerId: string) => {
    if (isSpectating && onSelectSpectatedRunner) {
      onSelectSpectatedRunner(runnerId);
      onClose();
      return;
    }
    if (canSpectate && onEnterSpectatorMode) {
      onEnterSpectatorMode(runnerId);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="spectator-overview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.05 : 0.16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="spectator-overview-title"
          data-testid="spectator-overview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: shouldReduceMotion ? 0.05 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl game-panel-gold rounded-3xl p-4 sm:p-6 shadow-[0_0_65px_rgba(14,165,233,0.22)] flex flex-col gap-4 text-zinc-200 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl game-subplate border border-sky-400/45 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-sky-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
                      <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>{raceStatusLabel}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {copy.roomLabel} {roomCode}
                    </span>
                    {raceRound > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {copy.roundLabel} #{raceRound}
                        </span>
                      </>
                    )}
                    {serverConnected && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-300 tabular-nums">
                          {remainingSeconds}s {copy.timeLeftLabel.toLowerCase()}
                        </span>
                      </>
                    )}
                  </div>
                  <h2
                    id="spectator-overview-title"
                    className="text-lg sm:text-xl font-black font-display text-amber-400 tracking-wide leading-tight mt-0.5 text-balance"
                  >
                    {copy.title}
                  </h2>
                  <p className="text-xs text-zinc-400 leading-snug mt-0.5">{copy.subtitle}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={copy.closeBtn}
                data-testid="spectator-overview-close-icon"
                className="w-10 h-10 rounded-xl game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Race Telemetry Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="game-subplate rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
                <span className="text-[11px] font-mono text-zinc-400">{copy.timeLeftLabel}</span>
                <span
                  className={`text-base font-black font-mono tabular-nums ${
                    remainingSeconds <= 10 && raceStatus === 'running'
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }`}
                >
                  {remainingSeconds}s
                </span>
              </div>

              <div className="game-subplate rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
                <span className="text-[11px] font-mono text-zinc-400">{copy.activeRunnersLabel}</span>
                <span className="text-base font-black font-mono tabular-nums text-zinc-100">
                  {sortedRunners.length}
                </span>
              </div>

              <div className="game-subplate rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
                <span className="text-[11px] font-mono text-zinc-400">{copy.leaderLabel}</span>
                <span className="text-sm font-bold text-amber-200 truncate">
                  {sortedRunners[0]
                    ? `${sortedRunners[0].name.replace(/\s*\(.*?\)\s*$/, '')} (${Math.round(
                        sortedRunners[0].progressDistance || 0
                      )}m)`
                    : '—'}
                </span>
              </div>

              <div className="game-subplate rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
                <span className="text-[11px] font-mono text-zinc-400">{copy.roomBetLabel}</span>
                <span className="text-sm font-black font-mono tabular-nums text-emerald-300 truncate">
                  {formatMoney(betAmountKz)}
                </span>
              </div>
            </div>

            {/* Leaderboard List */}
            <div className="flex flex-col gap-2">
              <div className="hidden sm:grid sm:grid-cols-[44px_minmax(0,1.4fr)_110px_minmax(0,1.3fr)_120px] gap-3 px-3 text-[11px] font-mono font-semibold text-zinc-400">
                <span>{copy.colRank}</span>
                <span>{copy.colRunner}</span>
                <span>{copy.colLane}</span>
                <span>{copy.colProgress}</span>
                <span className="text-right">{copy.colStatus}</span>
              </div>

              {sortedRunners.length === 0 ? (
                <div className="game-subplate rounded-2xl p-6 text-center text-xs font-mono text-zinc-400">
                  {copy.emptyRunners}
                </div>
              ) : (
                <div className="flex flex-col gap-2" data-testid="spectator-overview-leaderboard">
                  {sortedRunners.map((runner, idx) => {
                    const rank = idx + 1;
                    const dist = Math.max(0, Math.round(runner.progressDistance || 0));
                    const gapToLeader = Math.max(0, Math.round(leaderDistance - (runner.progressDistance || 0)));
                    const progressRatio = runner.finished
                      ? 1
                      : Math.max(0.03, Math.min(1, (runner.progressDistance || 0) / progressScaleMax));
                    const laneNum = Math.max(0, Math.min(4, runner.targetLane ?? runner.lane ?? 0)) + 1;
                    const statusMeta = getRunnerStatusMeta(runner);
                    const isFollowed = isSpectating && spectatedRunnerId === runner.id;
                    const cleanName = runner.name.replace(/\s*\(.*?\)\s*$/, '');
                    const canClickRow = Boolean(
                      (isSpectating && onSelectSpectatedRunner) || (canSpectate && onEnterSpectatorMode)
                    );

                    return (
                      <div
                        key={runner.id}
                        data-testid={`spectator-runner-row-${rank}`}
                        className={`rounded-2xl p-3 border transition-colors ${
                          isFollowed
                            ? 'bg-sky-950/55 border-sky-400/75 shadow-[0_0_20px_rgba(56,189,248,0.16)]'
                            : rank === 1
                            ? 'bg-amber-950/35 border-amber-400/45'
                            : 'game-subplate border-white/10'
                        }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-[44px_minmax(0,1.4fr)_110px_minmax(0,1.3fr)_120px] items-center gap-2.5 sm:gap-3">
                          {/* Rank + Mobile Top Header */}
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <div className="flex items-center gap-1.5 font-mono font-black text-sm tabular-nums">
                              {rank === 1 ? (
                                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                              ) : rank === 2 ? (
                                <Trophy className="w-4 h-4 text-sky-300 shrink-0" />
                              ) : rank === 3 ? (
                                <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                              ) : null}
                              <span
                                className={
                                  rank === 1
                                    ? 'text-amber-300'
                                    : rank === 2
                                    ? 'text-sky-200'
                                    : rank === 3
                                    ? 'text-orange-300'
                                    : 'text-zinc-300'
                                }
                              >
                                {rank}º
                              </span>
                            </div>

                            {/* Mobile-only Status Badge */}
                            <div
                              className={`sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold ${statusMeta.borderClass} ${statusMeta.textClass}`}
                            >
                              {statusMeta.icon}
                              <span>{statusMeta.label}</span>
                            </div>
                          </div>

                          {/* Runner Identity */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-9 h-9 rounded-xl bg-zinc-900/90 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden"
                              style={{ borderColor: runner.color || undefined }}
                            >
                              <AvatarDoll
                                avatarId={runner.avatarId}
                                name={cleanName}
                                color={runner.color}
                                size={30}
                                variant="bust"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm font-bold text-zinc-100 truncate">
                                  {cleanName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                                {runner.isHost && (
                                  <>
                                    <span className="text-amber-300 font-semibold">{copy.hostTag}</span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                {runner.isBot && (
                                  <>
                                    <span>{copy.botTag}</span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                <span className="tabular-nums">
                                  {rank === 1 ? copy.leaderTag : `-${gapToLeader}m`}
                                </span>
                                {isFollowed && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-sky-300 font-semibold">{copy.followingTag}</span>
                                  </>
                                )}
                                {runner.sessionStatus === 'investigating' && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-rose-300 font-semibold">{copy.reviewTag}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Lane Indicator (Text + 5-Lane Mini Map) */}
                          <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                            <span className="text-xs font-mono font-bold text-sky-300 tabular-nums whitespace-nowrap">
                              {copy.lanePrefix} {laneNum}/5
                            </span>
                            <div
                              className="grid grid-cols-5 gap-1 w-20"
                              aria-label={`${copy.lanePrefix} ${laneNum}/5`}
                            >
                              {[1, 2, 3, 4, 5].map((slot) => (
                                <span
                                  key={slot}
                                  className={`h-1.5 rounded-sm transition-opacity ${
                                    slot === laneNum ? 'opacity-100' : 'opacity-20 bg-zinc-600'
                                  }`}
                                  style={
                                    slot === laneNum
                                      ? { backgroundColor: runner.color || '#38bdf8' }
                                      : undefined
                                  }
                                />
                              ))}
                            </div>
                          </div>

                          {/* Current Progress (Meters + Compositor ScaleX Bar) */}
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-xs font-mono">
                              <span className="font-black text-zinc-100 tabular-nums">{dist}m</span>
                              <span className="text-[11px] text-zinc-400 tabular-nums">
                                {Math.round(progressRatio * 100)}%
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
                              <div
                                className="h-full w-full origin-left transition-transform duration-150 ease-out rounded-full"
                                style={{
                                  transform: `scaleX(${progressRatio})`,
                                  backgroundColor:
                                    rank === 1
                                      ? '#f59e0b'
                                      : runner.stumbling
                                      ? '#f43f5e'
                                      : runner.color || '#38bdf8',
                                }}
                              />
                            </div>
                          </div>

                          {/* Desktop Status + Quick Focus Action */}
                          <div className="hidden sm:flex flex-col items-end gap-1">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold whitespace-nowrap ${statusMeta.borderClass} ${statusMeta.textClass}`}
                            >
                              {statusMeta.icon}
                              <span>{statusMeta.label}</span>
                            </div>
                            {canClickRow && (
                              <button
                                type="button"
                                onClick={() => handleRowFocusAction(runner.id)}
                                className="text-[11px] font-mono font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                              >
                                {isFollowed ? copy.followingTag : copy.followBtn}
                              </button>
                            )}
                          </div>

                          {/* Mobile Focus Action */}
                          {canClickRow && (
                            <div className="sm:hidden flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRowFocusAction(runner.id)}
                                className="px-3 py-1.5 min-h-[40px] rounded-xl game-btn-secondary text-xs font-mono font-bold text-sky-300 cursor-pointer whitespace-nowrap"
                              >
                                {isFollowed ? copy.followingTag : copy.followBtn}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {isSpectating && onSelectSpectatedRunner && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSpectatedRunner(null);
                      onClose();
                    }}
                    className={`px-4 py-2 min-h-[40px] rounded-xl text-xs font-mono font-bold cursor-pointer whitespace-nowrap shrink-0 border transition-colors ${
                      !spectatedRunnerId
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'game-btn-secondary text-zinc-200 hover:text-sky-200'
                    }`}
                  >
                    {copy.autoLeaderBtn}
                  </button>
                )}

                {!isSpectating && canSpectate && onEnterSpectatorMode && (
                  <button
                    type="button"
                    data-testid="spectator-overview-watch-live"
                    onClick={() => {
                      onEnterSpectatorMode(null);
                      onClose();
                    }}
                    className="px-4 py-2 min-h-[40px] rounded-xl game-btn-gold text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4 shrink-0" />
                    <span>{copy.watchLiveBtn}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                data-testid="spectator-overview-close-btn"
                onClick={onClose}
                className="px-5 py-2 min-h-[40px] rounded-xl game-btn-secondary text-xs font-bold text-zinc-200 hover:text-white cursor-pointer whitespace-nowrap shrink-0 ml-auto"
              >
                {copy.closeBtn}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
