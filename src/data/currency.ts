import { CurrencyCode, ThreeTorneirasSplit } from '../types/game';

export const MIN_BET_KZ = 50;
export const MAX_BET_KZ = 5_000_000;
export const PASSE_DO_REI_MONTHLY_KZ = 5000;

export function clampBetKz(amountKz: number): number {
  const safe = Math.round(Number.isFinite(amountKz) ? amountKz : MIN_BET_KZ);
  return Math.max(MIN_BET_KZ, Math.min(MAX_BET_KZ, safe));
}

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  flag: string;
  name: string;
  defaultKzPerUnit: number;
  decimals: number;
}

export type ExchangeRatesMap = Record<CurrencyCode, number>;

export interface CachedFxState {
  rates: ExchangeRatesMap;
  updatedAt: number;
  isLive: boolean;
}

const FX_STORAGE_KEY = 'rei_zero_fx_rates_v2';
const FX_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  AOA: {
    code: 'AOA',
    symbol: 'Kz',
    flag: '🇦🇴',
    name: 'Kwanza Angolano',
    defaultKzPerUnit: 1,
    decimals: 0,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    name: 'US Dollar',
    defaultKzPerUnit: 920,
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    flag: '🇪🇺',
    name: 'Euro',
    defaultKzPerUnit: 995,
    decimals: 2,
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    flag: '🇧🇷',
    name: 'Real Brasileiro',
    defaultKzPerUnit: 165,
    decimals: 2,
  },
  COP: {
    code: 'COP',
    symbol: 'COL$',
    flag: '🇨🇴',
    name: 'Peso Colombiano',
    defaultKzPerUnit: 0.22,
    decimals: 0,
  },
  MXN: {
    code: 'MXN',
    symbol: 'MX$',
    flag: '🇲🇽',
    name: 'Peso Mexicano',
    defaultKzPerUnit: 46,
    decimals: 1,
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    flag: '🇨🇳',
    name: 'Renminbi (Yuan)',
    defaultKzPerUnit: 128,
    decimals: 2,
  },
  TWD: {
    code: 'TWD',
    symbol: 'NT$',
    flag: '🇹🇼',
    name: 'New Taiwan Dollar',
    defaultKzPerUnit: 29,
    decimals: 0,
  },
  EGP: {
    code: 'EGP',
    symbol: 'E£',
    flag: '🇪🇬',
    name: 'Egyptian Pound',
    defaultKzPerUnit: 19,
    decimals: 1,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    flag: '🇬🇧',
    name: 'British Pound',
    defaultKzPerUnit: 1170,
    decimals: 2,
  },
  KES: {
    code: 'KES',
    symbol: 'KSh',
    flag: '🇰🇪',
    name: 'Kenyan Shilling',
    defaultKzPerUnit: 7.1,
    decimals: 0,
  },
};

export const CURRENCY_LIST: CurrencyMeta[] = Object.values(CURRENCIES);

export function getDefaultRatesMap(): ExchangeRatesMap {
  return {
    AOA: CURRENCIES.AOA.defaultKzPerUnit,
    USD: CURRENCIES.USD.defaultKzPerUnit,
    EUR: CURRENCIES.EUR.defaultKzPerUnit,
    BRL: CURRENCIES.BRL.defaultKzPerUnit,
    COP: CURRENCIES.COP.defaultKzPerUnit,
    MXN: CURRENCIES.MXN.defaultKzPerUnit,
    CNY: CURRENCIES.CNY.defaultKzPerUnit,
    TWD: CURRENCIES.TWD.defaultKzPerUnit,
    EGP: CURRENCIES.EGP.defaultKzPerUnit,
    GBP: CURRENCIES.GBP.defaultKzPerUnit,
    KES: CURRENCIES.KES.defaultKzPerUnit,
  };
}

/**
 * Distribuição Oficial "As 3 Torneiras do Rei":
 * 70% Vencedores (50% 1º Lugar, 20% 2º Lugar, 0% 3º Lugar), 20% Casa, 10% Criador.
 */
export function calculateThreeTorneiras(betKz: number, playerCount: number): ThreeTorneirasSplit {
  const safeBet = Math.max(0, Math.floor(Number.isFinite(betKz) ? betKz : 0));
  const clampedPlayers = Math.max(2, Math.min(5, Math.round(playerCount || 5)));
  const totalPotKz = safeBet * clampedPlayers;

  const winnersPotKz = Math.floor(totalPotKz * 0.7);
  const houseFeeKz = Math.floor(totalPotKz * 0.2);
  const creatorRoyaltyKz = Math.max(0, totalPotKz - winnersPotKz - houseFeeKz);

  const firstPrizeKz = Math.floor(totalPotKz * 0.5);
  const secondPrizeKz = Math.max(0, winnersPotKz - firstPrizeKz);
  const thirdPrizeKz = 0;

  return {
    totalPotKz,
    winnersPotKz,
    houseFeeKz,
    creatorRoyaltyKz,
    firstPrizeKz,
    secondPrizeKz,
    thirdPrizeKz,
  };
}

export function convertKzToCurrency(
  amountKz: number,
  currency: CurrencyCode,
  rates?: ExchangeRatesMap
): number {
  const safeKz = Number.isFinite(amountKz) ? amountKz : 0;
  const meta = CURRENCIES[currency] || CURRENCIES.AOA;
  const kzPerUnit = rates?.[currency] || meta.defaultKzPerUnit || 1;
  return safeKz / kzPerUnit;
}

