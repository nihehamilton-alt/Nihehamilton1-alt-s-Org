// REGRAS E CONSTANTES FÍSICAS DO REI RUN
// Duração Oficial: Exatamente 40 segundos por partida!
export const TOTAL_GAME_TIME_SECONDS = 40;
export const HARD_MODE_START_SECONDS = 20;
export const THRONE_APPROACH_START_SECONDS = 30;

export const CANV_WIDTH = 520;
export const CANV_HEIGHT = 680;

// Pista oficial de 5 faixas (Lanes 0, 1, 2, 3 e 4) — uma faixa para cada um dos 5 corredores:
export const TRACK_LEFT = CANV_WIDTH * 0.04;
export const TRACK_WIDTH = CANV_WIDTH * 0.92;
export const LANE_WIDTH = TRACK_WIDTH / 5;

export const LANE_CENTERS: [number, number, number, number, number] = [
  TRACK_LEFT + LANE_WIDTH * 0.5, // Faixa 1: Extrema Esquerda (~68px)
  TRACK_LEFT + LANE_WIDTH * 1.5, // Faixa 2: Centro-Esquerda (~164px)
  TRACK_LEFT + LANE_WIDTH * 2.5, // Faixa 3: Centro - REI ZERO (~260px)
  TRACK_LEFT + LANE_WIDTH * 3.5, // Faixa 4: Centro-Direita (~356px)
  TRACK_LEFT + LANE_WIDTH * 4.5, // Faixa 5: Extrema Direita (~451px)
];

// Posição vertical do Trono Real na Meta aos 40s
export const FINISH_THRONE_Y = 50;

export const PLAYER_WIDTH = 48;
export const PLAYER_HEIGHT = 64;
export const PLAYER_BASE_Y = CANV_HEIGHT - 120;

// Ordem simétrica das faixas rivais nas 5 faixas (Jogador fica sempre na faixa central 2)
export const RIVAL_LANE_SLOTS = [1, 3, 0, 4] as const;

// Mapeamento único 2D/3D da profundidade relativa de cada corredor na pista (suave e sem saltos bruscos)
export function computeCompetitorScreenY(distDelta: number): number {
  return Math.max(
    110,
    Math.min(CANV_HEIGHT - 55, PLAYER_BASE_Y - Math.tanh(distDelta / 12) * 145)
  );
}

// Física de Salto e Agachamento (rápido e atlético: ~0.41s no ar, sem flutuação lenta)
export const JUMP_INITIAL_VELOCITY = 14.5;
export const GRAVITY = 1.18;
export const SLIDE_DURATION_MS = 520;

// Dash por duplo toque na tela: explosão breve (~420ms) com recarga estrita de 4 segundos
export const DASH_DURATION_MS = 420;
export const DASH_COOLDOWN_MS = 4000;

// Ondas de Dificuldade Progressiva com Obstáculos Frequentes:
// 0 a 20 segundos: Ritmo Dinâmico com obstáculos regulares
// 20 a 40 segundos: MODO REI DIFÍCIL rápido e exigente em reflexos
export const INITIAL_SAFETY_RUNWAY_SECONDS = 1.2; // Arranque limpo curto para entrada imediata em ritmo fluido
export const MIN_OBSTACLE_VERTICAL_GAP = 185; // Distância mínima segura entre ondas para manobras ágeis

export const WAVES = [
  {
    id: 1,
    name: 'Ritmo Inicial (Fácil)',
    timeRange: [0, 20],
    speed: 10.2,
    minWaveSpacing: 385,
    maxWaveSpacing: 475,
    subtitle: 'Marginal de Luanda · Tráfego Intenso',
  },
  {
    id: 2,
    name: 'MODO REI DIFÍCIL',
    timeRange: [20, 40],
    speed: 12.2,
    minWaveSpacing: 335,
    maxWaveSpacing: 420,
    subtitle: 'Ritmo Urbano Máximo · Candongueiros & Desvios Rápidos',
  },
];
