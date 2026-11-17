import React from 'react';
import { useI18n } from '../contexts/I18nContext';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="game-panel-gold rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-[0_0_70px_rgba(245,158,11,0.28)] flex flex-col gap-3.5 text-zinc-200 max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl game-subplate border border-amber-400/40 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.2)]">
              <span className="text-2xl">👑</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400 uppercase tracking-wide">
                {t.rules.title}
              </h2>
              <span className="text-xs text-zinc-400">{t.creatorSignature}</span>
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

        {/* Frase Oficial */}
        <div className="p-3 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-500/35 rounded-2xl text-center">
          <span className="text-xs font-mono font-bold text-amber-300 block">
            &quot;{t.officialPhrase}&quot;
          </span>
        </div>

        <div className="p-3.5 game-subplate rounded-2xl flex flex-col gap-1.5">
          <h3 className="text-xs font-bold uppercase text-amber-300 tracking-wider">
            {t.rules.sec1Title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">{t.rules.sec1Body}</p>
        </div>

        <div className="p-3.5 game-subplate rounded-2xl flex flex-col gap-1.5">
          <h3 className="text-xs font-bold uppercase text-cyan-400 tracking-wider">
            {t.rules.sec2Title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">{t.rules.sec2Body}</p>
        </div>

        <div className="p-3.5 game-subplate rounded-2xl flex flex-col gap-1.5">
          <h3 className="text-xs font-bold uppercase text-yellow-400 tracking-wider">
            {t.rules.sec3Title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">{t.rules.sec3Body}</p>
        </div>

        <div className="p-3.5 game-subplate rounded-2xl flex flex-col gap-1.5">
          <h3 className="text-xs font-bold uppercase text-rose-400 tracking-wider">
            {t.rules.sec4Title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">{t.rules.sec4Body}</p>
        </div>

        <div className="p-3.5 game-subplate rounded-2xl flex flex-col gap-1.5">
          <h3 className="text-xs font-bold uppercase text-emerald-400 tracking-wider">
            {t.rules.sec5Title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">{t.rules.sec5Body}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl game-btn-gold text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer"
        >
          {t.rules.closeBtn}
        </button>
      </div>
    </div>
  );
};