export function convertCurrencyToKz(
  localAmount: number,
  currency: CurrencyCode,
  rates?: ExchangeRatesMap
): number {
  const safeLocal = Number.isFinite(localAmount) ? localAmount : 0;
  const meta = CURRENCIES[currency] || CURRENCIES.AOA;
  const kzPerUnit = rates?.[currency] || meta.defaultKzPerUnit || 1;
  return Math.round(safeLocal * kzPerUnit);
}

export function formatKz(amountKz: number): string {
  const rounded = Math.round(Number.isFinite(amountKz) ? amountKz : 0);
  return `${rounded.toLocaleString('pt-PT')} Kz`;
}

export function formatUsd(amountKz: number, rates?: ExchangeRatesMap): string {
  const kzPerUsd = rates?.USD || CURRENCIES.USD.defaultKzPerUnit;
  const usd = (Number.isFinite(amountKz) ? amountKz : 0) / kzPerUsd;
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCurrency(
  amountKz: number,
  currency: CurrencyCode,
  rates?: ExchangeRatesMap
): string {
  const meta = CURRENCIES[currency] || CURRENCIES.AOA;
  if (currency === 'AOA') {
    return formatKz(amountKz);
  }
  const value = convertKzToCurrency(amountKz, currency, rates);
  const absVal = Math.abs(value);
  const decimals = absVal > 0 && absVal < 0.1 && meta.decimals < 2 ? 2 : meta.decimals;
  const formattedNum = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${meta.symbol}${formattedNum}`;
}

export interface CrossBorderParityItem {
  currency: CurrencyCode;
  flag: string;
  symbol: string;
  formatted: string;
  localAmount: number;
}

const DEFAULT_PARITY_CURRENCIES: CurrencyCode[] = [
  'AOA',
  'USD',
  'EUR',
  'BRL',
  'COP',
  'MXN',
  'CNY',
  'GBP',
];

export function getCrossBorderStakeParity(
  betAmountKz: number,
  rates?: ExchangeRatesMap,
  currencies: CurrencyCode[] = DEFAULT_PARITY_CURRENCIES
): CrossBorderParityItem[] {
  return currencies.map((code) => {
    const meta = CURRENCIES[code] || CURRENCIES.AOA;
    return {
      currency: code,
      flag: meta.flag,
      symbol: meta.symbol,
      formatted: formatCurrency(betAmountKz, code, rates),
      localAmount: convertKzToCurrency(betAmountKz, code, rates),
    };
  });
}

export interface QuickBetChip {
  kz: number;
  label: string;
}

const BASE_KZ_CHIPS = [50, 250, 500, 2500, 10000, 100000, 5000000];

function formatCompactChipValue(val: number, decimals: number): string {
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (val >= 1000) {
    const k = val / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  if (val >= 10 || decimals === 0) {
    return `${Math.round(val)}`;
  }
  return val.toFixed(1);
}

export function getQuickBetChipsKz(
  currency: CurrencyCode,
  rates?: ExchangeRatesMap
): QuickBetChip[] {
  const meta = CURRENCIES[currency] || CURRENCIES.AOA;
  return BASE_KZ_CHIPS.map((kz) => {
    if (currency === 'AOA') {
      return {
        kz,
        label: formatCompactChipValue(kz, 0),
      };
    }
    const localVal = convertKzToCurrency(kz, currency, rates);
    return {
      kz,
      label: `${meta.symbol}${formatCompactChipValue(localVal, meta.decimals)}`,
    };
  });
}

export function loadCachedRates(): CachedFxState {
  const defaults = getDefaultRatesMap();
  if (typeof window === 'undefined') {
    return { rates: defaults, updatedAt: 0, isLive: false };
  }
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY);
    if (!raw) return { rates: defaults, updatedAt: 0, isLive: false };
    const parsed = JSON.parse(raw) as Partial<CachedFxState>;
    if (!parsed || !parsed.rates) {
      return { rates: defaults, updatedAt: 0, isLive: false };
    }
    const merged: ExchangeRatesMap = { ...defaults };
    (Object.keys(defaults) as CurrencyCode[]).forEach((code) => {
      const val = parsed.rates?.[code];
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        merged[code] = val;
      }
    });
    merged.AOA = 1;
    return {
      rates: merged,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      isLive: Boolean(parsed.isLive),
    };
  } catch {
    return { rates: defaults, updatedAt: 0, isLive: false };
  }
}

export async function refreshLiveExchangeRates(force = false): Promise<CachedFxState> {
  const cached = loadCachedRates();
  const now = Date.now();

  if (!force && cached.isLive && cached.updatedAt > 0 && now - cached.updatedAt < FX_CACHE_TTL_MS) {
    return cached;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    });
    if (!resp.ok) return cached;
    const data = (await resp.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (data?.result !== 'success' || !data.rates || !data.rates.AOA) {
      return cached;
    }

    const aoaPerUsd = data.rates.AOA;
    const nextRates: ExchangeRatesMap = { ...getDefaultRatesMap(), AOA: 1 };

    (Object.keys(CURRENCIES) as CurrencyCode[]).forEach((code) => {
      if (code === 'AOA') {
        nextRates.AOA = 1;
        return;
      }
      const perUsd = code === 'USD' ? 1 : data.rates?.[code];
      if (typeof perUsd === 'number' && Number.isFinite(perUsd) && perUsd > 0) {
        nextRates[code] = aoaPerUsd / perUsd;
      }
    });

    const nextState: CachedFxState = {
      rates: nextRates,
      updatedAt: now,
      isLive: true,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(nextState));
      } catch {
        // Ignore storage quota errors
      }
    }

    return nextState;
  } catch {
    return cached;
  } finally {
    clearTimeout(timeoutId);
  }
}
