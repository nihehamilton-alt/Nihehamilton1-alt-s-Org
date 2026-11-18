import { LuandaObstacleId, ObstacleType, PowerUpType } from '../types/game';

export interface ObstacleDefinition {
  id: LuandaObstacleId;
  name: string;
  type: ObstacleType;
  widthPercent: number;
  height: number;
  description: string;
}

export const LUANDA_OBSTACLES: Record<LuandaObstacleId, ObstacleDefinition> = {
  'buraco-marginal': {
    id: 'buraco-marginal',
    name: 'Buraco da Marginal',
    type: 'low',
    widthPercent: 0.72,
    height: 36,
    description: 'Cratera profunda no asfalto da Marginal — salta ou desliza na hora certa.',
  },
  'zungueira-bacia': {
    id: 'zungueira-bacia',
    name: 'Bacia de Zungueira',
    type: 'low',
    widthPercent: 0.68,
    height: 38,
    description: 'Bacia colorida de frutas na pista — requer salto limpo.',
  },
  'candongueiro-parado': {
    id: 'candongueiro-parado',
    name: 'Candongueiro Parado',
    type: 'high',
    widthPercent: 0.84,
    height: 68,
    description: 'HiAce azul e branco parado na faixa — desvia de faixa imediatamente.',
  },
  tambor: {
    id: 'tambor',
    name: 'Tambor Metálico',
    type: 'low',
    widthPercent: 0.64,
    height: 38,
    description: 'Tambor de obra sinalizado — salta por cima.',
  },
  policia: {
    id: 'policia',
    name: 'Barreira da Polícia',
    type: 'barrier',
    widthPercent: 0.86,
    height: 54,
    description: 'Bloqueio metálico de controlo — muda de faixa.',
  },
  'taxi-azul-branco': {
    id: 'taxi-azul-branco',
    name: 'Táxi Azul e Branco',
    type: 'high',
    widthPercent: 0.76,
    height: 44,
    description: 'Viatura ligeira travada na faixa — salta ou contorna.',
  },
  'balde-agua': {
    id: 'balde-agua',
    name: 'Balde de Água',
    type: 'low',
    widthPercent: 0.56,
    height: 32,
    description: 'Balde derramado na pista — salta ou desliza rápido.',
  },
  'cao-de-rua': {
    id: 'cao-de-rua',
    name: 'Cão da Marginal',
    type: 'low',
    widthPercent: 0.6,
    height: 34,
    description: 'Cão ágil a cruzar a via — salta sem perder ritmo.',
  },
  'fios-caidos': {
    id: 'fios-caidos',
    name: 'Fios Elétricos Caídos',
    type: 'high',
    widthPercent: 0.82,
    height: 48,
    description: 'Cabo baixo com faíscas — agacha-te e desliza por baixo.',
  },
  montra: {
    id: 'montra',
    name: 'Montra / Banca de Rua',
    type: 'barrier',
    widthPercent: 0.84,
    height: 56,
    description: 'Estrutura de comércio na calçada — desvio lateral obrigatório.',
  },
};

export interface PowerUpDefinition {
  type: PowerUpType;
  name: string;
  durationSeconds: number;
  description: string;
}

export const POWER_UPS: Record<PowerUpType, PowerUpDefinition> = {
  'kikuuba-nitro': {
    type: 'kikuuba-nitro',
    name: 'Kikuuba Nitro',
    durationSeconds: 4,
    description: 'Impulso turbo de +35% na velocidade durante 4 segundos.',
  },
  'chapeu-kudurista': {
    type: 'chapeu-kudurista',
    name: 'Chapéu do Kudurista',
    durationSeconds: 5,
    description: 'Escudo protetor contra tropeços e abrandamentos por 5 segundos.',
  },
  gasosa: {
    type: 'gasosa',
    name: 'Gasosa Gelada',
    durationSeconds: 1,
    description: 'Bónus imediato de moedas douradas e energia para a corrida.',
  },
};
