import React from 'react';
import { motion } from 'framer-motion';
import {
  DAILY_MISSIONS,
  DailyMissionsState,
  getMissionProgress,
} from '../data/missions';
import { getLocalizedMission } from '../data/translations';
import { useI18n } from '../contexts/I18nContext';

interface DailyMissionsWidgetProps {
  state: DailyMissionsState;
  onClaimReward: (missionId: string) => void;
  onClaimAllRewards?: () => void;
  isDemo: boolean;
}

export const DailyMissionsWidget: React.FC<DailyMissionsWidgetProps> = ({
  state,
  onClaimReward,
  onClaimAllRewards,
  isDemo,
}) => {
  const { lang, t, formatMoney } = useI18n();
  const [claimNotice, setClaimNotice] = React.useState<string | null>(null);
  const noticeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const showClaimToast = (text: string) => {
    setClaimNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setClaimNotice(null), 2600);
  };

  const completedCount = DAILY_MISSIONS.filter(
    (m) => getMissionProgress(m, state.stats) >= m.target
  ).length;

  const claimableMissions = DAILY_MISSIONS.filter((m) => {
    const progress = getMissionProgress(m, state.stats);
    return progress >= m.target && !state.claimedIds.includes(m.id);
  });

  const totalClaimableKz = claimableMissions.reduce((sum, m) => sum + m.rewardKz, 0);
  const overallPercent = Math.round((completedCount / DAILY_MISSIONS.length) * 100);

  return (
    <section
      aria-label={t.missions.title}
      className="game-panel rounded-2xl p-4 flex flex-col gap-3"
    >
      {claimNotice && (
        <div
          role="status"
          className="px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold"
        >
          ✓ {claimNotice}
        </div>
      )}

      {/* Cabeçalho do Widget */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">
              🎯
            </span>
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-100">
              {t.missions.title}
            </h2>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
            {completedCount}/{DAILY_MISSIONS.length} {t.missions.completedOf} ·{' '}
            {t.missions.resetsMidnight}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[11px] font-mono font-bold text-amber-400 tabular-nums block">
            {overallPercent}%
          </span>
          <span className="text-[10px] text-zinc-500 block">
            {isDemo ? t.missions.demoBonus : t.missions.realBonus}
          </span>
        </div>
      </div>

      {/* Barra de Progresso Geral */}
      <div className="w-full h-2 game-subplate rounded-full overflow-hidden p-0.5">
        <motion.div
          initial={false}
          animate={{ width: `${overallPercent}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.45)]"
        />
      </div>

      {/* Botão de Resgate em Lote quando há 2 ou mais recompensas prontas */}
      {claimableMissions.length >= 2 && onClaimAllRewards && (
        <button
          type="button"
          onClick={() => {
            onClaimAllRewards();
            showClaimToast(`+${formatMoney(totalClaimableKz)} ${t.missions.addedToast}`);
          }}
          className="w-full min-h-[40px] px-3 py-2 rounded-xl game-btn-gold font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-between"
        >
          <span>
            {t.missions.claimAll} ({claimableMissions.length})
          </span>
          <span className="font-mono">+{formatMoney(totalClaimableKz)}</span>
        </button>
      )}

      {/* Lista de Missões separada por divisores sutis */}
      <ul className="divide-y divide-white/10">
        {DAILY_MISSIONS.map((mission) => {
          const locMission = getLocalizedMission(mission.id, lang);
          const current = getMissionProgress(mission, state.stats);
          const isCompleted = current >= mission.target;
          const isClaimed = state.claimedIds.includes(mission.id);
          const isReadyToClaim = isCompleted && !isClaimed;
          const pct = Math.min(100, Math.round((current / mission.target) * 100));

          return (
            <li
              key={mission.id}
              className={`py-3 first:pt-1 last:pb-0 flex flex-col gap-2 transition-opacity ${
                isClaimed ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0" aria-hidden="true">
                    {mission.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-zinc-100 truncate">
                        {locMission.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {locMission.description}
                    </p>
                  </div>
                </div>

                {/* Ação ou Recompensa */}
                <div className="shrink-0 flex items-center">
                  {isReadyToClaim ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClaimReward(mission.id);
                        showClaimToast(`+${formatMoney(mission.rewardKz)} ${t.missions.addedToast}`);
                      }}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl game-btn-gold font-black text-xs font-mono cursor-pointer"
                    >
                      {t.missions.claimBtn} +{formatMoney(mission.rewardKz)}
                    </button>
                  ) : isClaimed ? (
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ✓ +{formatMoney(mission.rewardKz)}
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                      +{formatMoney(mission.rewardKz)}
                    </span>
                  )}
                </div>
              </div>

              {/* Progresso individual */}
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-1.5 game-subplate rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isClaimed
                        ? 'bg-emerald-500'
                        : isReadyToClaim
                        ? 'bg-amber-400'
                        : 'bg-amber-500/75'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-zinc-400 tabular-nums shrink-0">
                  {current}/{mission.target}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
