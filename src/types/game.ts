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

export type CompetitorSessionStatus = 'normal' | 'investigating';

export type TelemetryAnomalyReason =
  | 'impossible-speed'
  | 'lane-switch-flood'
  | 'position-teleport';

export interface TelemetryInvestigationEntry {
  competitorId: string;
  competitorName: string;
  sessionStatus: CompetitorSessionStatus;
  reason: TelemetryAnomalyReason;
  detectedAt: number;
  peakSpeedMps?: number;
  switchesPerSec?: number;
}

export interface TelemetryAnomalyLog {
  id: string;
  roomCode: string;
  raceRound: number;
  reporterId: string;
  competitorId: string;
  competitorName: string;
  reason: TelemetryAnomalyReason;
  detectedAt: number;
  progressDistance: number;
  lane: Lane;
  targetLane: Lane;
  laneX: number;
  peakSpeedMps?: number;
  switchesPerSec?: number;
}

export type ServerTelemetryRiskLevel = 'normal' | 'monitor' | 'investigating' | 'high-risk';

export interface ServerParticipantAnomalySummary {
  competitorId: string;
  competitorName: string;
  roomCode: string;
  totalAnomalies: number;
  reasons: Record<TelemetryAnomalyReason, number>;
  maxSpeedMps: number;
  maxSwitchesPerSec: number;
  suspicionScore: number;
  riskLevel: ServerTelemetryRiskLevel;
  firstDetectedAt: number;
  lastDetectedAt: number;
}

export interface BatchAnomalyReportPayload {
  roomCode: string;
  raceRound: number;
  reporterId: string;
  sentAt: number;
  logs: TelemetryAnomalyLog[];
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
  profileReady?: boolean;
  isHost?: boolean;
  isRemoteHuman?: boolean;
  isSpectating?: boolean;
  betAmount?: number;
  sessionStatus?: CompetitorSessionStatus;
}

export interface RemoteRunnerSnapshot {
  playerId: string;
  progressDistance: number;
  lane: Lane;
  targetLane: Lane;
  laneX: number;
  action: PlayerAction;
  jumpY: number;
  stumbling: boolean;
  finished: boolean;
  updatedAt: number;
}

export interface LocalRunnerTelemetry {
  progressDistance: number;
  lane: Lane;
  targetLane: Lane;
  laneX: number;
  action: PlayerAction;
  jumpY: number;
  stumbling: boolean;
  finished: boolean;
}

export interface RoomStandingEntry {
  id: string;
  name: string;
  avatar: string;
  avatarId: string;
  color: string;
  isBot: boolean;
  lane: Lane;
  progressDistance: number;
  rank: number;
  betAmount: number;
  payoutKz: number;
}

export type ServerRaceStatus = 'idle' | 'starting' | 'running' | 'completed';

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
  playerCount?: number;
  totalPotKz: number;
  winnersPotKz: number; // Soma retornada aos corredores (1º + 2º + reembolso 3º quando aplicável)
  houseFeeKz: number; // Taxa da Casa (proporção 2:1 sobre o saldo restante)
  creatorRoyaltyKz: number; // Royalties do Criador (Hamilton David Nihefe Muenda - O Zero)
  firstPrizeKz: number; // Prémio do 1º Lugar
  secondPrizeKz: number; // Prémio do 2º Lugar
  thirdPrizeKz: number; // Devolução da aposta do 3º Lugar (4–5 jogadores) ou 0 (2–3 jogadores)
  firstPercent?: number;
  secondPercent?: number;
  thirdPercent?: number;
  winnersPercent?: number;
  housePercent?: number;
  creatorPercent?: number;
  thirdKeepsStake?: boolean;
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

export type WeatherKind = 'clear' | 'light-rain' | 'wind-gust';

export interface WeatherState {
  kind: WeatherKind;
  intensity: number;
  speedMultiplier: number;
  shakeIntensity: number;
  windDirection: -1 | 1;
  gustPulse: number;
}

export interface RoomChatMessage {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderColor: string;
  isHost: boolean;
  text: string;
  sentAt: number;
}
