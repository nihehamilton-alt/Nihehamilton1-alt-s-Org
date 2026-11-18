import { PowerUpType, SupportedLanguage } from '../types/game';
import { AVATARS, AvatarItem } from './avatars';
import { ANGOLAN_BOTS, AngolanBotProfile } from './bots';
import { DAILY_MISSIONS } from './missions';
import { POWER_UPS } from './obstacles';
import { AppTranslations, LanguageMetadata } from './translations/types';
import { CORE_LANGUAGES } from './translations/coreLanguages';
import { ANGOLAN_LANGUAGES } from './translations/angolanLanguages';
import { WORLD_LANGUAGES } from './translations/worldLanguages';

export type { AppTranslations, LanguageMetadata } from './translations/types';

export const LANGUAGE_LIST: LanguageMetadata[] = [
  {
    code: 'pt',
    flag: '🇦🇴',
    nativeName: 'Português (AO/PT/BR)',
    englishName: 'Portuguese',
    regionLabel: 'Angola · Brasil · Portugal',
  },
  {
    code: 'en',
    flag: '🇺🇸',
    nativeName: 'English',
    englishName: 'English',
    regionLabel: 'Global',
  },
  {
    code: 'umb',
    flag: '🇦🇴',
    nativeName: 'Umbundu',
    englishName: 'Umbundu (Angola)',
    regionLabel: 'Huambo · Benguela · Bié',
  },
  {
    code: 'kmb',
    flag: '🇦🇴',
    nativeName: 'Kimbundu',
    englishName: 'Kimbundu (Angola)',
    regionLabel: 'Luanda · Malanje · Kwanza',
  },
  {
    code: 'kik',
    flag: '🇦🇴',
    nativeName: 'Kikongo',
    englishName: 'Kikongo (Angola)',
    regionLabel: 'Uíge · Zaire · Cabinda',
  },
  {
    code: 'sw',
    flag: '🇰🇪',
    nativeName: 'Kiswahili',
    englishName: 'Swahili',
    regionLabel: 'East & Central Africa',
  },
  {
    code: 'es',
    flag: '🇪🇸',
    nativeName: 'Español',
    englishName: 'Spanish',
    regionLabel: 'España · Latam',
  },
  {
    code: 'es-CO',
    flag: '🇨🇴',
    nativeName: 'Español (Colombia)',
    englishName: 'Colombian Spanish',
    regionLabel: 'Colombia',
  },
  {
    code: 'es-MX',
    flag: '🇲🇽',
    nativeName: 'Español (México)',
    englishName: 'Mexican Spanish',
    regionLabel: 'México',
  },
  {
    code: 'fr',
    flag: '🇫🇷',
    nativeName: 'Français',
    englishName: 'French',
    regionLabel: 'France · Afrique',
  },
  {
    code: 'de',
    flag: '🇩🇪',
    nativeName: 'Deutsch',
    englishName: 'German',
    regionLabel: 'Deutschland · Österreich',
  },
  {
    code: 'it',
    flag: '🇮🇹',
    nativeName: 'Italiano',
    englishName: 'Italian',
    regionLabel: 'Italia',
  },
  {
    code: 'zh-CN',
    flag: '🇨🇳',
    nativeName: '简体中文',
    englishName: 'Chinese (Simplified)',
    regionLabel: '中国大陆 · Singapore',
  },
  {
    code: 'zh-TW',
    flag: '🇹🇼',
    nativeName: '繁體中文',
    englishName: 'Chinese (Traditional)',
    regionLabel: '台灣 · 香港 · 澳門',
  },
  {
    code: 'ar-EG',
    flag: '🇪🇬',
    nativeName: 'العربية (مصر)',
    englishName: 'Arabic (Egypt)',
    regionLabel: 'مصر · MENA',
    isRtl: true,
  },
];

export const LANGUAGE_MAP: Record<SupportedLanguage, LanguageMetadata> = LANGUAGE_LIST.reduce(
  (acc, item) => {
    acc[item.code] = item;
    return acc;
  },
  {} as Record<SupportedLanguage, LanguageMetadata>
);

export const TRANSLATIONS: Record<SupportedLanguage, AppTranslations> = {
  pt: CORE_LANGUAGES.pt,
  en: CORE_LANGUAGES.en,
  es: CORE_LANGUAGES.es,
  fr: CORE_LANGUAGES.fr,
  de: CORE_LANGUAGES.de,
  it: CORE_LANGUAGES.it,
  umb: ANGOLAN_LANGUAGES.umb,
  kmb: ANGOLAN_LANGUAGES.kmb,
  kik: ANGOLAN_LANGUAGES.kik,
  sw: ANGOLAN_LANGUAGES.sw,
  'zh-CN': WORLD_LANGUAGES['zh-CN'],
  'zh-TW': WORLD_LANGUAGES['zh-TW'],
  'es-CO': WORLD_LANGUAGES['es-CO'],
  'es-MX': WORLD_LANGUAGES['es-MX'],
  'ar-EG': WORLD_LANGUAGES['ar-EG'],
};

const AVATAR_EN_OVERRIDES: Record<
  string,
  { name: string; title: string; description: string }
