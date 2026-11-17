import { CurrencyCode, SupportedLanguage } from '../types/game';

export interface GeoLocaleResult {
  countryCode: string;
  countryName: string;
  flag: string;
  language: SupportedLanguage;
  currency: CurrencyCode;
  source: 'timezone' | 'browser' | 'ip' | 'default';
}

interface CountryMapping {
  countryCode: string;
  countryName: string;
  flag: string;
  language: SupportedLanguage;
  currency: CurrencyCode;
}

export const COUNTRY_LOCALE_MAP: Record<string, CountryMapping> = {
  AO: { countryCode: 'AO', countryName: 'Angola', flag: '🇦🇴', language: 'pt', currency: 'AOA' },
  PT: { countryCode: 'PT', countryName: 'Portugal', flag: '🇵🇹', language: 'pt', currency: 'EUR' },
  BR: { countryCode: 'BR', countryName: 'Brasil', flag: '🇧🇷', language: 'pt', currency: 'BRL' },
  MZ: { countryCode: 'MZ', countryName: 'Moçambique', flag: '🇲🇿', language: 'pt', currency: 'USD' },
  CV: { countryCode: 'CV', countryName: 'Cabo Verde', flag: '🇨🇻', language: 'pt', currency: 'EUR' },
  CO: { countryCode: 'CO', countryName: 'Colombia', flag: '🇨🇴', language: 'es-CO', currency: 'COP' },
  MX: { countryCode: 'MX', countryName: 'México', flag: '🇲🇽', language: 'es-MX', currency: 'MXN' },
  ES: { countryCode: 'ES', countryName: 'España', flag: '🇪🇸', language: 'es', currency: 'EUR' },
  AR: { countryCode: 'AR', countryName: 'Argentina', flag: '🇦🇷', language: 'es', currency: 'USD' },
  CL: { countryCode: 'CL', countryName: 'Chile', flag: '🇨🇱', language: 'es', currency: 'USD' },
  PE: { countryCode: 'PE', countryName: 'Perú', flag: '🇵🇪', language: 'es', currency: 'USD' },
  US: { countryCode: 'US', countryName: 'United States', flag: '🇺🇸', language: 'en', currency: 'USD' },
  GB: { countryCode: 'GB', countryName: 'United Kingdom', flag: '🇬🇧', language: 'en', currency: 'GBP' },
  CA: { countryCode: 'CA', countryName: 'Canada', flag: '🇨🇦', language: 'en', currency: 'USD' },
  AU: { countryCode: 'AU', countryName: 'Australia', flag: '🇦🇺', language: 'en', currency: 'USD' },
  FR: { countryCode: 'FR', countryName: 'France', flag: '🇫🇷', language: 'fr', currency: 'EUR' },
  BE: { countryCode: 'BE', countryName: 'Belgique', flag: '🇧🇪', language: 'fr', currency: 'EUR' },
  DE: { countryCode: 'DE', countryName: 'Deutschland', flag: '🇩🇪', language: 'de', currency: 'EUR' },
  AT: { countryCode: 'AT', countryName: 'Österreich', flag: '🇦🇹', language: 'de', currency: 'EUR' },
  CH: { countryCode: 'CH', countryName: 'Schweiz', flag: '🇨🇭', language: 'de', currency: 'EUR' },
  IT: { countryCode: 'IT', countryName: 'Italia', flag: '🇮🇹', language: 'it', currency: 'EUR' },
  CN: { countryCode: 'CN', countryName: '中国 (China)', flag: '🇨🇳', language: 'zh-CN', currency: 'CNY' },
  SG: { countryCode: 'SG', countryName: 'Singapore', flag: '🇸🇬', language: 'zh-CN', currency: 'USD' },
  TW: { countryCode: 'TW', countryName: '台灣 (Taiwan)', flag: '🇹🇼', language: 'zh-TW', currency: 'TWD' },
  HK: { countryCode: 'HK', countryName: '香港 (Hong Kong)', flag: '🇭🇰', language: 'zh-TW', currency: 'USD' },
  MO: { countryCode: 'MO', countryName: '澳門 (Macau)', flag: '🇲🇴', language: 'zh-TW', currency: 'USD' },
  EG: { countryCode: 'EG', countryName: 'مصر (Egypt)', flag: '🇪🇬', language: 'ar-EG', currency: 'EGP' },
  KE: { countryCode: 'KE', countryName: 'Kenya', flag: '🇰🇪', language: 'sw', currency: 'KES' },
  TZ: { countryCode: 'TZ', countryName: 'Tanzania', flag: '🇹🇿', language: 'sw', currency: 'USD' },
  UG: { countryCode: 'UG', countryName: 'Uganda', flag: '🇺🇬', language: 'sw', currency: 'USD' },
  ZA: { countryCode: 'ZA', countryName: 'South Africa', flag: '🇿🇦', language: 'en', currency: 'USD' },
  NG: { countryCode: 'NG', countryName: 'Nigeria', flag: '🇳🇬', language: 'en', currency: 'USD' },
  CD: { countryCode: 'CD', countryName: 'RDC / Congo', flag: '🇨🇩', language: 'fr', currency: 'USD' },
};

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  'Africa/Luanda': 'AO',
  'Europe/Lisbon': 'PT',
  'Atlantic/Madeira': 'PT',
  'Atlantic/Azores': 'PT',
  'America/Sao_Paulo': 'BR',
  'America/Fortaleza': 'BR',
  'America/Recife': 'BR',
  'America/Manaus': 'BR',
  'America/Belem': 'BR',
  'America/Bahia': 'BR',
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Cancun': 'MX',
  'America/Tijuana': 'MX',
  'America/Merida': 'MX',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Buenos_Aires': 'AR',
  'America/Santiago': 'CL',
  'America/Lima': 'PE',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'Europe/London': 'GB',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Europe/Paris': 'FR',
  'Europe/Brussels': 'BE',
  'Europe/Berlin': 'DE',
  'Europe/Munich': 'DE',
  'Europe/Vienna': 'AT',
  'Europe/Zurich': 'CH',
  'Europe/Rome': 'IT',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Urumqi': 'CN',
  'Asia/Taipei': 'TW',
  'Asia/Hong_Kong': 'HK',
  'Asia/Macau': 'MO',
  'Asia/Singapore': 'SG',
  'Africa/Cairo': 'EG',
  'Africa/Nairobi': 'KE',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kampala': 'UG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Kinshasa': 'CD',
  'Africa/Maputo': 'MZ',
};

