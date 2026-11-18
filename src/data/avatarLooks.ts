export type AvatarHairStyle = 'fade' | 'afro' | 'ponytail' | 'locs' | 'braids';

export type AvatarHeadwear =
  | 'royal-crown'
  | 'imperial-crown'
  | 'headphones-visor'
  | 'visor-band'
  | 'royal-headband'
  | 'flame-bandana'
  | 'martial-headband'
  | 'aviator-goggles'
  | 'stealth-hood'
  | 'crystal-visor'
  | 'bucket-hat'
  | 'shades-band'
  | 'samakaka-wrap'
  | 'driver-cap';

export type AvatarPattern =
  | 'royal-cape'
  | 'imperial-armor'
  | 'angola-sash'
  | 'candonga-vest'
  | 'samakaka-tunic'
  | 'racing-chevron'
  | 'track-stripes'
  | 'martial-gi'
  | 'standard';

export interface AvatarLook {
  skin: string;
  skinShadow: string;
  hair: string;
  hairStyle: AvatarHairStyle;
  isFeminine?: boolean;
  jacket: string;
  jacketAccent: string;
  shirt: string;
  pants: string;
  shoes: string;
  capeOrScarf?: string;
  headwear: AvatarHeadwear;
  headwearColor: string;
  headwearAccent: string;
  pattern: AvatarPattern;
}

