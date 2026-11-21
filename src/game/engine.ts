import {
  Lane,
  Player,
  Obstacle,
  PowerUpItem,
  Coin,
  LuandaObstacleId,
  PowerUpType,
} from '../types/game';
import {
  LANE_CENTERS,
  LANE_WIDTH,
  PLAYER_BASE_Y,
  PLAYER_HEIGHT,
} from './constants';
import { LUANDA_OBSTACLES, POWER_UPS } from '../data/obstacles';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CollisionResult {
  hit: boolean;
  evaded: boolean;
  evasionType?: 'dash' | 'jump' | 'slide' | 'hat-immunity';
  message?: string;
}

const clampLaneIndex = (lane: number): Lane =>
  Math.max(0, Math.min(4, Math.round(Number.isFinite(lane) ? lane : 2))) as Lane;

const clampLaneX = (laneX: number | undefined, fallbackLane: Lane): number => {
  const safeLane = clampLaneIndex(fallbackLane);
  const center = LANE_CENTERS[safeLane] ?? LANE_CENTERS[2];
  const raw = typeof laneX === 'number' && Number.isFinite(laneX) ? laneX : center;
  return Math.max(LANE_CENTERS[0], Math.min(LANE_CENTERS[4], raw));
};

export function getPlayerHitbox(player: Player): BoundingBox {
  const safeLane = clampLaneIndex(player.lane);
  const safeX = clampLaneX(player.laneX, safeLane);
  const halfCoreWidth = 15;
  const minX = safeX - halfCoreWidth;
  const maxX = safeX + halfCoreWidth;

  const isSliding = player.slideProgress > 0.05 || player.action === 'sliding';
  const jumpY = Math.max(0, Number.isFinite(player.jumpY) ? player.jumpY : 0);

  if (isSliding) {
    // Agachado perto do asfalto
    return {
      minX: safeX - 18,
      maxX: safeX + 18,
      minY: PLAYER_BASE_Y + 16,
      maxY: PLAYER_BASE_Y + 44,
    };
  }

  // Correndo ou pulando (hitbox sobe com jumpY)
  const visualTop = PLAYER_BASE_Y - jumpY;
  const visualBottom = PLAYER_BASE_Y - jumpY + PLAYER_HEIGHT * 0.72;

  return {
    minX,
    maxX,
    minY: visualTop,
    maxY: visualBottom,
  };
}

export function getObstacleHitbox(obs: Obstacle): BoundingBox {
  const centerX = LANE_CENTERS[clampLaneIndex(obs.lane)];
  const def = LUANDA_OBSTACLES[obs.obstacleId];
  const width = obs.width * (def ? def.widthPercent : 0.72);
  const height = obs.height * 0.75;

  let yOffset = 0;
  if (obs.type === 'low') {
    yOffset = obs.height * 0.15;
  } else if (obs.type === 'high') {
    yOffset = -2;
  }

  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: obs.y + yOffset,
    maxY: obs.y + yOffset + height,
  };
}

/**
 * Validação de colisão sem morte:
 * Se o jogador colidir, NÃO MORRE! Sofre apenas abrandamento temporário (stumble).
 */
