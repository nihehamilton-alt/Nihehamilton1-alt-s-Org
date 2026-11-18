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
];
