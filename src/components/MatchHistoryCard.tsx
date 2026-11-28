import React from 'react';
import { RoundHistory } from '../types/game';
import { useI18n } from '../contexts/I18nContext';

interface MatchHistoryCardProps {
  history: RoundHistory[];
}

export const MatchHistoryCard: React.FC<MatchHistoryCardProps> = ({ history }) => {
  const { t, formatMoney } = useI18n();

  const totalMatches = history.length;
  const winCount = history.filter((item) => item.won).length;
  const winRate = totalMatches > 0 ? Math.round((winCount / totalMatches) * 100) : 0;

  return (
    <div className="game-panel rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
            style={{ backgroundColor: 'var(--op-primary, #f59e0b)' }}
          />
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-100 font-display truncate">
            {t.app.historyTitle}
          </h3>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
          <span className="px-2 py-0.5 rounded game-subplate text-zinc-300 tabular-nums">
            {t.app.historyMatchesLabel}: <strong className="text-amber-400">{totalMatches}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/35 text-emerald-300 tabular-nums">
            {t.app.historyWinRateLabel}: <strong>{winRate}%</strong>
          </span>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-zinc-400 py-3 text-center leading-relaxed">
          {t.app.historyEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
          {history.slice(0, 12).map((item) => {
            const rankMedal =
              item.playerRank === 1
                ? '🥇'
                : item.playerRank === 2
                ? '🥈'
                : item.playerRank === 3
                ? '🥉'
                : '🏃';

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
                  item.won
                    ? 'bg-emerald-950/35 border-emerald-500/35'
                    : 'game-subplate'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">{rankMedal}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-zinc-100 font-mono tabular-nums leading-tight">
                      #{item.playerRank}/{item.totalPlayers} · {item.timestamp}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                      {t.app.historyStake}: {formatMoney(item.betAmount)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono tabular-nums">
                  {item.payout > item.betAmount ? (
                    <span className="font-black text-emerald-400 text-xs">
                      +{formatMoney(item.payout)}
                    </span>
                  ) : item.payout > 0 ? (
                    <span className="font-bold text-sky-300 text-xs">
                      ={formatMoney(item.payout)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-zinc-500">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