const PRESET_LOOKS: Record<string, AvatarLook> = {
  'rei-zero': {
    skin: '#8d5524',
    skinShadow: '#5c3310',
    hair: '#09090b',
    hairStyle: 'fade',
    isFeminine: false,
    jacket: '#18181b',
    jacketAccent: '#facc15',
    shirt: '#7f1d1d',
    pants: '#0f172a',
    shoes: '#f59e0b',
    capeOrScarf: '#b91c1c',
    headwear: 'royal-crown',
    headwearColor: '#facc15',
    headwearAccent: '#dc2626',
    pattern: 'royal-cape',
  },
  'kudurista-supremo': {
    skin: '#7c4722',
    skinShadow: '#4f2b12',
    hair: '#09090b',
    hairStyle: 'locs',
    isFeminine: false,
    jacket: '#0369a1',
    jacketAccent: '#38bdf8',
    shirt: '#0f172a',
    pants: '#1e293b',
    shoes: '#38bdf8',
    capeOrScarf: undefined,
    headwear: 'headphones-visor',
    headwearColor: '#38bdf8',
    headwearAccent: '#facc15',
    pattern: 'racing-chevron',
  },
  'pantera-marginal': {
    skin: '#9c6234',
    skinShadow: '#6b3e1b',
    hair: '#18181b',
    hairStyle: 'ponytail',
    isFeminine: true,
    jacket: '#9d174d',
    jacketAccent: '#f472b6',
    shirt: '#18181b',
    pants: '#1e1b4b',
    shoes: '#ec4899',
    capeOrScarf: '#be185d',
    headwear: 'visor-band',
    headwearColor: '#ec4899',
    headwearAccent: '#fef08a',
    pattern: 'track-stripes',
  },
  'furia-samba': {
    skin: '#6f3e1e',
    skinShadow: '#47240f',
    hair: '#09090b',
    hairStyle: 'afro',
    isFeminine: false,
    jacket: '#c2410c',
    jacketAccent: '#fb923c',
    shirt: '#1c1917',
    pants: '#27272a',
    shoes: '#f97316',
    capeOrScarf: undefined,
    headwear: 'flame-bandana',
    headwearColor: '#ea580c',
    headwearAccent: '#facc15',
    pattern: 'racing-chevron',
  },
  'espectro-roxo': {
    skin: '#8b572a',
    skinShadow: '#593416',
    hair: '#09090b',
    hairStyle: 'fade',
    isFeminine: false,
    jacket: '#4c1d95',
    jacketAccent: '#c084fc',
    shirt: '#09090b',
    pants: '#1e1b4b',
    shoes: '#a855f7',
    capeOrScarf: '#581c87',
    headwear: 'stealth-hood',
    headwearColor: '#3b0764',
    headwearAccent: '#c084fc',
    pattern: 'standard',
  },
  'diamante-lunda': {
    skin: '#7a4924',
    skinShadow: '#4d2b12',
    hair: '#18181b',
    hairStyle: 'fade',
    isFeminine: false,
    jacket: '#047857',
    jacketAccent: '#34d399',
    shirt: '#022c22',
    pants: '#064e3b',
    shoes: '#10b981',
    capeOrScarf: undefined,
    headwear: 'crystal-visor',
    headwearColor: '#38bdf8',
    headwearAccent: '#a7f3d0',
    pattern: 'track-stripes',
  },
  'princesa-samakaka': {
    skin: '#8f592e',
    skinShadow: '#5e3617',
    hair: '#09090b',
    hairStyle: 'braids',
    isFeminine: true,
    jacket: '#be123c',
    jacketAccent: '#facc15',
    shirt: '#18181b',
    pants: '#1c1917',
    shoes: '#e11d48',
    capeOrScarf: '#9f1239',
    headwear: 'samakaka-wrap',
    headwearColor: '#be123c',
    headwearAccent: '#facc15',
    pattern: 'samakaka-tunic',
  },
  'general-kwanza': {
    skin: '#6c3c1b',
    skinShadow: '#42220d',
    hair: '#09090b',
    hairStyle: 'fade',
    isFeminine: false,
    jacket: '#3f6212',
    jacketAccent: '#eab308',
    shirt: '#1a2e05',
    pants: '#1f2937',
    shoes: '#ca8a04',
    capeOrScarf: undefined,
    headwear: 'aviator-goggles',
    headwearColor: '#facc15',
    headwearAccent: '#dc2626',
    pattern: 'angola-sash',
  },
  'mestre-capoeira': {
    skin: '#945b2d',
    skinShadow: '#613817',
    hair: '#09090b',
    hairStyle: 'locs',
    isFeminine: false,
    jacket: '#15803d',
    jacketAccent: '#facc15',
    shirt: '#f8fafc',
    pants: '#f1f5f9',
    shoes: '#16a34a',
    capeOrScarf: undefined,
    headwear: 'martial-headband',
    headwearColor: '#16a34a',
    headwearAccent: '#facc15',
    pattern: 'martial-gi',
  },
  'imperador-ouro': {
    skin: '#7e4a23',
    skinShadow: '#4e2b11',
    hair: '#09090b',
    hairStyle: 'fade',
    isFeminine: false,
    jacket: '#92400e',
    jacketAccent: '#fde047',
    shirt: '#18181b',
    pants: '#1e1b4b',
    shoes: '#facc15',
    capeOrScarf: '#b45309',
    headwear: 'imperial-crown',
    headwearColor: '#facc15',
    headwearAccent: '#38bdf8',
    pattern: 'imperial-armor',
  },
  'bot-kota-banza': {
    skin: '#774723',
    skinShadow: '#4a2a11',
    hair: '#3f3f46',
    hairStyle: 'fade',
    isFeminine: false,
    jacket: '#0f766e',
    jacketAccent: '#38bdf8',
    shirt: '#0f172a',
    pants: '#1e293b',
    shoes: '#0284c7',
    capeOrScarf: undefined,
    headwear: 'bucket-hat',
    headwearColor: '#0284c7',
    headwearAccent: '#facc15',
    pattern: 'angola-sash',
  },
  'bot-zito-kuduro': {
    skin: '#8a552c',
    skinShadow: '#593317',
    hair: '#09090b',
    hairStyle: 'afro',
    isFeminine: false,
    jacket: '#6d28d9',
    jacketAccent: '#c084fc',
    shirt: '#18181b',
    pants: '#09090b',
    shoes: '#a855f7',
    capeOrScarf: undefined,
    headwear: 'shades-band',
    headwearColor: '#7c3aed',
    headwearAccent: '#facc15',
    pattern: 'racing-chevron',
  },
  'bot-tia-maria': {
    skin: '#865028',
    skinShadow: '#553015',
    hair: '#18181b',
    hairStyle: 'braids',
    isFeminine: true,
    jacket: '#be123c',
    jacketAccent: '#fbbf24',
    shirt: '#fef3c7',
    pants: '#312e81',
    shoes: '#e11d48',
    capeOrScarf: '#f43f5e',
    headwear: 'samakaka-wrap',
    headwearColor: '#e11d48',
    headwearAccent: '#facc15',
    pattern: 'samakaka-tunic',
  },
  'bot-beto-candonga': {
    skin: '#6e3f1d',
    skinShadow: '#43240d',
    hair: '#09090b',
    hairStyle: 'fade',
    isFeminine: false,
    jacket: '#0369a1',
    jacketAccent: '#f8fafc',
    shirt: '#10b981',
    pants: '#1e293b',
    shoes: '#10b981',
    capeOrScarf: undefined,
    headwear: 'driver-cap',
    headwearColor: '#0284c7',
    headwearAccent: '#f8fafc',
    pattern: 'candonga-vest',
  },
};

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveAvatarLook(
  avatarId?: string | null,
  name?: string | null,
  color?: string | null
): AvatarLook {
  const cleanId = (avatarId || '').trim().toLowerCase();
  if (cleanId && PRESET_LOOKS[cleanId]) {
    const base = PRESET_LOOKS[cleanId];
    return color && color !== base.jacketAccent && !cleanId.startsWith('bot-') && cleanId !== 'rei-zero'
      ? { ...base, jacketAccent: color }
      : base;
  }

  const lowerName = (name || '').toLowerCase();
  if (lowerName.includes('kota') || lowerName.includes('banza')) return PRESET_LOOKS['bot-kota-banza'];
  if (lowerName.includes('zito')) return PRESET_LOOKS['bot-zito-kuduro'];
  if (lowerName.includes('tia maria')) return PRESET_LOOKS['bot-tia-maria'];
  if (lowerName.includes('beto') || lowerName.includes('candonga')) return PRESET_LOOKS['bot-beto-candonga'];
  if (lowerName.includes('rei 00') || lowerName.includes('rei zero')) return PRESET_LOOKS['rei-zero'];

  const seed = hashString(`${cleanId}|${lowerName}|${color || ''}`);
  const hairStyles: AvatarHairStyle[] = ['fade', 'afro', 'ponytail', 'locs', 'braids'];
  const headwears: AvatarHeadwear[] = [
    'royal-headband',
    'visor-band',
    'bucket-hat',
    'shades-band',
    'headphones-visor',
  ];
  const accent = color || '#f59e0b';

  return {
    skin: '#8d5524',
    skinShadow: '#5c3310',
    hair: '#09090b',
    hairStyle: hairStyles[seed % hairStyles.length],
    isFeminine: seed % 3 === 1,
    jacket: '#1e293b',
    jacketAccent: accent,
    shirt: '#0f172a',
    pants: '#09090b',
    shoes: accent,
    capeOrScarf: undefined,
    headwear: headwears[seed % headwears.length],
    headwearColor: accent,
    headwearAccent: '#facc15',
    pattern: 'track-stripes',
  };
}
