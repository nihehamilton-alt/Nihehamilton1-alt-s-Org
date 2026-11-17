import React, { useState } from 'react';
import { Globe, MapPin, RefreshCw, X, Check, Coins, Sparkles } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { LANGUAGE_LIST } from '../data/translations';
import { CURRENCY_LIST, formatCurrency } from '../data/currency';

export const LanguageGeoModal: React.FC = () => {
  const {
    isModalOpen,
    closeModal,
    lang,
    currency,
    t,
    autoDetect,
    geoInfo,
    isDetectingLocation,
    fxState,
    rates,
    setLanguage,
    setCurrency,
    setAutoDetect,
    detectLocationNow,
    refreshFxNow,
  } = useI18n();

  const [activeTab, setActiveTab] = useState<'languages' | 'currencies'>('languages');
  const [refreshingFx, setRefreshingFx] = useState(false);

  if (!isModalOpen) return null;

  const handleRefreshFx = async () => {
    setRefreshingFx(true);
    try {
      await refreshFxNow();
    } finally {
      setRefreshingFx(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="game-panel-gold rounded-3xl max-w-3xl w-full shadow-[0_0_70px_rgba(245,158,11,0.28)] overflow-hidden my-4">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500/15 via-slate-900/60 to-sky-500/15 border-b border-amber-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl game-subplate border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.2)]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                {t.languageModal.title}
              </h2>
              <p className="text-[11px] text-slate-400 leading-snug">
                {t.languageModal.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-xl game-btn-secondary text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Geo Detection Bar */}
        <div className="px-5 py-3 game-subplate border-x-0 border-t-0 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-400">{t.languageModal.detectedLocation} </span>
              <span className="font-bold text-white">
                {geoInfo.flag} {geoInfo.countryName} ({geoInfo.countryCode})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoDetect(!autoDetect)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                autoDetect
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'game-panel text-slate-400'
              }`}
            >
              {t.languageModal.autoSyncLabel}: {autoDetect ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={detectLocationNow}
              disabled={isDetectingLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDetectingLocation ? 'animate-spin' : ''}`} />
              {isDetectingLocation ? t.languageModal.detectingBtn : t.languageModal.detectNowBtn}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex items-center gap-2 border-b border-slate-800/80 bg-zinc-950/60">
          <button
            type="button"
            onClick={() => setActiveTab('languages')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'languages'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            {t.languageModal.languagesTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('currencies')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'currencies'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            {t.languageModal.currenciesTab}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
          {activeTab === 'languages' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {LANGUAGE_LIST.map((item) => {
                const selected = item.code === lang;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLanguage(item.code, true)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-amber-500/15 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
                        : 'game-subplate hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl leading-none shrink-0">{item.flag}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">{item.nativeName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.englishName}</p>
                        <p className="text-[9px] text-amber-400/80 truncate">{item.regionLabel}</p>
                      </div>
                    </div>
                    {selected && (
                      <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-[11px] text-emerald-200 font-medium">
                    {t.languageModal.equalPotNote}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshFx}
                  disabled={refreshingFx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl game-subplate border border-emerald-500/40 text-emerald-300 text-[10px] font-bold cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingFx ? 'animate-spin' : ''}`} />
                  {fxState.isLive ? t.languageModal.fxStatusLive : t.languageModal.fxStatusOffline}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {CURRENCY_LIST.map((item) => {
                  const selected = item.code === currency;
                  const kzPerUnit = rates[item.code] || item.defaultKzPerUnit;
                  const example1000Kz = formatCurrency(1000, item.code, rates);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setCurrency(item.code, true)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        selected
                          ? 'bg-emerald-500/15 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.18)]'
                          : 'game-subplate hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl leading-none shrink-0">{item.flag}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-white">{item.code}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded game-panel text-slate-300 font-mono">
                              {item.symbol}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{item.name}</p>
                          <p className="text-[9px] text-emerald-300 font-mono">
                            1.000 Kz = {example1000Kz} ({kzPerUnit.toFixed(item.code === 'COP' ? 2 : 0)} Kz/u)
                          </p>
                        </div>
                      </div>
                      {selected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-zinc-950/80 border-t border-amber-500/20 flex items-center justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="px-5 py-2.5 rounded-xl game-btn-gold text-slate-950 font-black text-xs cursor-pointer"
          >
            {t.languageModal.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
