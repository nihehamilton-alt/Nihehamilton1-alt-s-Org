import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CurrencyCode, SupportedLanguage } from '../types/game';
import {
  CachedFxState,
  CURRENCIES,
  CurrencyMeta,
  ExchangeRatesMap,
  formatCurrency,
  loadCachedRates,
  refreshLiveExchangeRates,
} from '../data/currency';
import {
  AppTranslations,
  LANGUAGE_MAP,
  LanguageMetadata,
  TRANSLATIONS,
} from '../data/translations';
import { detectLocationOnline, detectLocationSync, GeoLocaleResult } from '../utils/geoLocale';

const STORAGE_KEYS = {
  lang: 'rei_zero_lang_v2',
  currency: 'rei_zero_currency_v2',
  manualLang: 'rei_zero_lang_manual_v2',
  manualCurrency: 'rei_zero_currency_manual_v2',
  autoDetect: 'rei_zero_autodetect_v2',
};

interface I18nContextValue {
  lang: SupportedLanguage;
  langMeta: LanguageMetadata;
  currency: CurrencyCode;
  currencyMeta: CurrencyMeta;
  t: AppTranslations;
  isRtl: boolean;
  autoDetect: boolean;
  geoInfo: GeoLocaleResult;
  isDetectingLocation: boolean;
  fxState: CachedFxState;
  rates: ExchangeRatesMap;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  setLanguage: (nextLang: SupportedLanguage, manual?: boolean) => void;
  setCurrency: (nextCurrency: CurrencyCode, manual?: boolean) => void;
  setAutoDetect: (enabled: boolean) => void;
  detectLocationNow: () => Promise<void>;
  refreshFxNow: () => Promise<void>;
  formatMoney: (amountKz: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isSupportedLanguage(val: string | null): val is SupportedLanguage {
  return Boolean(val && val in TRANSLATIONS);
}

function isSupportedCurrency(val: string | null): val is CurrencyCode {
  return Boolean(val && val in CURRENCIES);
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSyncGeo = useMemo(() => detectLocationSync(), []);

  const [autoDetect, setAutoDetectState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEYS.autoDetect);
    return saved === null ? true : saved === 'true';
  });

  const [lang, setLangState] = useState<SupportedLanguage>(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem(STORAGE_KEYS.lang);
      const isManual = localStorage.getItem(STORAGE_KEYS.manualLang) === 'true';
      if (isManual && isSupportedLanguage(savedLang)) {
        return savedLang;
      }
      if (isSupportedLanguage(savedLang) && localStorage.getItem(STORAGE_KEYS.autoDetect) === 'false') {
        return savedLang;
      }
    }
    return initialSyncGeo.language;
  });

  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    if (typeof window !== 'undefined') {
      const savedCurr = localStorage.getItem(STORAGE_KEYS.currency);
      const isManual = localStorage.getItem(STORAGE_KEYS.manualCurrency) === 'true';
      if (isManual && isSupportedCurrency(savedCurr)) {
        return savedCurr;
      }
      if (isSupportedCurrency(savedCurr) && localStorage.getItem(STORAGE_KEYS.autoDetect) === 'false') {
        return savedCurr;
      }
    }
    return initialSyncGeo.currency;
  });

  const [geoInfo, setGeoInfo] = useState<GeoLocaleResult>(initialSyncGeo);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [fxState, setFxState] = useState<CachedFxState>(() => loadCachedRates());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const setLanguage = useCallback((nextLang: SupportedLanguage, manual = true) => {
    setLangState(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.lang, nextLang);
      if (manual) {
        localStorage.setItem(STORAGE_KEYS.manualLang, 'true');
      }
    }
  }, []);

  const setCurrency = useCallback((nextCurrency: CurrencyCode, manual = true) => {
    setCurrencyState(nextCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.currency, nextCurrency);
      if (manual) {
        localStorage.setItem(STORAGE_KEYS.manualCurrency, 'true');
      }
    }
  }, []);

  const setAutoDetect = useCallback(
    (enabled: boolean) => {
      setAutoDetectState(enabled);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.autoDetect, String(enabled));
        if (enabled) {
          localStorage.removeItem(STORAGE_KEYS.manualLang);
          localStorage.removeItem(STORAGE_KEYS.manualCurrency);
        }
      }
      if (enabled) {
        setLangState(geoInfo.language);
        setCurrencyState(geoInfo.currency);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.lang, geoInfo.language);
          localStorage.setItem(STORAGE_KEYS.currency, geoInfo.currency);
        }
      }
    },
    [geoInfo]
  );

  const detectLocationNow = useCallback(async () => {
    setIsDetectingLocation(true);
    try {
      const detected = await detectLocationOnline();
      setGeoInfo(detected);
      setAutoDetectState(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.autoDetect, 'true');
        localStorage.removeItem(STORAGE_KEYS.manualLang);
        localStorage.removeItem(STORAGE_KEYS.manualCurrency);
        localStorage.setItem(STORAGE_KEYS.lang, detected.language);
        localStorage.setItem(STORAGE_KEYS.currency, detected.currency);
      }
      setLangState(detected.language);
      setCurrencyState(detected.currency);
    } finally {
      setIsDetectingLocation(false);
    }
  }, []);

  const refreshFxNow = useCallback(async () => {
    const next = await refreshLiveExchangeRates(true);
    setFxState(next);
  }, []);

  useEffect(() => {
    let active = true;

    const runBootstrap = async () => {
      const [detected, nextFx] = await Promise.all([
        detectLocationOnline(),
        refreshLiveExchangeRates(false),
      ]);
      if (!active) return;

      setGeoInfo(detected);
      setFxState(nextFx);

      const isManualLang =
        typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.manualLang) === 'true';
      const isManualCurr =
        typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.manualCurrency) === 'true';

      if (autoDetect) {
        if (!isManualLang) {
          setLangState(detected.language);
          localStorage.setItem(STORAGE_KEYS.lang, detected.language);
        }
        if (!isManualCurr) {
          setCurrencyState(detected.currency);
          localStorage.setItem(STORAGE_KEYS.currency, detected.currency);
        }
      }
    };

    runBootstrap();
    return () => {
      active = false;
    };
  }, [autoDetect]);

  const langMeta = LANGUAGE_MAP[lang] || LANGUAGE_MAP.pt;
  const currencyMeta = CURRENCIES[currency] || CURRENCIES.AOA;
  const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  const isRtl = Boolean(langMeta.isRtl);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    }
  }, [lang, isRtl]);

  const formatMoney = useCallback(
    (amountKz: number) => formatCurrency(amountKz, currency, fxState.rates),
    [currency, fxState.rates]
  );

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      langMeta,
      currency,
      currencyMeta,
      t,
      isRtl,
      autoDetect,
      geoInfo,
      isDetectingLocation,
      fxState,
      rates: fxState.rates,
      isModalOpen,
      openModal,
      closeModal,
      setLanguage,
      setCurrency,
      setAutoDetect,
      detectLocationNow,
      refreshFxNow,
      formatMoney,
    }),
    [
      lang,
      langMeta,
      currency,
      currencyMeta,
      t,
      isRtl,
      autoDetect,
      geoInfo,
      isDetectingLocation,
      fxState,
      isModalOpen,
      openModal,
      closeModal,
      setLanguage,
      setCurrency,
      setAutoDetect,
      detectLocationNow,
      refreshFxNow,
      formatMoney,
    ]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return ctx;
}
