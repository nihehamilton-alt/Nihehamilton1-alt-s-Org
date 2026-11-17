export type Lane = 0 | 1 | 2 | 3 | 4; // 5 faixas (Lanes 1 a 5) individuais para os 5 corredores na pista

export type PlayerAction = 'running' | 'jumping' | 'sliding' | 'dashing' | 'stumbling';

export type ObstacleType = 'low' | 'high' | 'barrier';

export type LuandaObstacleId =
  | 'buraco-marginal'
  | 'zungueira-bacia'
  | 'candongueiro-parado'
  | 'tambor'
  | 'policia'
  | 'taxi-azul-branco'
  | 'balde-agua'
  | 'cao-de-rua'
  | 'fios-caidos'
  | 'montra';

export type PowerUpType = 'kikuuba-nitro' | 'chapeu-kudurista' | 'gasosa';

export interface Obstacle {
  id: number;
  lane: Lane;
  y: number;
  type: ObstacleType;
  obstacleId: LuandaObstacleId;
  name: string;
  width: number;
  height: number;
  passed: boolean;
}

export interface PowerUpItem {
  id: number;
  lane: Lane;
  y: number;
  type: PowerUpType;
  name: string;
  durationSeconds: number;
  collected: boolean;
}

export interface Coin {
  id: number;
  lane: Lane;
  y: number;
  collected: boolean;
  value: number;
}

export interface Player {
  lane: Lane;
  targetLane: Lane;
  laneX: number;
  action: PlayerAction;
  jumpY: number;
  jumpVelocity: number;
  slideProgress: number;
  dashTimer: number;
  nitroTimer: number;
  hatImmunityTimer: number;
  stumbleTimer: number;
}

export interface Competitor {
  id: string;
  name: string;
  avatar: string;
  avatarId: string;
  color: string;
  lane: Lane;
  targetLane: Lane;
  laneX: number;
  yOffset: number; // 0 significa rigorosamente alinhado na mesma linha de partida
  progressDistance: number; // metros percorridos em direção ao Trono Real
  action: PlayerAction;
  jumpY: number;
  isBot: boolean;
  isPlayer: boolean;
  stumbling: boolean;
  finished: boolean;
  finishTime?: number;
  rank?: number;
}

export type GameStatus = 'idle' | 'lobby' | 'starting' | 'running' | 'completed';

export type ViewMode = '2d' | '3d';
export type TimeMode = 'day' | 'night';
export type SupportedLanguage =
  | 'pt'
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'es'
  | 'es-CO'
  | 'es-MX'
  | 'fr'
  | 'de'
  | 'it'
  | 'ar-EG'
  | 'sw'
  | 'umb'
  | 'kmb'
  | 'kik';

export type CurrencyCode =
  | 'AOA'
  | 'USD'
  | 'EUR'
  | 'BRL'
  | 'COP'
  | 'MXN'
  | 'CNY'
  | 'TWD'
  | 'EGP'
  | 'GBP'
  | 'KES';

export interface RoundHistory {
  id: string;
  timestamp: string;
  betAmount: number;
  timeSeconds: number;
  won: boolean;
  payout: number;
  playerRank: number;
  totalPlayers: number;
  currency: string;
}

export type RoomAccessMode = 'random' | 'invite-only';

export interface RoomConfig {
  code: string;
  title: string;
  hostName: string;
  maxPlayers: number; // 5 jogadores
  minPlayers: number; // 2 jogadores
  betAmount: number;
  fillWithBots: boolean;
  isDemo: boolean;
  isPrivate: boolean;
  accessMode?: RoomAccessMode;
}

export interface ThreeTorneirasSplit {
  totalPotKz: number;
  winnersPotKz: number; // 70%
  houseFeeKz: number;    // 20%
  creatorRoyaltyKz: number; // 10% para Hamilton David Nihefe Muenda - O Zero
  firstPrizeKz: number;  // Maior fatia dos vencedores
  secondPrizeKz: number; // Segunda fatia
  thirdPrizeKz: number;  // Terceira fatia
}

export interface RacePerformanceMetrics {
  avgReactionTimeMs: number | null;
  bestReactionTimeMs: number | null;
  dodgeAccuracyPct: number;
  jumpAccuracyPct: number;
  evadedCount: number;
  hitCount: number;
  totalFaced: number;
  actionableTipKey: 'fast-reflex' | 'jump-early' | 'lane-switch' | 'clean-master' | 'keep-focus';
}

