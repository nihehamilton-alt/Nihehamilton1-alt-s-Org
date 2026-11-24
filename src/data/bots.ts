export interface AngolanBotProfile {
  id: string;
  avatarId: string;
  name: string;
  title: string;
  avatar: string;
  color: string;
}

export const ANGOLAN_BOTS: AngolanBotProfile[] = [
  {
    id: 'bot-kota-banza',
    avatarId: 'bot-kota-banza',
    name: 'Kota Banza',
    title: 'Veterano da Ilha',
    avatar: '🧢',
    color: '#38bdf8',
  },
  {
    id: 'bot-zito-kuduro',
    avatarId: 'bot-zito-kuduro',
    name: 'Zito Kuduro',
    title: 'Rei do Toque',
    avatar: '🎧',
    color: '#a855f7',
  },
  {
    id: 'bot-tia-maria',
    avatarId: 'bot-tia-maria',
    name: 'Tia Maria Zunga',
    title: 'Raio do Mercado',
    avatar: '🧣',
    color: '#f43f5e',
  },
  {
    id: 'bot-beto-candonga',
    avatarId: 'bot-beto-candonga',
    name: 'Beto Candonga',
    title: 'Ás do Asfalto',
    avatar: '🚐',
    color: '#10b981',
  },
  {
    id: 'bot-kizomba-flash',
    avatarId: 'kudurista-supremo',
    name: 'Kizomba Flash',
    title: 'Relâmpago do Kinaxixi',
    avatar: '⚡',
    color: '#22d3ee',
  },
  {
    id: 'bot-nadia-benguela',
    avatarId: 'pantera-marginal',
    name: 'Nadia Benguela',
    title: 'Brisa da Baía',
    avatar: '🐆',
    color: '#ec4899',
  },
  {
    id: 'bot-dany-ilha',
    avatarId: 'furia-samba',
    name: 'Dany da Ilha',
    title: 'Fogo da Samba',
    avatar: '🔥',
    color: '#f97316',
  },
  {
    id: 'bot-sonia-lobito',
    avatarId: 'princesa-samakaka',
    name: 'Sónia Lobito',
    title: 'Estrela do Sul',
    avatar: '🌟',
    color: '#e11d48',
  },
  {
    id: 'bot-tchilara-zamba',
    avatarId: 'espectro-roxo',
    name: 'Tchilara Zamba',
    title: 'Sombra da Reta',
    avatar: '🥷🏾',
    color: '#8b5cf6',
  },
  {
    id: 'bot-helder-maianga',
    avatarId: 'general-kwanza',
    name: 'Helder Maianga',
    title: 'Escudo de Ferro',
    avatar: '🛡️',
    color: '#eab308',
  },
  {
    id: 'bot-julia-huambo',
    avatarId: 'diamante-lunda',
    name: 'Júlia Huambo',
    title: 'Joia do Planalto',
    avatar: '💎',
    color: '#14b8a6',
  },
  {
    id: 'bot-mateus-rangel',
    avatarId: 'mestre-capoeira',
    name: 'Mateus Rangel',
    title: 'Salto da Ginga',
    avatar: '🥋',
    color: '#22c55e',
  },
  {
    id: 'bot-celia-namibe',
    avatarId: 'pantera-marginal',
    name: 'Célia Namibe',
    title: 'Vento do Deserto',
    avatar: '🏜️',
    color: '#fb7185',
  },
  {
    id: 'bot-paulo-samba',
    avatarId: 'kudurista-supremo',
    name: 'Paulo Samba',
    title: 'Pulso de Ouro',
    avatar: '🥁',
    color: '#60a5fa',
  },
  {
    id: 'bot-vania-kipaca',
    avatarId: 'diamante-lunda',
    name: 'Vânia Kipaca',
    title: 'Pérola Atlântica',
    avatar: '🌊',
    color: '#34d399',
  },
  {
    id: 'bot-rui-lubango',
    avatarId: 'imperador-ouro',
    name: 'Rui Lubango',
    title: 'Falcão da Serra',
    avatar: '🦅',
    color: '#fbbf24',
  },
];

function createSeededRng(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleList<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Seleciona competidores novos para cada partida pública, evitando repetir
 * os mesmos rivais da partida anterior e mantendo o pool rotativo.
 * Quando `seed` é fornecido, todos os jogadores da mesma sala obtêm exatamente os mesmos bots.
 */
export function pickRotatedPublicBots(
  neededCount: number,
  previousBotIds: Iterable<string> = [],
  excludeIds: Iterable<string> = [],
  seed?: number
): AngolanBotProfile[] {
  if (neededCount <= 0) return [];
  const prevSet = new Set(previousBotIds);
  const exclSet = new Set(excludeIds);
  const rng = typeof seed === 'number' ? createSeededRng(seed) : Math.random;

  const freshPool = shuffleList(
    ANGOLAN_BOTS.filter((b) => !exclSet.has(b.id) && !prevSet.has(b.id)),
    rng
  );
  const fallbackPool = shuffleList(
    ANGOLAN_BOTS.filter((b) => !exclSet.has(b.id) && prevSet.has(b.id)),
    rng
  );

  return [...freshPool, ...fallbackPool].slice(0, neededCount);
}
