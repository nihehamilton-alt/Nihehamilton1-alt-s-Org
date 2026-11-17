import React from 'react';
import { AVATARS, AvatarItem } from '../data/avatars';
import { PASSE_DO_REI_MONTHLY_KZ } from '../data/currency';
import { getLocalizedAvatar } from '../data/translations';
import { useI18n } from '../contexts/I18nContext';
import { AvatarDoll } from './AvatarDoll';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalanceKz: number;
  selectedAvatarId: string;
  unlockedAvatars: string[];
  hasPasseDoRei: boolean;
  onSelectAvatar: (avatarId: string) => void;
  onBuyAvatar: (item: AvatarItem) => void;
  onBuyPasseDoRei: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  userBalanceKz,
  selectedAvatarId,
  unlockedAvatars,
  hasPasseDoRei,
  onSelectAvatar,
  onBuyAvatar,
  onBuyPasseDoRei,
}) => {
  const { lang, t, formatMoney } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="game-panel-gold rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-[0_0_70px_rgba(245,158,11,0.3)] flex flex-col gap-4 text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho da Loja */}
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl game-subplate border border-amber-400/40 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.2)]">
              <span className="text-2xl">🛍️</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400 uppercase tracking-wide">
                {t.shop.title}
              </h2>
              <span className="text-xs text-zinc-400">
                {t.shop.balanceAvailable}{' '}
                <strong className="text-amber-300 font-mono">{formatMoney(userBalanceKz)}</strong> ·{' '}
                {t.shop.royaltiesNote}
              </span>
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

        {/* Destaque: O Passe do Rei */}
        <div className="p-4 bg-gradient-to-r from-amber-500/20 via-yellow-500/12 to-amber-500/20 border border-amber-400/55 rounded-2xl flex items-center justify-between gap-3 shadow-[0_0_24px_rgba(245,158,11,0.18)]">
          <div className="flex items-center gap-3">
            <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">🎫</span>
            <div>
              <h3 className="text-sm font-black text-amber-300 uppercase">
                {t.shop.passeTitle} · {formatMoney(PASSE_DO_REI_MONTHLY_KZ)}
              </h3>
              <p className="text-xs text-zinc-300">{t.shop.passeDesc}</p>
            </div>
          </div>
          {hasPasseDoRei ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-black uppercase shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.45)]">
              {t.shop.activeBadge}
            </span>
          ) : (
            <button
              type="button"
              onClick={onBuyPasseDoRei}
              disabled={userBalanceKz < PASSE_DO_REI_MONTHLY_KZ}
              className="px-4 py-2 rounded-xl game-btn-gold text-zinc-950 text-xs font-black uppercase cursor-pointer disabled:opacity-40 shrink-0"
            >
              {t.shop.activatePasse} ({formatMoney(PASSE_DO_REI_MONTHLY_KZ)})
            </button>
          )}
        </div>

        {/* Grid dos 10 Avatares Oficiais */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase text-amber-400 tracking-wider">
            {t.shop.sectionTitle}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AVATARS.map((item) => {
              const locAvatar = getLocalizedAvatar(item.id, lang);
              const isUnlocked =
                hasPasseDoRei || item.unlockedByDefault || unlockedAvatars.includes(item.id);
              const isSelected = selectedAvatarId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'bg-gradient-to-b from-amber-500/20 to-amber-950/35 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.28)]'
                      : 'game-subplate hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="p-1.5 rounded-xl game-panel border border-white/10 shrink-0">
                      <AvatarDoll
                        avatarId={item.id}
                        name={locAvatar.name}
                        color={item.color}
                        size={44}
                        variant="full"
                        className="filter drop-shadow"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-zinc-100 truncate">
                          {locAvatar.name}
                        </span>
                        {item.priceKz === 0 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0">
                            {t.shop.defaultBadge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-amber-300/90 block font-mono">{locAvatar.title}</span>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                        {locAvatar.description}
                      </p>
                    </div>
                  </div>

                  {isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => onSelectAvatar(item.id)}
                      className={`w-full py-1.5 rounded-xl text-xs font-bold uppercase cursor-pointer transition-all ${
                        isSelected
                          ? 'game-btn-gold text-zinc-950 font-black'
                          : 'game-btn-secondary text-zinc-200'
                      }`}
                    >
                      {isSelected ? t.shop.inUse : t.shop.equip}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBuyAvatar(item)}
                      disabled={userBalanceKz < item.priceKz}
                      className="w-full py-1.5 rounded-xl text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 disabled:opacity-40 text-white cursor-pointer transition-all shadow"
                    >
                      {t.shop.unlock} ({formatMoney(item.priceKz)})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
