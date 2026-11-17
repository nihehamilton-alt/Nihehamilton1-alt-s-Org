import React from 'react';
import { getLocalizedAvatar, getLocalizedBot } from '../data/translations';
import { useI18n } from '../contexts/I18nContext';
import { AvatarDoll } from './AvatarDoll';

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RankingModal: React.FC<RankingModalProps> = ({ isOpen, onClose }) => {
  const { lang, t, formatMoney } = useI18n();

  if (!isOpen) return null;

  const kingAvatar = getLocalizedAvatar('rei-zero', lang);
  const bot1 = getLocalizedBot('bot-kota-banza', lang);
  const bot2 = getLocalizedBot('bot-zito-kuduro', lang);
  const bot3 = getLocalizedBot('bot-tia-maria', lang);
  const bot4 = getLocalizedBot('bot-beto-candonga', lang);

  const topRunners = [
    {
      rank: 1,
      name: t.coronation.kingName,
      avatar: kingAvatar.avatar,
      avatarId: kingAvatar.id,
      color: kingAvatar.color,
      wins: 384,
      earningsKz: 24_500_000,
      bestSpeed: '13.8 m/s',
      title: kingAvatar.title,
    },
    {
      rank: 2,
      name: `${bot1.name} [${t.lobby.botBadge}]`,
      avatar: bot1.avatar,
      avatarId: bot1.avatarId,
      color: bot1.color,
      wins: 312,
      earningsKz: 18_200_000,
      bestSpeed: '13.2 m/s',
      title: bot1.title,
    },
    {
      rank: 3,
      name: `${bot2.name} [${t.lobby.botBadge}]`,
      avatar: bot2.avatar,
      avatarId: bot2.avatarId,
      color: bot2.color,
      wins: 278,
      earningsKz: 14_900_000,
      bestSpeed: '13.0 m/s',
      title: bot2.title,
    },
    {
      rank: 4,
      name: `${bot3.name} [${t.lobby.botBadge}]`,
      avatar: bot3.avatar,
      avatarId: bot3.avatarId,
      color: bot3.color,
      wins: 240,
      earningsKz: 11_400_000,
      bestSpeed: '12.8 m/s',
      title: bot3.title,
    },
    {
      rank: 5,
      name: `${bot4.name} [${t.lobby.botBadge}]`,
      avatar: bot4.avatar,
      avatarId: bot4.avatarId,
      color: bot4.color,
      wins: 195,
      earningsKz: 8_700_000,
      bestSpeed: '12.6 m/s',
      title: bot4.title,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="game-panel-gold rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-[0_0_70px_rgba(245,158,11,0.3)] flex flex-col gap-4 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl game-subplate border border-amber-400/40 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.2)]">
              <span className="text-2xl">🏆</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400 uppercase tracking-wide">
                {t.ranking.title}
              </h2>
              <span className="text-xs text-zinc-400">{t.ranking.subtitle}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {topRunners.map((runner) => (
            <div
              key={runner.rank}
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                runner.rank === 1
                  ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/12 to-amber-950/35 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'game-subplate'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono font-black text-sm w-6 text-center text-amber-400 shrink-0">
                  {runner.rank === 1
                    ? '🥇'
                    : runner.rank === 2
                    ? '🥈'
                    : runner.rank === 3
                    ? '🥉'
                    : `#${runner.rank}`}
                </span>
                <AvatarDoll
                  avatarId={runner.avatarId}
                  name={runner.name}
                  color={runner.color}
                  size={34}
                  variant="full"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-zinc-100 truncate">{runner.name}</span>
                  <span className="text-[10px] text-zinc-400 truncate">
                    {runner.title} · {runner.wins} {t.ranking.winsLabel}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono font-black text-emerald-400 text-xs block">
                  {formatMoney(runner.earningsKz)}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono uppercase">{runner.bestSpeed}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