export function checkObstacleCollision(
  player: Player,
  obs: Obstacle,
  speed: number
): CollisionResult {
  if (obs.passed) {
    return { hit: false, evaded: false };
  }

  const playerBox = getPlayerHitbox(player);
  const obsBox = getObstacleHitbox(obs);

  // Alinhamento horizontal rigoroso na faixa
  const safePlayerX = clampLaneX(player.laneX, clampLaneIndex(player.lane));
  const obsCenterX = LANE_CENTERS[clampLaneIndex(obs.lane)];
  const horizontalDist = Math.abs(safePlayerX - obsCenterX);
  const laneTolerance = LANE_WIDTH * 0.38;

  if (horizontalDist >= laneTolerance) {
    return { hit: false, evaded: false };
  }

  // Sobreposição vertical com varredura contínua de velocidade
  const sweptObsMinY = obsBox.minY - Math.max(speed, 6);
  const sweptObsMaxY = obsBox.maxY;

  const isYOverlapping =
    sweptObsMaxY >= playerBox.minY && sweptObsMinY <= playerBox.maxY;

  if (!isYOverlapping) {
    return { hit: false, evaded: false };
  }

  // 1. Dash: Destruição do obstáculo com invulnerabilidade total
  if (player.dashTimer > 0 || player.action === 'dashing') {
    return {
      hit: false,
      evaded: true,
      evasionType: 'dash',
      message: '⚡ DASH REAL! DESTRUIU O OBSTÁCULO',
    };
  }

  // 2. Chapéu do Kudurista: Imunidade a abrandamentos
  if (player.hatImmunityTimer > 0) {
    return {
      hit: false,
      evaded: true,
      evasionType: 'hat-immunity',
      message: '🎩 CHAPÉU DO KUDURISTA! IMUNE A ATRASO',
    };
  }

  // 3. Obstáculos que exigem desvio de faixa obrigatório: apenas Barreiras e Autocarro (Candongueiro)
  const isDodgeOnlyObstacle =
    obs.type === 'barrier' || obs.obstacleId === 'candongueiro-parado';

  if (!isDodgeOnlyObstacle) {
    const isJumpingHighEnough = player.jumpY > 14 || player.action === 'jumping';
    const isSliding = player.slideProgress > 0.05 || player.action === 'sliding';

    // Quase todos os obstáculos (buraco, tambor, balde, cão, zungueira, táxi, fios) podem ser passados saltando;
    // os baixos (buraco no meio, etc.) e fios também permitem passar agachado/deslizando!
    if (isJumpingHighEnough) {
      return {
        hit: false,
        evaded: true,
        evasionType: 'jump',
        message: '⬆️ SALTO PERFEITO!',
      };
    }

    if (isSliding && (obs.type === 'low' || obs.obstacleId === 'fios-caidos')) {
      return {
        hit: false,
        evaded: true,
        evasionType: 'slide',
        message: '⬇️ AGACHOU E DESVIOU!',
      };
    }
  }

  // Se atingiu o obstáculo sem esquiva: colisão que apenas atrasa o corredor!
  return {
    hit: true,
    evaded: false,
    message: '⚠️ OBSTÁCULO! ABRANQUEOU MOMENTANEAMENTE',
  };
}

/**
 * Validação de colisão de obstáculo para competidores rivais (bots/amigos).
 * Usa a posição visual real do corredor na pista (compScreenY) e verifica
 * se ele desviou (salto, agachamento ou troca de faixa).
 */
export function checkCompetitorObstacleCollision(
  comp: {
    laneX: number;
    lane: Lane;
    jumpY: number;
    action: string;
  },
  compScreenY: number,
  obs: Obstacle,
  speed: number
): CollisionResult {
  const safeCompLane = clampLaneIndex(comp.lane);
  const cx = clampLaneX(comp.laneX, safeCompLane);
  const obsCenterX = LANE_CENTERS[clampLaneIndex(obs.lane)];
  const horizontalDist = Math.abs(cx - obsCenterX);
  const laneTolerance = LANE_WIDTH * 0.36;

  if (horizontalDist >= laneTolerance) {
    return { hit: false, evaded: false };
  }

  const obsBox = getObstacleHitbox(obs);
  const isSliding = comp.action === 'sliding';
  const jumpY = Math.max(0, Number.isFinite(comp.jumpY) ? comp.jumpY : 0);

  const compMinY = isSliding ? compScreenY + 14 : compScreenY - jumpY;
  const compMaxY = isSliding ? compScreenY + 42 : compScreenY - jumpY + PLAYER_HEIGHT * 0.72;

  const sweptObsMinY = obsBox.minY - Math.max(speed, 6);
  const sweptObsMaxY = obsBox.maxY;

  const isYOverlapping = sweptObsMaxY >= compMinY && sweptObsMinY <= compMaxY;
  if (!isYOverlapping) {
    return { hit: false, evaded: false };
  }

  const isDodgeOnlyObstacle =
    obs.type === 'barrier' || obs.obstacleId === 'candongueiro-parado';

  if (!isDodgeOnlyObstacle) {
    if (jumpY > 14 || comp.action === 'jumping') {
      return { hit: false, evaded: true, evasionType: 'jump' };
    }
    if (isSliding && (obs.type === 'low' || obs.obstacleId === 'fios-caidos')) {
      return { hit: false, evaded: true, evasionType: 'slide' };
    }
  }

  return {
    hit: true,
    evaded: false,
    message: '⚠️ TROPEÇOU!',
  };
}

