export interface AvatarItem {
  id: string;
  name: string;
  title: string;
  description: string;
  avatar: string;
  color: string;
  priceKz: number;
  unlockedByDefault: boolean;
}

export const AVATARS: AvatarItem[] = [
  {
    id: 'rei-zero',
    name: 'Rei Zero',
    title: 'Monarca da Marginal',
    description: 'Manto carmesim, coroa dourada e velocidade real na pista de Luanda.',
    avatar: '🤴🏾',
    color: '#f59e0b',
    priceKz: 0,
    unlockedByDefault: true,
  },
  {
    id: 'kudurista-supremo',
    name: 'Kudurista Supremo',
    title: 'Batida Eléctrica',
    description: 'Auscultadores neon e passada no compasso do Kuduro.',
    avatar: '🧑🏾‍🎤',
    color: '#38bdf8',
    priceKz: 2500,
    unlockedByDefault: false,
  },
  {
    id: 'pantera-marginal',
    name: 'Pantera da Marginal',
    title: 'Velocista Carmesim',
    description: 'Agilidade felina para saltar buracos e dominar as curvas.',
    avatar: '👩🏾‍🎤',
    color: '#ec4899',
    priceKz: 3500,
    unlockedByDefault: false,
  },
  {
    id: 'furia-samba',
    name: 'Fúria do Samba',
    title: 'Sprint Explosivo',
    description: 'Bandana flamejante e arranques ferozes rumo ao trono.',
    avatar: '🧑🏾‍🔧',
    color: '#f97316',
    priceKz: 4500,
    unlockedByDefault: false,
  },
  {
    id: 'espectro-roxo',
    name: 'Espectro Roxo',
    title: 'Sombra Urbana',
    description: 'Capuz furtivo e reflexos silenciosos nas 5 faixas.',
    avatar: '🥷🏾',
    color: '#a855f7',
    priceKz: 6000,
    unlockedByDefault: false,
  },
  {
    id: 'diamante-lunda',
    name: 'Diamante da Lunda',
    title: 'Visor Cristalino',
    description: 'Armadura esmeralda inspirada nos diamantes das Lundas.',
    avatar: '🧑🏾‍🚀',
    color: '#10b981',
    priceKz: 7500,
    unlockedByDefault: false,
  },
  {
    id: 'princesa-samakaka',
    name: 'Princesa Samakaka',
    title: 'Nobreza Tradicional',
    description: 'Traje geométrico angolano com elegância e garra campeã.',
    avatar: '👸🏾',
    color: '#e11d48',
    priceKz: 9000,
    unlockedByDefault: false,
  },
  {
    id: 'general-kwanza',
    name: 'General Kwanza',
    title: 'Tática Blindada',
    description: 'Óculos de aviador e disciplina de ferro até à linha de meta.',
    avatar: '🪖',
    color: '#eab308',
    priceKz: 11000,
    unlockedByDefault: false,
  },
  {
    id: 'mestre-capoeira',
    name: 'Mestre da Ginga',
    title: 'Esquiva Perfeita',
    description: 'Acrobata das ruas com saltos precisos sobre qualquer obstáculo.',
    avatar: '🥋',
    color: '#22c55e',
    priceKz: 13500,
    unlockedByDefault: false,
  },
  {
    id: 'imperador-ouro',
    name: 'Imperador de Ouro',
    title: 'Lenda Suprema',
    description: 'Armadura imperial dourada reservada aos conquistadores do Trono.',
    avatar: '👑',
    color: '#fbbf24',
    priceKz: 18000,
    unlockedByDefault: false,
  },
];