function mapLanguageTagToLocale(tag: string): CountryMapping | null {
  const norm = tag.toLowerCase();
  if (norm === 'pt-ao' || norm.startsWith('pt-ao')) return COUNTRY_LOCALE_MAP.AO;
  if (norm === 'pt-br' || norm.startsWith('pt-br')) return COUNTRY_LOCALE_MAP.BR;
  if (norm === 'pt-pt' || norm === 'pt') return COUNTRY_LOCALE_MAP.PT;
  if (norm.startsWith('es-co')) return COUNTRY_LOCALE_MAP.CO;
  if (norm.startsWith('es-mx')) return COUNTRY_LOCALE_MAP.MX;
  if (norm.startsWith('es')) return COUNTRY_LOCALE_MAP.ES;
  if (norm === 'zh-tw' || norm === 'zh-hk' || norm === 'zh-hant') return COUNTRY_LOCALE_MAP.TW;
  if (norm.startsWith('zh')) return COUNTRY_LOCALE_MAP.CN;
  if (norm.startsWith('fr')) return COUNTRY_LOCALE_MAP.FR;
  if (norm.startsWith('de')) return COUNTRY_LOCALE_MAP.DE;
  if (norm.startsWith('it')) return COUNTRY_LOCALE_MAP.IT;
  if (norm.startsWith('ar')) return COUNTRY_LOCALE_MAP.EG;
  if (norm.startsWith('sw')) return COUNTRY_LOCALE_MAP.KE;
  if (norm === 'en-gb') return COUNTRY_LOCALE_MAP.GB;
  if (norm.startsWith('en')) return COUNTRY_LOCALE_MAP.US;
  return null;
}

/**
 * Synchronous, 100% offline-capable detection using system timezone and browser languages.
 */
export function detectLocationSync(): GeoLocaleResult {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY_MAP[tz]) {
      const cc = TIMEZONE_COUNTRY_MAP[tz];
      const match = COUNTRY_LOCALE_MAP[cc];
      if (match) {
        return { ...match, source: 'timezone' };
      }
    }
  } catch {
    // Ignore Intl errors
  }

  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of langs) {
      if (!tag) continue;
      const mapped = mapLanguageTagToLocale(tag);
      if (mapped) {
        return { ...mapped, source: 'browser' };
      }
    }
  }

  return { ...COUNTRY_LOCALE_MAP.AO, source: 'default' };
}

/**
 * Online country detection via IP geolocation with fast timeout & clean offline fallback.
 */
export async function detectLocationOnline(): Promise<GeoLocaleResult> {
  const fallback = detectLocationSync();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return fallback;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2600);

  try {
    const resp = await fetch('https://ipwho.is/', { signal: controller.signal });
    if (!resp.ok) return fallback;
    const data = (await resp.json()) as {
      success?: boolean;
      country_code?: string;
      country?: string;
    };
    if (!data?.success || !data.country_code) return fallback;

    const cc = data.country_code.toUpperCase();
    const mapped = COUNTRY_LOCALE_MAP[cc];
    if (mapped) {
      return {
        ...mapped,
        countryName: data.country || mapped.countryName,
        source: 'ip',
      };
    }

    return {
      countryCode: cc,
      countryName: data.country || cc,
      flag: '🌍',
      language: 'en',
      currency: 'USD',
      source: 'ip',
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeoutId);
  }
}