export function checkPowerUpPickup(player: Player, item: PowerUpItem): boolean {
  if (item.collected) return false;
  const safePlayerX = clampLaneX(player.laneX, clampLaneIndex(player.lane));
  const centerX = LANE_CENTERS[clampLaneIndex(item.lane)];
  const horizontalDist = Math.abs(safePlayerX - centerX);
  const verticalDist = Math.abs(PLAYER_BASE_Y - item.y);
  return horizontalDist < LANE_WIDTH * 0.45 && verticalDist < 55;
}

export function checkCoinPickup(player: Player, coin: Coin): boolean {
  if (coin.collected) return false;
  const safePlayerX = clampLaneX(player.laneX, clampLaneIndex(player.lane));
  const centerX = LANE_CENTERS[clampLaneIndex(coin.lane)];
  const horizontalDist = Math.abs(safePlayerX - centerX);
  const verticalDist = Math.abs(PLAYER_BASE_Y - coin.y);
  return horizontalDist < LANE_WIDTH * 0.45 && verticalDist < 55;
}

export const LOW_OBSTACLE_KEYS: LuandaObstacleId[] = [
  'buraco-marginal',
  'zungueira-bacia',
  'tambor',
  'balde-agua',
  'cao-de-rua',
];

export const HIGH_OBSTACLE_KEYS: LuandaObstacleId[] = [
  'candongueiro-parado',
  'taxi-azul-branco',
  'fios-caidos',
];

export const BARRIER_OBSTACLE_KEYS: LuandaObstacleId[] = [
  'policia',
  'montra',
];

// Obstáculos passáveis por salto (ou agachamento nos baixos/fios)
export const JUMPABLE_OBSTACLE_KEYS: LuandaObstacleId[] = [
  ...LOW_OBSTACLE_KEYS,
  'taxi-azul-branco',
  'fios-caidos',
];

// Apenas barreiras e o autocarro exigem desvio lateral obrigatório
export const DODGE_ONLY_OBSTACLE_KEYS: LuandaObstacleId[] = [
  'candongueiro-parado',
  'policia',
  'montra',
];

export const ALL_LUANDA_OBSTACLE_KEYS: LuandaObstacleId[] = [
  ...LOW_OBSTACLE_KEYS,
  ...HIGH_OBSTACLE_KEYS,
  ...BARRIER_OBSTACLE_KEYS,
];

export interface WaveGenerationResult {
  obstacles: Obstacle[];
  openLanes: Lane[];
  coins: Coin[];
}

