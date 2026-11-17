import React from 'react';
import { useI18n } from '../contexts/I18nContext';

export interface OperatorTheme {
  id: string;
  name: string;
  badge: string;
  primaryColor: string;
  accentColor: string;
  apiLatency: string;
}

export const OPERATOR_THEMES: OperatorTheme[] = [
  {
    id: 'reizero',
    name: 'REI ZERO',
    badge: '👑',
    primaryColor: '#f59e0b',
    accentColor: '#dc2626',
    apiLatency: '8ms',
  },
  {
    id: 'betangola',
    name: 'BetAngola',
    badge: '🇦🇴',
    primaryColor: '#16a34a',
    accentColor: '#eab308',
    apiLatency: '12ms',
  },
  {
    id: 'elephantbet',
    name: 'Elephant Bet',
    badge: '🐘',
    primaryColor: '#ea580c',
    accentColor: '#f97316',
    apiLatency: '15ms',
  },
  {
    id: 'bantubet',
    name: 'BantuBet',
    badge: '🦁',
    primaryColor: '#0284c7',
    accentColor: '#38bdf8',
    apiLatency: '14ms',
  },
  {
    id: 'premierbet',
    name: 'Premier Bet',
    badge: '⭐',
    primaryColor: '#dc2626',
    accentColor: '#16a34a',
    apiLatency: '11ms',
  },
];

interface OperatorSelectorProps {
  currentOperator: OperatorTheme;
  onSelectOperator: (op: OperatorTheme) => void;
  onOpenProvablyFair: () => void;
}

export const OperatorSelector: React.FC<OperatorSelectorProps> = ({
  currentOperator,
  onSelectOperator,
  onOpenProvablyFair,
}) => {
  const { t } = useI18n();

  return (
    <div className="w-full game-panel border-x-0 border-t-0 border-b border-amber-500/20 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1.5 tracking-wider">
          <span>🏢</span> {t.operator.partnerLabel}
        </span>
        <div className="flex items-center gap-1 game-subplate rounded-xl p-1 overflow-x-auto">
          {OPERATOR_THEMES.map((op) => {
            const isActive = currentOperator.id === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onSelectOperator(op)}
                style={
                  isActive
                    ? { backgroundColor: op.primaryColor, borderColor: op.accentColor }
                    : undefined
                }
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap border ${
                  isActive
                    ? 'text-zinc-950 shadow-[0_2px_10px_rgba(245,158,11,0.35)] font-black'
                    : 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
                title={op.name}
              >
                <span>{op.badge}</span>
                <span className="hidden sm:inline">{op.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 game-subplate px-2.5 py-1 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
          <span>
            Seamless Wallet API:{' '}
            <strong className="text-emerald-400">
              {t.operator.walletOk} ({currentOperator.apiLatency})
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenProvablyFair}
          className="text-[10px] text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 rounded-lg border border-amber-500/35 transition-colors shadow-sm"
          title={t.provablyFair.subtitle}
        >
          <span>🛡️</span>
          <span>{t.operator.provablyFairBtn}</span>
        </button>
      </div>
    </div>
  );
};