> = {
  'rei-zero': {
    name: 'King Zero',
    title: 'Monarch of the Marginal',
    description: 'Crimson royal cape, golden crown, and pure speed on the Luanda track.',
  },
  'kudurista-supremo': {
    name: 'Supreme Kudurista',
    title: 'Electric Beat',
    description: 'Neon headphones and explosive strides synced to Kuduro rhythm.',
  },
  'pantera-marginal': {
    name: 'Marginal Panther',
    title: 'Crimson Sprinter',
    description: 'Feline agility to clear potholes and dominate every lane switch.',
  },
  'furia-samba': {
    name: 'Samba Fury',
    title: 'Explosive Burst',
    description: 'Flame headband and fierce acceleration toward the Royal Throne.',
  },
  'espectro-roxo': {
    name: 'Purple Specter',
    title: 'Urban Shadow',
    description: 'Stealth hood and razor-sharp reflexes across all 5 lanes.',
  },
  'diamante-lunda': {
    name: 'Lunda Diamond',
    title: 'Crystal Visor',
    description: 'Emerald sprint suit inspired by the legendary diamonds of Lunda.',
  },
  'princesa-samakaka': {
    name: 'Princess Samakaka',
    title: 'Traditional Nobility',
    description: 'Iconic Angolan geometric attire with regal speed and determination.',
  },
  'general-kwanza': {
    name: 'General Kwanza',
    title: 'Armored Tactics',
    description: 'Aviator goggles and iron discipline straight to the finish line.',
  },
  'mestre-capoeira': {
    name: 'Ginga Master',
    title: 'Perfect Dodge',
    description: 'Street acrobat leaping effortlessly over any Luanda barrier.',
  },
  'imperador-ouro': {
    name: 'Golden Emperor',
    title: 'Supreme Legend',
    description: 'Gilded imperial armor forged for true conquerors of the Throne.',
  },
};

const BOT_EN_OVERRIDES: Record<string, { name: string; title: string }> = {
  'bot-kota-banza': { name: 'Kota Banza', title: 'Island Veteran' },
  'bot-zito-kuduro': { name: 'Zito Kuduro', title: 'Beat King' },
  'bot-tia-maria': { name: 'Tia Maria Zunga', title: 'Market Lightning' },
  'bot-beto-candonga': { name: 'Beto Candonga', title: 'Asphalt Ace' },
};

const MISSION_EN_OVERRIDES: Record<string, { title: string; description: string }> = {
  'warm-up': {
    title: 'Marginal Warm-Up',
    description: 'Complete 2 official 40-second races today.',
  },
  'coin-hunter': {
    title: 'Kwanza Hunter',
    description: 'Collect 25 golden coins during races.',
  },
  'podium-presence': {
    title: 'Podium Presence',
    description: 'Finish in the Top 3 on the Marginal in 2 races.',
  },
  'crown-conquest': {
    title: 'Crown Conquest',
    description: 'Win 1st place and ascend the Royal Throne.',
  },
};

const POWERUP_EN_OVERRIDES: Record<PowerUpType, string> = {
  'kikuuba-nitro': 'Kikuuba Nitro',
  'chapeu-kudurista': 'Kudurista Hat',
  gasosa: 'Cold Gasosa',
};

function isPortugueseFamily(lang: SupportedLanguage): boolean {
  return lang === 'pt' || lang === 'umb' || lang === 'kmb' || lang === 'kik';
}

export function getLocalizedAvatar(avatarId: string, lang: SupportedLanguage): AvatarItem {
  const base = AVATARS.find((a) => a.id === avatarId) || AVATARS[0];
  if (isPortugueseFamily(lang)) {
    return base;
  }
  const enOverride = AVATAR_EN_OVERRIDES[base.id];
  if (!enOverride) return base;
  return {
    ...base,
    name: enOverride.name,
    title: enOverride.title,
    description: enOverride.description,
  };
}

export function getLocalizedBot(botId: string, lang: SupportedLanguage): AngolanBotProfile {
  const base = ANGOLAN_BOTS.find((b) => b.id === botId) || ANGOLAN_BOTS[0];
  if (isPortugueseFamily(lang)) {
    return base;
  }
  const enOverride = BOT_EN_OVERRIDES[base.id];
  if (!enOverride) return base;
  return {
    ...base,
    name: enOverride.name,
    title: enOverride.title,
  };
}

export function getLocalizedMission(
  missionId: string,
  lang: SupportedLanguage
): { id: string; title: string; description: string } {
  const base = DAILY_MISSIONS.find((m) => m.id === missionId) || DAILY_MISSIONS[0];
  if (isPortugueseFamily(lang)) {
    return { id: base.id, title: base.title, description: base.description };
  }
  const enOverride = MISSION_EN_OVERRIDES[base.id];
  return {
    id: base.id,
    title: enOverride?.title || base.title,
    description: enOverride?.description || base.description,
  };
}

export function getLocalizedPowerUp(
  type: PowerUpType,
  lang: SupportedLanguage
): { type: PowerUpType; name: string; durationSeconds: number } {
  const base = POWER_UPS[type] || POWER_UPS['kikuuba-nitro'];
  if (isPortugueseFamily(lang)) {
    return {
      type: base.type,
      name: base.name,
      durationSeconds: base.durationSeconds,
    };
  }
  return {
    type: base.type,
    name: POWERUP_EN_OVERRIDES[base.type] || base.name,
    durationSeconds: base.durationSeconds,
  };
}