export function createSeededRng(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleLanesUniform(lanes: Lane[], rng: () => number = Math.random): Lane[] {
  const arr = [...lanes];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

let lastWaveSignature = '';
let lastObstaclePicked: LuandaObstacleId | null = null;

/**
 * Geração Aleatória Uniforme e Equilibrada de Obstáculos:
 * - Distribuição uniforme nas 5 faixas via Fisher-Yates (sem repetir o mesmo bloqueio consecutivo).
 * - Quantidade calibrada (~10% menor) com maioria de obstáculos saltáveis/agacháveis e no máx. 1 barreira/autocarro por onda.
 * - Sempre garante pelo menos 2 a 4 faixas livres para corrida fluida.
 */
export function spawnCuratedLuandaWave(
  startObstacleId: number,
  startCoinId: number,
  y: number = -240,
  isHardMode: boolean = false,
  rng: () => number = Math.random
): WaveGenerationResult {
  const obstacles: Obstacle[] = [];
  const coins: Coin[] = [];
  const allLanes: Lane[] = [0, 1, 2, 3, 4];
  let curObsId = startObstacleId;
  let curCoinId = startCoinId;
  const isSeeded = rng !== Math.random;

  const pickRandomKey = (pool: LuandaObstacleId[]) => {
    const filtered =
      !isSeeded && pool.length > 1 ? pool.filter((k) => k !== lastObstaclePicked) : pool;
    const chosen = filtered[Math.floor(rng() * filtered.length)];
    if (!isSeeded) lastObstaclePicked = chosen;
    return chosen;
  };

  const pushObstacle = (lane: Lane, yPos: number, key: LuandaObstacleId) => {
    const def = LUANDA_OBSTACLES[key];
    obstacles.push({
      id: ++curObsId,
      lane,
      y: yPos,
      type: def.type,
      obstacleId: key,
      name: def.name,
      width: LANE_WIDTH * def.widthPercent,
      height: def.height,
      passed: false,
    });
  };

  // Embaralhamento uniforme real (Fisher-Yates) evitando repetir exatamente as mesmas faixas seguidas
  let shuffledLanes = shuffleLanesUniform(allLanes, rng);
  if (!isSeeded) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const sigPreview = `${shuffledLanes[0]}-${shuffledLanes[1]}`;
      if (sigPreview !== lastWaveSignature) break;
      shuffledLanes = shuffleLanesUniform(allLanes, rng);
    }
  }

  const patterns = isHardMode
    ? ['duo', 'trio', 'staggered_duo', 'jump_duo', 'dodge_plus_jump', 'solo']
    : ['solo', 'duo', 'jump_duo', 'slide_duo', 'staggered_duo', 'dodge_plus_jump'];
  const pattern = patterns[Math.floor(rng() * patterns.length)];

  let blockedLanes: Lane[] = [];

  switch (pattern) {
    case 'solo': {
      const l1 = shuffledLanes[0];
      blockedLanes = [l1];
      const key =
        rng() < 0.7
          ? pickRandomKey(JUMPABLE_OBSTACLE_KEYS)
          : pickRandomKey(DODGE_ONLY_OBSTACLE_KEYS);
      pushObstacle(l1, y, key);
      break;
    }

    case 'duo': {
      const l1 = shuffledLanes[0];
      const l2 = shuffledLanes[1];
      blockedLanes = [l1, l2];
      pushObstacle(l1, y, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));
      pushObstacle(
        l2,
        y - (rng() < 0.5 ? 0 : 45),
        rng() < 0.72
          ? pickRandomKey(JUMPABLE_OBSTACLE_KEYS)
          : pickRandomKey(DODGE_ONLY_OBSTACLE_KEYS)
      );
      break;
    }

    case 'staggered_duo': {
      const l1 = shuffledLanes[0];
      const l2 = shuffledLanes[1];
      blockedLanes = [l1, l2];
      pushObstacle(l1, y, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));
      pushObstacle(l2, y - 105, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));
      break;
    }

    case 'dodge_plus_jump': {
      // Máximo 1 barreira ou autocarro acompanhado de 1 obstáculo saltável/agachável
      const dodgeLane = shuffledLanes[0];
      const jumpLane = shuffledLanes[1];
      blockedLanes = [dodgeLane, jumpLane];
      pushObstacle(dodgeLane, y, pickRandomKey(DODGE_ONLY_OBSTACLE_KEYS));
      pushObstacle(jumpLane, y - 35, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));
      break;
    }

    case 'jump_duo': {
      const jumpLane = shuffledLanes[0];
      const secondLane = shuffledLanes[1];
      blockedLanes = [jumpLane, secondLane];
      pushObstacle(jumpLane, y, pickRandomKey(LOW_OBSTACLE_KEYS));
      pushObstacle(secondLane, y - 20, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));

      coins.push(
        { id: ++curCoinId, lane: jumpLane, y: y + 36, collected: false, value: 15 },
        { id: ++curCoinId, lane: jumpLane, y: y - 36, collected: false, value: 15 }
      );
      break;
    }

    case 'slide_duo': {
      const slideLane = shuffledLanes[0];
      const secondLane = shuffledLanes[1];
      blockedLanes = [slideLane, secondLane];
      pushObstacle(
        slideLane,
        y,
        rng() < 0.6 ? 'fios-caidos' : pickRandomKey(LOW_OBSTACLE_KEYS)
      );
      pushObstacle(secondLane, y, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));

      coins.push(
        { id: ++curCoinId, lane: slideLane, y: y + 30, collected: false, value: 15 },
        { id: ++curCoinId, lane: slideLane, y: y - 30, collected: false, value: 20 }
      );
      break;
    }

    case 'trio': {
      // 3 faixas ocupadas em modo difícil, porém com no máx. 1 obstáculo de desvio obrigatório
      const l1 = shuffledLanes[0];
      const l2 = shuffledLanes[1];
      const l3 = shuffledLanes[2];
      blockedLanes = [l1, l2, l3];
      pushObstacle(l1, y, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));
      pushObstacle(l2, y - 30, pickRandomKey(JUMPABLE_OBSTACLE_KEYS));
      pushObstacle(
        l3,
        y - 80,
        rng() < 0.55
          ? pickRandomKey(DODGE_ONLY_OBSTACLE_KEYS)
          : pickRandomKey(JUMPABLE_OBSTACLE_KEYS)
      );
      break;
    }
  }

  if (!isSeeded) {
    lastWaveSignature = `${shuffledLanes[0]}-${shuffledLanes[1]}`;
  }

  // Faixas comprovadamente livres para navegação segura (sempre pelo menos 2 a 4 faixas livres!)
  const openLanes = allLanes.filter((l) => !blockedLanes.includes(l));

  // Moedas interativas guiando por uma faixa segura aleatória
  if (openLanes.length > 0 && rng() < 0.7) {
    const safeLane = openLanes[Math.floor(rng() * openLanes.length)];
    for (let c = 0; c < 3; c++) {
      coins.push({
        id: ++curCoinId,
        lane: safeLane,
        y: y + c * 40,
        collected: false,
        value: 10,
      });
    }
  }

  return { obstacles, openLanes, coins };
}

// Mantém retrocompatibilidade para assinatura antiga
export function spawnLuandaObstacleWave(
  startId: number,
  y: number = -100,
  isHardMode: boolean = false,
  rng: () => number = Math.random
): Obstacle[] {
  const result = spawnCuratedLuandaWave(startId, 0, y, isHardMode, rng);
  return result.obstacles;
}

export function spawnRandomPowerUp(
  id: number,
  forbiddenLanes: Lane[] = [],
  rng: () => number = Math.random
): PowerUpItem {
  const openLanes = ([0, 1, 2, 3, 4] as Lane[]).filter((l) => !forbiddenLanes.includes(l));
  const lane = openLanes.length > 0 ? openLanes[Math.floor(rng() * openLanes.length)] : 2;
  const types: PowerUpType[] = ['kikuuba-nitro', 'chapeu-kudurista', 'gasosa'];
  const type = types[Math.floor(rng() * types.length)];
  const def = POWER_UPS[type];

  return {
    id,
    lane,
    y: -90,
    type,
    name: def.name,
    durationSeconds: def.durationSeconds,
    collected: false,
  };
}

