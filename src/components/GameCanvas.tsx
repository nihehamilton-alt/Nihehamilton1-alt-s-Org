import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Lane,
  Player,
  Obstacle,
  PowerUpItem,
  Coin,
  GameStatus,
  Competitor,
  ViewMode,
  TimeMode,
  RacePerformanceMetrics,
  RemoteRunnerSnapshot,
  LocalRunnerTelemetry,
  WeatherKind,
  WeatherState,
} from '../types/game';
import {
  CANV_WIDTH,
  CANV_HEIGHT,
  TRACK_LEFT,
  TRACK_WIDTH,
  LANE_WIDTH,
  LANE_CENTERS,
  PLAYER_HEIGHT,
  PLAYER_BASE_Y,
  JUMP_INITIAL_VELOCITY,
  GRAVITY,
  SLIDE_DURATION_MS,
  DASH_DURATION_MS,
  DASH_COOLDOWN_MS,
  TOTAL_GAME_TIME_SECONDS,
  HARD_MODE_START_SECONDS,
  WAVES,
  FINISH_THRONE_Y,
  INITIAL_SAFETY_RUNWAY_SECONDS,
  MIN_OBSTACLE_VERTICAL_GAP,
  computeCompetitorScreenY,
} from '../game/constants';
import { sounds } from '../audio/soundEffects';
import {
  checkObstacleCollision,
  checkCompetitorObstacleCollision,
  checkPowerUpPickup,
  checkCoinPickup,
  spawnCuratedLuandaWave,
  createSeededRng,
} from '../game/engine';
import { ThreeCanvas, ThreeLiveState } from './ThreeCanvas';
import { useI18n } from '../contexts/I18nContext';
import { getLocalizedPowerUp } from '../data/translations';
import { drawVolumetricObstacle25D } from './canvasObstacles25D';
import { drawCanvasRunnerAvatar } from './canvasRunnerAvatar';
import { AvatarDoll } from './AvatarDoll';
import { getMultiplayerStrings } from '../utils/multiplayerStrings';
import {
  createDefaultWeatherState,
  evaluateRaceWeather,
  getWeatherUiBadge,
} from '../game/weather';
import { CanvasMotionParticles, MotionParticleBurst } from './CanvasMotionParticles';

interface GameCanvasProps {
  status: GameStatus;
  countdownValue: number | null;
  elapsedSeconds: number;
  competitors: Competitor[];
  viewMode: ViewMode;
  timeMode: TimeMode;
  onFinish: (finalCompetitors: Competitor[], performance?: RacePerformanceMetrics) => void;
  onCoinCollected: (points: number) => void;
  onTimeUpdate: (seconds: number) => void;
  onCompetitorsProgress?: (updated: Competitor[]) => void;
  onRankUpdate?: (rank: number) => void;
  isDemo: boolean;
  betAmountKz?: number;
  onRestart?: () => void;
  roundNonce?: number;
  pause3d?: boolean;
  raceSeed?: number | null;
  syncedRaceStartAt?: number | null;
  remotePlayersRef?: React.RefObject<Map<string, RemoteRunnerSnapshot>>;
  onLocalRaceTelemetry?: (telemetry: LocalRunnerTelemetry) => void;
  isSpectating?: boolean;
  spectatedRunnerId?: string | null;
  onSelectSpectatedRunner?: (id: string | null) => void;
  onExitSpectator?: () => void;
  onOpenSpectatorOverview?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  kind?: 'dust' | 'trail';
}

const MAX_ACTIVE_PARTICLES = 72;
const MAX_FLOATING_TEXTS = 14;
const TRACK_MIN_CENTER_X = LANE_CENTERS[0];
const TRACK_MAX_CENTER_X = LANE_CENTERS[4];

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  life: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  status,
  countdownValue,
  elapsedSeconds,
  competitors,
  viewMode,
  timeMode,
  onFinish,
  onCoinCollected,
  onTimeUpdate,
  onCompetitorsProgress,
  onRankUpdate,
  betAmountKz = 500,
  onRestart,
  roundNonce = 0,
  pause3d = false,
  raceSeed = null,
  syncedRaceStartAt = null,
  remotePlayersRef,
  onLocalRaceTelemetry,
  isSpectating = false,
  spectatedRunnerId = null,
  onSelectSpectatedRunner,
  onExitSpectator,
  onOpenSpectatorOverview,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { t, lang, formatMoney } = useI18n();
  const mpStrings = React.useMemo(() => getMultiplayerStrings(lang), [lang]);
  const tRef = useRef(t);
  const langRef = useRef(lang);
  tRef.current = t;
  langRef.current = lang;

  const isSpectatingRef = useRef<boolean>(Boolean(isSpectating));
  const spectatedRunnerIdRef = useRef<string | null>(spectatedRunnerId ?? null);
  isSpectatingRef.current = Boolean(isSpectating);
  spectatedRunnerIdRef.current = spectatedRunnerId ?? null;

  // Refs estáveis para callbacks (evita reiniciar o loop 60 FPS a cada atualização de timer do App)
  const onFinishRef = useRef(onFinish);
  const onCoinCollectedRef = useRef(onCoinCollected);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onCompetitorsProgressRef = useRef(onCompetitorsProgress);
  const onRankUpdateRef = useRef(onRankUpdate);
  const onLocalRaceTelemetryRef = useRef(onLocalRaceTelemetry);
  const remotePlayersRefStable = useRef(remotePlayersRef);
  const syncedRaceStartAtRef = useRef<number | null>(syncedRaceStartAt);
  const raceSeedRef = useRef<number | null>(raceSeed);
  const roundNonceRef = useRef<number>(roundNonce);
  const waveRngRef = useRef<() => number>(Math.random);
  const telemetryEmitRef = useRef({
    lastAt: 0,
    lastLane: -1,
    lastTargetLane: -1,
    lastAction: '',
    lastStumbling: false,
    lastFinished: false,
    lastJumpActive: false,
  });

  onFinishRef.current = onFinish;
  onCoinCollectedRef.current = onCoinCollected;
  onTimeUpdateRef.current = onTimeUpdate;
  onCompetitorsProgressRef.current = onCompetitorsProgress;
  onRankUpdateRef.current = onRankUpdate;
  onLocalRaceTelemetryRef.current = onLocalRaceTelemetry;
  remotePlayersRefStable.current = remotePlayersRef;
  syncedRaceStartAtRef.current = syncedRaceStartAt;
  raceSeedRef.current = raceSeed;
  roundNonceRef.current = roundNonce;

  useEffect(() => {
    if (status === 'starting' || status === 'idle') {
      waveRngRef.current = raceSeed ? createSeededRng(raceSeed) : Math.random;
    }
  }, [raceSeed, roundNonce, status]);

  // Power-Ups Status
  const [activePowerUpNotice, setActivePowerUpNotice] = useState<string | null>(null);
  const powerUpNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sistema de Partículas Framer Motion (Jump & Coin Pickup)
  const [motionBursts, setMotionBursts] = useState<MotionParticleBurst[]>([]);
  const motionBurstIdRef = useRef<number>(1);
  const motionBurstTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const viewModeRef = useRef<ViewMode>(viewMode);
  viewModeRef.current = viewMode;
  const rivalJumpCooldownRef = useRef<Map<string, number>>(new Map());

  const emitMotionBurst = useCallback(
    (
      kind: 'jump' | 'coin',
      canvasX: number,
      canvasY: number,
      options?: { color?: string; value?: number }
    ) => {
      const clampedX = Math.max(24, Math.min(CANV_WIDTH - 24, canvasX));
      const clampedY = Math.max(48, Math.min(CANV_HEIGHT - 24, canvasY));
      const xPct =
        viewModeRef.current === '3d'
          ? Math.max(14, Math.min(86, 50 + ((clampedX - LANE_CENTERS[2]) / TRACK_WIDTH) * 62))
          : (clampedX / CANV_WIDTH) * 100;
      const yPct =
        viewModeRef.current === '3d'
          ? Math.max(26, Math.min(84, 74 - ((PLAYER_BASE_Y - clampedY) / CANV_HEIGHT) * 44))
          : (clampedY / CANV_HEIGHT) * 100;

      const burstId = motionBurstIdRef.current++;
      const burst: MotionParticleBurst = {
        id: burstId,
        kind,
        xPct,
        yPct,
        color: options?.color,
        value: options?.value,
      };
      setMotionBursts((prev) => [...prev.slice(-9), burst]);
      const timer = setTimeout(() => {
        motionBurstTimersRef.current.delete(timer);
        setMotionBursts((prev) => prev.filter((item) => item.id !== burstId));
      }, 600);
      motionBurstTimersRef.current.add(timer);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (powerUpNoticeTimerRef.current) {
        clearTimeout(powerUpNoticeTimerRef.current);
        powerUpNoticeTimerRef.current = null;
      }
      motionBurstTimersRef.current.forEach((timer) => clearTimeout(timer));
      motionBurstTimersRef.current.clear();
    };
  }, []);

  // Snapshot leve (~8Hz durante corrida) dos 5 corredores: movimentos e apostas em tempo real
  const [liveHudRunners, setLiveHudRunners] = useState<Competitor[]>(competitors);
  const lastHudRunnersEmitRef = useRef<number>(0);

  useEffect(() => {
    if (status !== 'running') {
      setLiveHudRunners(competitors);
    }
  }, [competitors, status]);

  // Refs diretas para indicador de Dash (zero re-renders React durante os 4s de recarga)
  const dashPillRef = useRef<HTMLDivElement | null>(null);
  const dashPillTextRef = useRef<HTMLSpanElement | null>(null);
  const dashCardRef = useRef<HTMLDivElement | null>(null);
  const dashCardTextRef = useRef<HTMLSpanElement | null>(null);
  const lastDashUiEmitRef = useRef<number>(-1);

  // Posição em Tempo Real (1º ao 5º Lugar) + Quantos corredores está à frente
  const [liveRank, setLiveRank] = useState<number>(1);
  const [aheadOfCount, setAheadOfCount] = useState<number>(0);
  const [weatherKindUi, setWeatherKindUi] = useState<WeatherKind>('clear');
  const lastRankRef = useRef<number>(1);
  const lastBehindRef = useRef<number>(0);
  const lastWeatherKindRef = useRef<WeatherKind>('clear');
  const lastTimeEmitRef = useRef<number>(-1);
  const raceFinishedRef = useRef<boolean>(false);
  const prevRoundNonceRef = useRef<number>(roundNonce);
  const perfRef = useRef<{
    threatStartMap: Map<number, number>;
    reactedObsIds: Set<number>;
    countedObsIds: Set<number>;
    reactionTimesMs: number[];
    evadedCount: number;
    hitCount: number;
    jumpableFaced: number;
    jumpableCleared: number;
  }>({
    threatStartMap: new Map(),
    reactedObsIds: new Set(),
    countedObsIds: new Set(),
    reactionTimesMs: [],
    evadedCount: 0,
    hitCount: 0,
    jumpableFaced: 0,
    jumpableCleared: 0,
  });

  const buildPerformanceSnapshot = useCallback((): RacePerformanceMetrics => {
    const p = perfRef.current;
    const totalFaced = p.evadedCount + p.hitCount;
    const dodgeAccuracyPct =
      totalFaced > 0 ? Math.round((p.evadedCount / totalFaced) * 100) : 100;
    const jumpAccuracyPct =
      p.jumpableFaced > 0 ? Math.round((p.jumpableCleared / p.jumpableFaced) * 100) : dodgeAccuracyPct;
    const avgReactionTimeMs =
      p.reactionTimesMs.length > 0
        ? Math.round(p.reactionTimesMs.reduce((sum, v) => sum + v, 0) / p.reactionTimesMs.length)
        : null;
    const bestReactionTimeMs =
      p.reactionTimesMs.length > 0 ? Math.round(Math.min(...p.reactionTimesMs)) : null;

    let actionableTipKey: RacePerformanceMetrics['actionableTipKey'] = 'keep-focus';
    if (p.hitCount === 0 && totalFaced >= 3) {
      actionableTipKey = 'clean-master';
    } else if (jumpAccuracyPct < 75 && p.jumpableFaced >= 2) {
      actionableTipKey = 'jump-early';
    } else if (avgReactionTimeMs !== null && avgReactionTimeMs > 520) {
      actionableTipKey = 'fast-reflex';
    } else if (p.hitCount >= 2) {
      actionableTipKey = 'lane-switch';
    }

    return {
      avgReactionTimeMs,
      bestReactionTimeMs,
      dodgeAccuracyPct,
      jumpAccuracyPct,
      evadedCount: p.evadedCount,
      hitCount: p.hitCount,
      totalFaced,
      actionableTipKey,
    };
  }, []);

  const syncDashUi = useCallback((remainingMs: number) => {
    const ready = remainingMs <= 0;
    const secLabel = `${(remainingMs / 1000).toFixed(1)}s`;
    if (dashPillRef.current) {
      dashPillRef.current.className = `flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${
        ready
          ? 'bg-amber-500/20 border-amber-400/70 text-amber-300'
          : 'bg-zinc-900 border-zinc-700 text-zinc-400'
      }`;
    }
    if (dashPillTextRef.current) {
      dashPillTextRef.current.textContent = ready ? tRef.current.canvas.dashReady : secLabel;
    }
    if (dashCardRef.current) {
      dashCardRef.current.className = `p-2.5 rounded-xl border flex flex-col items-center text-center transition-colors ${
        ready ? 'bg-amber-950/35 border-amber-400/50' : 'bg-zinc-950/80 border-zinc-800'
      }`;
    }
    if (dashCardTextRef.current) {
      dashCardTextRef.current.textContent = ready
        ? `${tRef.current.canvas.gestureDashReady} · 4s`
        : `${tRef.current.canvas.gestureDashReloading} ${secLabel}`;
    }
  }, []);

  // Estado interno de física e IA por corredor rival (sem re-render ou sobrescrita)
  const botRuntimeRef = useRef<
    Map<
      string,
      {
        stumbleTimer: number;
        slideTimer: number;
        jumpVelocity: number;
        decisionCooldown: number;
        laneChangeCooldown: number;
        hitObstacleIds: Set<number>;
        basePace: number;
      }
    >
  >(new Map());

  // Estado sincronizado do loop de jogo (60 FPS)
  const stateRef = useRef<
    ThreeLiveState & {
      raceStartTime: number;
      trackOffset: number;
      curbOffset: number;
      palmOffset: number;
      obstacleIdCounter: number;
      coinIdCounter: number;
      distanceSinceLastSpawn: number;
      nextSpawnDistance: number;
      particles: Particle[];
      floatingTexts: FloatingText[];
      dashCooldownEnd: number;
      hardModeTriggered: boolean;
      playerLiveRank: number;
      playerBehindCount: number;
      playerTrailAcc: number;
      playerTrailStep: number;
      compTrailAcc: number;
      sprintAudioAcc: number;
      sprintStepIndex: number;
      weather: WeatherState;
    }
  >({
    status,
    elapsedSeconds: 0,
    raceStartTime: 0,
    trackOffset: 0,
    curbOffset: 0,
    palmOffset: 0,
    speed: WAVES[0].speed,
    obstacleIdCounter: 0,
    coinIdCounter: 0,
    distanceSinceLastSpawn: 0,
    nextSpawnDistance: 160,
    obstacles: [] as Obstacle[],
    powerUps: [] as PowerUpItem[],
    coins: [] as Coin[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    dashCooldownEnd: 0,
    playerDistance: 0,
    hardModeTriggered: false,
    playerLeanAngle: 0,
    playerLiveRank: 1,
    playerBehindCount: 0,
    playerTrailAcc: 0,
    playerTrailStep: 0,
    compTrailAcc: 0,
    sprintAudioAcc: 0,
    sprintStepIndex: 0,
    weather: createDefaultWeatherState(),
    isSpectating: Boolean(isSpectating),
    followedRunnerId: spectatedRunnerId ?? null,
    competitorsList: competitors.map((c) => ({ ...c })),
    player: {
      lane: 2 as Lane, // Começa na faixa central (Faixa 3 das 5 faixas)
      targetLane: 2 as Lane,
      laneX: LANE_CENTERS[2],
      action: 'running',
      jumpY: 0,
      jumpVelocity: 0,
      slideProgress: 0,
      dashTimer: 0,
      nitroTimer: 0,
      hatImmunityTimer: 0,
      stumbleTimer: 0,
    } as Player,
  });

  stateRef.current.isSpectating = Boolean(isSpectating);

  const prevStatusRef = useRef<GameStatus>(status);

  // Atualiza competidores apenas fora da corrida ativa para não sobrescrever a física 60 FPS
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;
    stateRef.current.status = status;
    stateRef.current.isSpectating = Boolean(isSpectating);

    if (status !== 'running') {
      stateRef.current.competitorsList = competitors.map((c) => {
        const clampedLane = Math.max(0, Math.min(4, Number(c.lane ?? 2))) as Lane;
        const center = LANE_CENTERS[clampedLane];
        const rawX = typeof c.laneX === 'number' && !Number.isNaN(c.laneX) ? c.laneX : center;
        const clampedX = Math.max(LANE_CENTERS[0], Math.min(LANE_CENTERS[4], rawX));
        return {
          ...c,
          lane: clampedLane,
          targetLane: Math.max(0, Math.min(4, Number(c.targetLane ?? clampedLane))) as Lane,
          laneX: status === 'idle' || status === 'starting' ? center : clampedX,
          jumpY: status === 'idle' || status === 'starting' ? 0 : c.jumpY || 0,
          progressDistance:
            status === 'idle' || status === 'starting' ? 0 : c.progressDistance || 0,
          stumbling: status === 'idle' || status === 'starting' ? false : Boolean(c.stumbling),
          action: status === 'idle' || status === 'starting' ? 'running' : c.action || 'running',
        };
      });
    }

    const roundChanged = prevRoundNonceRef.current !== roundNonce;
    prevRoundNonceRef.current = roundNonce;

    const shouldResetRaceState =
      status === 'idle' || (status === 'starting' && (prevStatus !== 'starting' || roundChanged));

    if (shouldResetRaceState) {
      raceFinishedRef.current = false;
      perfRef.current = {
        threatStartMap: new Map(),
        reactedObsIds: new Set(),
        countedObsIds: new Set(),
        reactionTimesMs: [],
        evadedCount: 0,
        hitCount: 0,
        jumpableFaced: 0,
        jumpableCleared: 0,
      };
      gestureStateRef.current.activePointerId = null;
      gestureStateRef.current.hasSwiped = false;
      gestureStateRef.current.lastTapTime = 0;
      stateRef.current.elapsedSeconds = 0;
      stateRef.current.raceStartTime = 0;
      stateRef.current.playerDistance = 0;
      stateRef.current.trackOffset = 0;
      stateRef.current.curbOffset = 0;
      stateRef.current.palmOffset = 0;
      stateRef.current.speed = WAVES[0].speed;
      stateRef.current.obstacles = [];
      stateRef.current.powerUps = [];
      stateRef.current.coins = [];
      stateRef.current.particles = [];
      stateRef.current.floatingTexts = [];
      stateRef.current.dashCooldownEnd = 0;
      stateRef.current.hardModeTriggered = false;
      stateRef.current.playerLeanAngle = 0;
      stateRef.current.distanceSinceLastSpawn = 0;
      stateRef.current.nextSpawnDistance = 160;
      stateRef.current.playerLiveRank = 1;
      stateRef.current.playerBehindCount = 0;
      stateRef.current.playerTrailAcc = 0;
      stateRef.current.playerTrailStep = 0;
      stateRef.current.compTrailAcc = 0;
      stateRef.current.sprintAudioAcc = 0;
      stateRef.current.sprintStepIndex = 0;
      stateRef.current.weather = createDefaultWeatherState();
      setLiveRank(1);
      setAheadOfCount(0);
      lastRankRef.current = 1;
      lastBehindRef.current = 0;
      if (lastWeatherKindRef.current !== 'clear') {
        lastWeatherKindRef.current = 'clear';
        setWeatherKindUi('clear');
      }
      motionBurstTimersRef.current.forEach((timer) => clearTimeout(timer));
      motionBurstTimersRef.current.clear();
      rivalJumpCooldownRef.current.clear();
      setMotionBursts([]);
      lastTimeEmitRef.current = -1;
      lastDashUiEmitRef.current = -1;
      syncDashUi(0);
      setActivePowerUpNotice(null);

      // Reinicia estado de ritmo e colisões apenas dos bots (jogadores humanos reais nunca usam IA)
      botRuntimeRef.current.clear();
      competitors.forEach((c) => {
        if (!c.isPlayer && c.isBot && !c.isRemoteHuman) {
          botRuntimeRef.current.set(c.id, {
            stumbleTimer: 0,
            slideTimer: 0,
            jumpVelocity: 0,
            decisionCooldown: 0,
            laneChangeCooldown: 0,
            hitObstacleIds: new Set<number>(),
            basePace: 1.0,
          });
        }
      });

      const playerComp = competitors.find((c) => c.isPlayer);
      const startLane = clampLaneIndex(playerComp?.lane ?? 2);

      waveRngRef.current = raceSeedRef.current ? createSeededRng(raceSeedRef.current) : Math.random;
      telemetryEmitRef.current = {
        lastAt: 0,
        lastLane: -1,
        lastTargetLane: -1,
        lastAction: '',
        lastStumbling: false,
        lastFinished: false,
        lastJumpActive: false,
      };

      stateRef.current.player = {
        lane: startLane,
        targetLane: startLane,
        laneX: LANE_CENTERS[startLane],
        action: 'running',
        jumpY: 0,
        jumpVelocity: 0,
        slideProgress: 0,
        dashTimer: 0,
        nitroTimer: 0,
        hatImmunityTimer: 0,
        stumbleTimer: 0,
      };

      if (status === 'starting') {
        // Pista limpa nos primeiros segundos: apenas moedas douradas de guia, sem nenhum obstáculo!
        stateRef.current.obstacles = [];
        stateRef.current.coins = [
          { id: ++stateRef.current.coinIdCounter, lane: startLane, y: -100, value: 50, collected: false },
          { id: ++stateRef.current.coinIdCounter, lane: startLane, y: -180, value: 50, collected: false },
          { id: ++stateRef.current.coinIdCounter, lane: 1, y: -260, value: 50, collected: false },
          { id: ++stateRef.current.coinIdCounter, lane: 3, y: -340, value: 50, collected: false },
        ];
      }
    }
  }, [status, competitors, roundNonce, syncDashUi]);

  // Helpers de Limites Estritos (Boundary Checks) para Jogador e Competidores
  const clampLaneIndex = (lane: number): Lane =>
    Math.max(0, Math.min(4, Math.round(Number.isFinite(lane) ? lane : 2))) as Lane;

  const nearestLaneFromX = (x: number): Lane =>
    clampLaneIndex((x - TRACK_MIN_CENTER_X) / LANE_WIDTH);

  const pushParticle = (list: Particle[], particle: Particle) => {
    if (list.length >= MAX_ACTIVE_PARTICLES) {
      // Substitui a partícula mais antiga em O(1) amortizado sem realocar array
      list.shift();
    }
    list.push(particle);
  };

  const pushFloatingText = (list: FloatingText[], item: FloatingText) => {
    if (list.length >= MAX_FLOATING_TEXTS) {
      list.shift();
    }
    list.push(item);
  };

  // Camada de Verificação de Limites (Boundary Check): garante que laneX respeita os limites da pista sem cortar a animação lateral
  const enforcePlayerLaneBoundary = (player: Player) => {
    const safeTargetLane = clampLaneIndex(player.targetLane);
    const safeLane = clampLaneIndex(player.lane);
    player.targetLane = safeTargetLane;
    player.lane = safeLane;

    const targetCenter = LANE_CENTERS[safeTargetLane];
    if (!Number.isFinite(player.laneX)) {
      player.laneX = targetCenter;
      player.lane = safeTargetLane;
      return;
    }

    // Nunca permite ultrapassar os limites físicos laterais da pista (Faixa 0 .. Faixa 4)
    player.laneX = Math.max(TRACK_MIN_CENTER_X, Math.min(TRACK_MAX_CENTER_X, player.laneX));

    if (Math.abs(player.laneX - targetCenter) < 0.75) {
      player.laneX = targetCenter;
      player.lane = safeTargetLane;
      return;
    }
  };

  const enforceCompetitorLaneBoundary = (comp: Competitor) => {
    const safeTargetLane = clampLaneIndex(comp.targetLane ?? comp.lane);
    const safeLane = clampLaneIndex(comp.lane);
    comp.targetLane = safeTargetLane;
    comp.lane = safeLane;

    const targetCenter = LANE_CENTERS[safeTargetLane];
    if (!Number.isFinite(comp.laneX)) {
      comp.laneX = targetCenter;
      comp.lane = safeTargetLane;
      return;
    }

    comp.laneX = Math.max(TRACK_MIN_CENTER_X, Math.min(TRACK_MAX_CENTER_X, comp.laneX));

    if (Math.abs(comp.laneX - targetCenter) < 0.75) {
      comp.laneX = targetCenter;
      comp.lane = safeTargetLane;
      return;
    }

    if (!Number.isFinite(comp.progressDistance) || comp.progressDistance < 0) {
      comp.progressDistance = Math.max(0, Number.isFinite(comp.progressDistance) ? comp.progressDistance : 0);
    }
    if (!Number.isFinite(comp.jumpY) || comp.jumpY < 0) {
      comp.jumpY = 0;
    }
  };

  const recordObstacleReaction = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'running') return;
    const perf = perfRef.current;
    const now = performance.now();

    let bestObsId: number | null = null;
    let bestObsY = -Infinity;
    for (let i = 0; i < s.obstacles.length; i++) {
      const obs = s.obstacles[i];
      if (obs.passed || perf.reactedObsIds.has(obs.id)) continue;
      if (obs.lane !== s.player.targetLane && obs.lane !== s.player.lane) continue;
      if (obs.y > 120 && obs.y < PLAYER_BASE_Y + 20 && obs.y > bestObsY) {
        bestObsY = obs.y;
        bestObsId = obs.id;
      }
    }

    if (bestObsId !== null) {
      perf.reactedObsIds.add(bestObsId);
      const startedAt = perf.threatStartMap.get(bestObsId);
      if (startedAt !== undefined) {
        const reactionMs = Math.round(Math.max(95, Math.min(1800, now - startedAt)));
        perf.reactionTimesMs.push(reactionMs);
      }
    }
  }, []);

  // Ações de Controle nas 5 Faixas (desativadas em modo espectador)
  const moveLane = useCallback((direction: 'left' | 'right') => {
    const s = stateRef.current;
    if (s.status !== 'running' || isSpectatingRef.current) return;
    recordObstacleReaction();
    const currentTarget = clampLaneIndex(s.player.targetLane);
    const physicalLane = Number.isFinite(s.player.laneX)
      ? nearestLaneFromX(s.player.laneX)
      : currentTarget;

    if (direction === 'left' && currentTarget > 0) {
      const nextTarget = (currentTarget - 1) as Lane;
      s.player.lane = physicalLane === nextTarget ? currentTarget : physicalLane;
      s.player.targetLane = nextTarget;
      sounds.playLaneSwitch();
    } else if (direction === 'right' && currentTarget < 4) {
      const nextTarget = (currentTarget + 1) as Lane;
      s.player.lane = physicalLane === nextTarget ? currentTarget : physicalLane;
      s.player.targetLane = nextTarget;
      sounds.playLaneSwitch();
    }
  }, [recordObstacleReaction]);

  const triggerJump = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'running' || isSpectatingRef.current) return;
    recordObstacleReaction();
    if (s.player.jumpY === 0 && s.player.action !== 'sliding') {
      s.player.jumpVelocity = JUMP_INITIAL_VELOCITY;
      s.player.action = 'jumping';
      sounds.playJump();
      emitMotionBurst('jump', s.player.laneX, PLAYER_BASE_Y + PLAYER_HEIGHT * 0.38, {
        color: '#38bdf8',
      });
    }
  }, [emitMotionBurst, recordObstacleReaction]);

  const triggerSlide = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'running' || isSpectatingRef.current) return;
    recordObstacleReaction();
    if (s.player.jumpY > 0) {
      s.player.jumpVelocity = -12; // Queda rápida se estiver no ar
    }
    s.player.slideProgress = 1.0;
    s.player.action = 'sliding';
    sounds.playSlide();

    // Poeira no asfalto da Marginal
    for (let i = 0; i < 6; i++) {
      pushParticle(s.particles, {
        x: s.player.laneX + (Math.random() - 0.5) * 20,
        y: PLAYER_BASE_Y + PLAYER_HEIGHT * 0.4,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        radius: Math.random() * 2.5 + 1.8,
        color: '#d97706',
        alpha: 0.75,
        maxAlpha: 0.75,
        life: 0,
        maxLife: 18,
        kind: 'dust',
      });
    }
  }, [recordObstacleReaction]);

  const triggerDash = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'running' || isSpectatingRef.current) return;
    const now = performance.now();
    if (now < s.dashCooldownEnd) return;
    recordObstacleReaction();

    s.player.dashTimer = DASH_DURATION_MS / 1000;
    s.dashCooldownEnd = now + DASH_COOLDOWN_MS;
    if (s.player.jumpY === 0 && s.player.slideProgress <= 0.05) {
      s.player.action = 'dashing';
    }
    sounds.playDash();
    sounds.playSprintBurst();
    lastDashUiEmitRef.current = now;
    syncDashUi(DASH_COOLDOWN_MS);

    for (let i = 0; i < 6; i++) {
      pushParticle(s.particles, {
        x: s.player.laneX + (Math.random() - 0.5) * 18,
        y: PLAYER_BASE_Y + PLAYER_HEIGHT * 0.42,
        vx: (Math.random() - 0.5) * 2.2,
        vy: Math.random() * 2.5 + 2.4,
        radius: Math.random() * 2 + 1.4,
        color: '#fde047',
        alpha: 0.75,
        maxAlpha: 0.75,
        life: 0,
        maxLife: 11,
        kind: 'trail',
      });
    }
  }, [syncDashUi, recordObstacleReaction]);

  // Atalhos de teclado (esquerda, direita, saltar, baixar e Shift para Dash)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditingText && stateRef.current.status !== 'running') return;
      if (stateRef.current.status !== 'running' || isSpectatingRef.current) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLane('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') moveLane('right');
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') triggerJump();
      if (e.code === 'ArrowDown' || e.code === 'KeyS') triggerSlide();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        triggerDash();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveLane, triggerJump, triggerSlide, triggerDash]);

  // Gestos Táteis Unificados (Toque simples não dispara nada; Duplo toque = Dash; Deslize = Faixa/Salto/Agachar)
  const gestureStateRef = useRef<{
    activePointerId: number | null;
    startX: number;
    startY: number;
    hasSwiped: boolean;
    lastTapTime: number;
  }>({
    activePointerId: null,
    startX: 0,
    startY: 0,
    hasSwiped: false,
    lastTapTime: 0,
  });

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.status !== 'running' || isSpectatingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (
      gestureStateRef.current.activePointerId !== null &&
      e.currentTarget.hasPointerCapture?.(gestureStateRef.current.activePointerId)
    ) {
      return;
    }

    gestureStateRef.current.activePointerId = e.pointerId;
    gestureStateRef.current.startX = e.clientX;
    gestureStateRef.current.startY = e.clientY;
    gestureStateRef.current.hasSwiped = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback caso pointer capture não esteja disponível
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.status !== 'running' || isSpectatingRef.current) return;
    if (gestureStateRef.current.activePointerId !== e.pointerId) return;
    if (gestureStateRef.current.hasSwiped) return;

    const dx = e.clientX - gestureStateRef.current.startX;
    const dy = e.clientY - gestureStateRef.current.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 👈 👉 Deslizar horizontalmente: Move rigorosamente UMA faixa apenas pelo movimento do dedo
    if (absDx > 18 && absDx > absDy * 0.8) {
      moveLane(dx > 0 ? 'right' : 'left');
      gestureStateRef.current.hasSwiped = true;
      gestureStateRef.current.lastTapTime = 0;
      return;
    }

    // 👆 Subir o dedo na tela = Saltar verticalmente!
    if (dy < -18 && absDy > absDx * 0.8) {
      triggerJump();
      gestureStateRef.current.hasSwiped = true;
      gestureStateRef.current.lastTapTime = 0;
      return;
    }

    // 👇 Baixar o dedo na tela = Agachar / Deslizar!
    if (dy > 18 && absDy > absDx * 0.8) {
      triggerSlide();
      gestureStateRef.current.hasSwiped = true;
      gestureStateRef.current.lastTapTime = 0;
      return;
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gestureStateRef.current.activePointerId !== e.pointerId) return;
    gestureStateRef.current.activePointerId = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

    const totalDx = e.clientX - gestureStateRef.current.startX;
    const totalDy = e.clientY - gestureStateRef.current.startY;
    const absDx = Math.abs(totalDx);
    const absDy = Math.abs(totalDy);

    if (!gestureStateRef.current.hasSwiped && stateRef.current.status === 'running') {
      if (absDx > 16 || absDy > 16) {
        gestureStateRef.current.lastTapTime = 0;
        if (absDx > absDy) {
          moveLane(totalDx > 0 ? 'right' : 'left');
        } else {
          if (totalDy < 0) triggerJump();
          else triggerSlide();
        }
      } else {
        const now = performance.now();
        const sincePrevTap = now - gestureStateRef.current.lastTapTime;
        if (sincePrevTap > 20 && sincePrevTap <= 360) {
          gestureStateRef.current.lastTapTime = 0;
          triggerDash();
        } else {
          gestureStateRef.current.lastTapTime = now;
        }
      }
    } else {
      gestureStateRef.current.lastTapTime = 0;
    }
    gestureStateRef.current.hasSwiped = false;
  };

  const handleCanvasPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gestureStateRef.current.activePointerId !== e.pointerId) return;
    gestureStateRef.current.activePointerId = null;
    gestureStateRef.current.hasSwiped = false;
  };

  const handleCanvasLostPointerCapture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gestureStateRef.current.activePointerId === e.pointerId) {
      gestureStateRef.current.activePointerId = null;
      gestureStateRef.current.hasSwiped = false;
    }
  };

  // Loop de Renderização e Física (60 FPS)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let cachedDaySkyGrad: CanvasGradient | null = null;
    let cachedNightSkyGrad: CanvasGradient | null = null;
    let cachedDaySeaGrad: CanvasGradient | null = null;
    let cachedNightSeaGrad: CanvasGradient | null = null;

    const loop = (currentTime: number) => {
      const dt = Math.min(Math.max((currentTime - lastTime) / 1000, 0.001), 0.05);
      const dtScale = dt * 60; // Normalizado a 60Hz para física idêntica em ecrãs 30Hz/60Hz/120Hz
      lastTime = currentTime;

      const s = stateRef.current;
      const canvas = canvasRef.current;

      const spectatingNow = isSpectatingRef.current;
      s.isSpectating = spectatingNow;

      if (s.status === 'running') {
        // Cronômetro oficial exato de 40.0 segundos via performance.now() sincronizado ao raceStartAt
        const nowPerf = performance.now();
        if (!s.raceStartTime) {
          if (syncedRaceStartAtRef.current) {
            const maxOffsetMs = spectatingNow ? TOTAL_GAME_TIME_SECONDS * 1000 : 2000;
            const elapsedSinceStart = Math.max(
              0,
              Math.min(maxOffsetMs, Date.now() - syncedRaceStartAtRef.current)
            );
            s.raceStartTime = nowPerf - elapsedSinceStart;
          } else {
            s.raceStartTime = nowPerf;
          }
        }
        const exactElapsed = (nowPerf - s.raceStartTime) / 1000;
        s.elapsedSeconds = Math.min(TOTAL_GAME_TIME_SECONDS, exactElapsed);
        const wholeSecond = Math.floor(s.elapsedSeconds);
        if (wholeSecond !== lastTimeEmitRef.current || s.elapsedSeconds >= TOTAL_GAME_TIME_SECONDS) {
          lastTimeEmitRef.current = wholeSecond;
          onTimeUpdateRef.current(s.elapsedSeconds);
        }

        // Ondas de dificuldade (Partida de 40s):
        // 0-20s Fácil | 20-40s MODO REI DIFÍCIL
        const isHard = s.elapsedSeconds >= HARD_MODE_START_SECONDS;
        if (isHard && !s.hardModeTriggered) {
          s.hardModeTriggered = true;
          if (!spectatingNow) {
            sounds.setRaceSpeed(true);
            sounds.playHardModeSiren();
          }
          pushFloatingText(s.floatingTexts, {
            id: Date.now(),
            text: tRef.current.canvas.hardModeAlert,
            x: CANV_WIDTH / 2,
            y: CANV_HEIGHT / 2 - 30,
            color: '#ef4444',
            alpha: 1.0,
            life: 0,
          });
        }
        const currentWave = isHard ? WAVES[1] : WAVES[0];
        const baseWaveSpeed = currentWave.speed;
        const activeWeatherSeed = raceSeedRef.current ?? (roundNonceRef.current || 1337);
        const nextWeather = evaluateRaceWeather(activeWeatherSeed, s.elapsedSeconds);
        s.weather = nextWeather;
        if (nextWeather.kind !== lastWeatherKindRef.current) {
          lastWeatherKindRef.current = nextWeather.kind;
          setWeatherKindUi(nextWeather.kind);
          if (nextWeather.kind !== 'clear') {
            const wBadge = getWeatherUiBadge(nextWeather.kind, langRef.current);
            pushFloatingText(s.floatingTexts, {
              id: Date.now() + Math.random(),
              text: `${wBadge.icon} ${wBadge.label}`,
              x: CANV_WIDTH / 2,
              y: 122,
              color: nextWeather.kind === 'light-rain' ? '#7dd3fc' : '#e2e8f0',
              alpha: 1.0,
              life: 0,
            });
          }
        }

        if (!spectatingNow) {
          // Velocidade base idêntica para todos os corredores + clima + Dash + Nitro
          let activeSpeed = baseWaveSpeed * nextWeather.speedMultiplier;
          if (s.player.nitroTimer > 0) {
            s.player.nitroTimer = Math.max(0, s.player.nitroTimer - dt);
            activeSpeed *= 1.35;
          }
          if (s.player.dashTimer > 0) {
            s.player.dashTimer = Math.max(0, s.player.dashTimer - dt);
            activeSpeed *= 1.55;
            if (s.player.dashTimer === 0 && s.player.action === 'dashing') {
              s.player.action =
                s.player.jumpY > 0
                  ? 'jumping'
                  : s.player.slideProgress > 0.05
                  ? 'sliding'
                  : 'running';
            }
          }

          // Sincronia direta via ref DOM da recarga do Dash (zero re-renders React a 60 FPS)
          const remainingDashCd = Math.max(0, s.dashCooldownEnd - nowPerf);
          if (
            (remainingDashCd > 0 && nowPerf - lastDashUiEmitRef.current >= 200) ||
            (remainingDashCd === 0 && lastDashUiEmitRef.current !== -1)
          ) {
            lastDashUiEmitRef.current = remainingDashCd > 0 ? nowPerf : -1;
            syncDashUi(remainingDashCd);
          }

          // Abrandamento suave ao tocar em obstáculo (~1.1s sem teleporte brusco)
          if (s.player.stumbleTimer > 0) {
            s.player.stumbleTimer = Math.max(0, s.player.stumbleTimer - dt);
            const recoveryProgress = 1 - Math.min(1, s.player.stumbleTimer / 1.1);
            const slowdownMultiplier = 0.45 + 0.42 * recoveryProgress;
            activeSpeed *= slowdownMultiplier;
            if (s.player.stumbleTimer === 0 && s.player.action === 'stumbling') {
              s.player.action =
                s.player.jumpY > 0
                  ? 'jumping'
                  : s.player.slideProgress > 0.05
                  ? 'sliding'
                  : 'running';
            }
          }

          if (s.player.hatImmunityTimer > 0) {
            s.player.hatImmunityTimer = Math.max(0, s.player.hatImmunityTimer - dt);
          }

          s.speed = Math.max(2.6, activeSpeed);
          s.playerDistance = Math.max(0, s.playerDistance + dt * (s.speed * 1.5));

          // Interpolação fluida contínua de troca de faixa (laneX anima sempre até alcançar o destino)
          const clampedTargetLane = clampLaneIndex(s.player.targetLane);
          s.player.targetLane = clampedTargetLane;
          const targetPlayerX = LANE_CENTERS[clampedTargetLane];
          const prevPlayerLaneX = Number.isFinite(s.player.laneX) ? s.player.laneX : targetPlayerX;
          const playerLaneLerp = 1 - Math.exp(-16 * dt);
          if (Math.abs(targetPlayerX - prevPlayerLaneX) < 0.75) {
            s.player.laneX = targetPlayerX;
            s.player.lane = clampedTargetLane;
          } else {
            s.player.laneX = prevPlayerLaneX + (targetPlayerX - prevPlayerLaneX) * playerLaneLerp;
            if (Math.abs(targetPlayerX - s.player.laneX) < 0.75) {
              s.player.laneX = targetPlayerX;
              s.player.lane = clampedTargetLane;
            }
          }
          enforcePlayerLaneBoundary(s.player);

          // Inclinação lateral dinâmica (apenas durante troca real de faixa)
          const targetTilt =
            s.player.lane === clampedTargetLane
              ? 0
              : ((targetPlayerX - s.player.laneX) / LANE_WIDTH) * 0.32;
          const leanLerp = 1 - Math.exp(-20 * dt);
          s.playerLeanAngle += (targetTilt - s.playerLeanAngle) * leanLerp;
          if (Math.abs(s.playerLeanAngle) < 0.004 && targetTilt === 0) {
            s.playerLeanAngle = 0;
          }

          // Partículas leves de asfalto / derrapagem quando mudando de faixa
          if (Math.abs(s.player.laneX - prevPlayerLaneX) > 1.8 * dtScale && Math.random() < 0.4) {
            pushParticle(s.particles, {
              x: s.player.laneX + (Math.random() - 0.5) * 10,
              y: PLAYER_BASE_Y + PLAYER_HEIGHT * 0.4,
              vx: (prevPlayerLaneX - s.player.laneX) * 0.14,
              vy: -Math.random() * 1.2 - 0.3,
              radius: Math.random() * 2 + 1.2,
              color: '#d97706',
              alpha: 0.55,
              maxAlpha: 0.55,
              life: 0,
              maxLife: 12,
              kind: 'dust',
            });
          }

          // Efeito de rastro sutil apenas na base dos pés (leve para 60 FPS no telemóvel)
          const speedNormLocal = Math.max(0.6, Math.min(1.65, s.speed / 9.0));
          if (s.player.jumpY < 8 && s.player.stumbleTimer <= 0) {
            const emitRate = (s.player.dashTimer > 0 ? 20 : 12) * speedNormLocal;
            s.playerTrailAcc += dt * emitRate;
            while (s.playerTrailAcc >= 1) {
              s.playerTrailAcc -= 1;
              s.playerTrailStep = (s.playerTrailStep + 1) % 2;
              const footSide = s.playerTrailStep === 0 ? -5.5 : 5.5;
              const trailColor =
                s.player.dashTimer > 0 ? '#fde047' : isHard ? '#fb923c' : '#f59e0b';
              const maxAlpha = s.player.dashTimer > 0 ? 0.42 : 0.25;
              const spawnX = Math.max(
                TRACK_MIN_CENTER_X - 8,
                Math.min(TRACK_MAX_CENTER_X + 8, s.player.laneX + footSide + (Math.random() - 0.5) * 2.5)
              );
              pushParticle(s.particles, {
                x: spawnX,
                y: PLAYER_BASE_Y + PLAYER_HEIGHT * 0.44,
                vx: (Math.random() - 0.5) * 0.16,
                vy: Math.max(2.6, s.speed * 0.52),
                radius: 1.2 + Math.random() * 0.6,
                color: trailColor,
                alpha: maxAlpha,
                maxAlpha,
                life: 0,
                maxLife: 8,
                kind: 'trail',
              });
            }
          } else {
            s.playerTrailAcc = 0;
          }

          // Áudio rítmico de sprint sincronizado às passadas do corredor no asfalto
          if (s.player.jumpY <= 4 && s.player.slideProgress < 0.25 && s.player.stumbleTimer <= 0) {
            const isSprintingFast = s.player.dashTimer > 0 || s.player.nitroTimer > 0;
            const strideHz = (isSprintingFast ? 6.2 : isHard ? 4.4 : 3.5) * Math.min(1.35, speedNormLocal);
            const sprintIntensity = isSprintingFast ? 1.45 : isHard ? 1.18 : 0.95;
            s.sprintAudioAcc += dt * strideHz;
            if (s.sprintAudioAcc >= 1) {
              s.sprintAudioAcc = Math.min(0.4, s.sprintAudioAcc - 1);
              sounds.playSprintStep(sprintIntensity, s.sprintStepIndex);
              s.sprintStepIndex = (s.sprintStepIndex + 1) % 2;
            }
          } else {
            s.sprintAudioAcc = 0;
          }
        }

        const speedNorm = Math.max(0.6, Math.min(1.65, s.speed / 9.0));
        const frameSpeed = s.speed * dtScale;
        s.trackOffset = (s.trackOffset + frameSpeed) % 48; // Período exato [26, 22] das faixas tracejadas
        s.curbOffset = (s.curbOffset + frameSpeed) % 56; // Calçadão rolante sincronizado à velocidade real da pista
        s.palmOffset = (s.palmOffset + frameSpeed * 0.85) % 160; // Palmeiras em paralaxe fluida contínua

        // Atualiza os corredores nas 5 faixas (jogadores humanos reais via WebSocket + bots locais)
        const remoteMap = remotePlayersRefStable.current?.current;
        for (const comp of s.competitorsList) {
          if (!spectatingNow && comp.isPlayer) {
            comp.progressDistance = s.playerDistance;
            comp.lane = s.player.lane;
            comp.targetLane = s.player.targetLane;
            comp.laneX = s.player.laneX;
            comp.jumpY = s.player.jumpY;
            comp.action = s.player.action;
            comp.stumbling = s.player.stumbleTimer > 0;

            if (onLocalRaceTelemetryRef.current) {
              const tel = telemetryEmitRef.current;
              const jumpActive = (comp.jumpY || 0) > 2;
              const discreteChanged =
                tel.lastAt === 0 ||
                tel.lastLane !== comp.lane ||
                tel.lastTargetLane !== comp.targetLane ||
                tel.lastAction !== comp.action ||
                tel.lastStumbling !== Boolean(comp.stumbling) ||
                tel.lastJumpActive !== jumpActive;
              if (discreteChanged || nowPerf - tel.lastAt >= 30) {
                tel.lastAt = nowPerf;
                tel.lastLane = comp.lane;
                tel.lastTargetLane = comp.targetLane;
                tel.lastAction = comp.action;
                tel.lastStumbling = Boolean(comp.stumbling);
                tel.lastJumpActive = jumpActive;
                onLocalRaceTelemetryRef.current({
                  progressDistance: comp.progressDistance,
                  lane: comp.lane,
                  targetLane: comp.targetLane,
                  laneX: comp.laneX,
                  action: comp.action,
                  jumpY: comp.jumpY,
                  stumbling: Boolean(comp.stumbling),
                  finished: Boolean(comp.finished),
                });
              }
            }
          } else if (!comp.isBot || comp.isRemoteHuman) {
            // Jogador humano real controlado remotamente em tempo real — nunca usa IA ou movimentos inventados
            const snap = remoteMap?.get(comp.id);
            if (snap) {
              const rawAgeMs = Math.max(0, Date.now() - (snap.updatedAt || Date.now()));
              const ageSec = rawAgeMs < 350 ? Math.min(0.08, rawAgeMs / 1000) : 0;
              const expectedPace =
                (snap.stumbling
                  ? baseWaveSpeed * 0.65 * 1.5
                  : snap.action === 'dashing'
                  ? baseWaveSpeed * 1.55 * 1.5
                  : baseWaveSpeed * 1.5) * nextWeather.speedMultiplier;
              const projectedDist =
                snap.finished || ageSec <= 0
                  ? snap.progressDistance
                  : snap.progressDistance + ageSec * expectedPace;
              const distGap = projectedDist - comp.progressDistance;
              if (Math.abs(distGap) > 35 || ageSec <= 0) {
                comp.progressDistance = projectedDist;
              } else {
                const distLerp = 1 - Math.exp(-22 * dt);
                comp.progressDistance = Math.max(
                  0,
                  comp.progressDistance + distGap * distLerp
                );
              }
              comp.targetLane = clampLaneIndex(snap.targetLane ?? snap.lane);
              const snapTargetX =
                typeof snap.laneX === 'number' && Number.isFinite(snap.laneX)
                  ? Math.max(TRACK_MIN_CENTER_X, Math.min(TRACK_MAX_CENTER_X, snap.laneX))
                  : LANE_CENTERS[comp.targetLane];
              const currX = Number.isFinite(comp.laneX) ? comp.laneX : snapTargetX;
              const xLerp = 1 - Math.exp(-14 * dt);
              if (Math.abs(snapTargetX - currX) < 0.75) {
                comp.laneX = snapTargetX;
                comp.lane = clampLaneIndex(snap.lane);
              } else {
                comp.laneX = currX + (snapTargetX - currX) * xLerp;
                comp.lane = nearestLaneFromX(comp.laneX);
              }
              const jumpLerp = 1 - Math.exp(-26 * dt);
              comp.jumpY = Math.max(0, (comp.jumpY || 0) + (snap.jumpY - (comp.jumpY || 0)) * jumpLerp);
              const prevCompAction = comp.action;
              comp.action = snap.action;
              comp.stumbling = Boolean(snap.stumbling);
              comp.finished = Boolean(snap.finished);
              enforceCompetitorLaneBoundary(comp);

              if (snap.action === 'jumping' && prevCompAction !== 'jumping') {
                const remoteScreenY = computeCompetitorScreenY(
                  comp.progressDistance - s.playerDistance
                );
                if (remoteScreenY >= 70 && remoteScreenY <= CANV_HEIGHT - 20) {
                  const lastBurstAt = rivalJumpCooldownRef.current.get(comp.id) || 0;
                  if (nowPerf - lastBurstAt >= 450) {
                    rivalJumpCooldownRef.current.set(comp.id, nowPerf);
                    emitMotionBurst('jump', comp.laneX, remoteScreenY + PLAYER_HEIGHT * 0.36, {
                      color: comp.color || '#38bdf8',
                    });
                  }
                }
              }
            } else {
              // Sem telemetria recebida ainda: mantém posição exata na faixa sem inventar movimentos
              comp.lane = clampLaneIndex(comp.lane);
              comp.targetLane = clampLaneIndex(comp.targetLane ?? comp.lane);
              comp.laneX = LANE_CENTERS[comp.targetLane];
              comp.jumpY = 0;
              comp.action = 'running';
              comp.stumbling = false;
              enforceCompetitorLaneBoundary(comp);
            }
          } else if (comp.isBot && !comp.isRemoteHuman) {
            let bot = botRuntimeRef.current.get(comp.id);
            if (!bot) {
              bot = {
                stumbleTimer: 0,
                slideTimer: 0,
                jumpVelocity: 0,
                decisionCooldown: 0,
                laneChangeCooldown: 0,
                hitObstacleIds: new Set<number>(),
                basePace: 1.0,
              };
              botRuntimeRef.current.set(comp.id, bot);
            }

            if (bot.decisionCooldown > 0) bot.decisionCooldown = Math.max(0, bot.decisionCooldown - dt);
            if (bot.laneChangeCooldown > 0) bot.laneChangeCooldown = Math.max(0, bot.laneChangeCooldown - dt);

            if (bot.slideTimer > 0) {
              bot.slideTimer = Math.max(0, bot.slideTimer - dt);
              if (bot.slideTimer === 0 && comp.action === 'sliding') {
                comp.action = 'running';
              }
            }

            // Posição visual partilhada 2D/3D do bot na pista para colisão e esquiva real
            const distDelta = comp.progressDistance - s.playerDistance;
            const compScreenY = computeCompetitorScreenY(distDelta);

            // Reação ágil do bot diante de obstáculos reais na sua faixa
            if (bot.decisionCooldown <= 0 && bot.stumbleTimer <= 0) {
              const ahead = s.obstacles.find(
                (o) =>
                  o.lane === comp.targetLane &&
                  o.y > compScreenY - 220 &&
                  o.y < compScreenY - 25
              );
              if (ahead) {
                bot.decisionCooldown = 0.24;
                if (Math.random() < 0.72) {
                  const mustDodge =
                    ahead.type === 'barrier' || ahead.obstacleId === 'candongueiro-parado';
                  if (!mustDodge && ahead.obstacleId === 'fios-caidos') {
                    bot.slideTimer = 0.55;
                    comp.action = 'sliding';
                  } else if (!mustDodge && (!comp.jumpY || comp.jumpY === 0)) {
                    bot.jumpVelocity = JUMP_INITIAL_VELOCITY;
                    comp.jumpY = 0.01;
                    comp.action = 'jumping';
                    if (compScreenY >= 70 && compScreenY <= CANV_HEIGHT - 20) {
                      const lastBurstAt = rivalJumpCooldownRef.current.get(comp.id) || 0;
                      if (nowPerf - lastBurstAt >= 450) {
                        rivalJumpCooldownRef.current.set(comp.id, nowPerf);
                        emitMotionBurst('jump', comp.laneX, compScreenY + PLAYER_HEIGHT * 0.36, {
                          color: comp.color || '#f59e0b',
                        });
                      }
                    }
                  } else if (bot.laneChangeCooldown <= 0) {
                    const adjOptions: Lane[] = [];
                    if (comp.targetLane > 0) adjOptions.push((comp.targetLane - 1) as Lane);
                    if (comp.targetLane < 4) adjOptions.push((comp.targetLane + 1) as Lane);
                    const clearOptions = adjOptions.filter(
                      (candLane) =>
                        !s.obstacles.some(
                          (o) => o.lane === candLane && Math.abs(o.y - ahead.y) < 150
                        )
                    );
                    const pool = clearOptions.length > 0 ? clearOptions : adjOptions;
                    const unoccupied = pool.filter(
                      (candLane) =>
                        !s.competitorsList.some(
                          (other) => other.id !== comp.id && other.targetLane === candLane
                        )
                    );
                    const finalPool = unoccupied.length > 0 ? unoccupied : pool;
                    if (finalPool.length > 0) {
                      comp.targetLane = finalPool[Math.floor(Math.random() * finalPool.length)];
                      bot.laneChangeCooldown = 0.75;
                    }
                  }
                }
              }
            }

            // Garante transição lateral animada de laneX dentro das 5 faixas oficiais [0..4]
            const safeTargetLane = clampLaneIndex(comp.targetLane ?? comp.lane);
            comp.targetLane = safeTargetLane;
            const targetX = LANE_CENTERS[safeTargetLane];
            const currX =
              typeof comp.laneX === 'number' && Number.isFinite(comp.laneX)
                ? Math.max(TRACK_MIN_CENTER_X, Math.min(TRACK_MAX_CENTER_X, comp.laneX))
                : targetX;
            if (Math.abs(targetX - currX) < 0.75) {
              comp.laneX = targetX;
              comp.lane = safeTargetLane;
            } else {
              const botLaneLerp = 1 - Math.exp(-14 * dt);
              comp.laneX = currX + (targetX - currX) * botLaneLerp;
              if (Math.abs(targetX - comp.laneX) < 0.75) {
                comp.laneX = targetX;
                comp.lane = safeTargetLane;
              }
            }
            enforceCompetitorLaneBoundary(comp);

            // Parábola real de gravidade do pulo do bot (sincronizada 2D/3D)
            if ((comp.jumpY && comp.jumpY > 0) || bot.jumpVelocity !== 0) {
              comp.jumpY = (comp.jumpY || 0) + bot.jumpVelocity * dtScale;
              bot.jumpVelocity -= GRAVITY * dtScale;
              if (comp.jumpY <= 0) {
                comp.jumpY = 0;
                bot.jumpVelocity = 0;
                if (comp.action === 'jumping') {
                  comp.action = 'running';
                }
              }
            }

            // Validação real de colisão do bot contra os obstáculos da pista
            for (const obs of s.obstacles) {
              if (bot.hitObstacleIds.has(obs.id)) continue;
              const botHit = checkCompetitorObstacleCollision(comp, compScreenY, obs, s.speed);
              if (botHit.hit) {
                bot.hitObstacleIds.add(obs.id);
                bot.stumbleTimer = 1.1;
                comp.stumbling = true;
                comp.action = 'stumbling';

                pushFloatingText(s.floatingTexts, {
                  id: Date.now() + Math.random(),
                  text: `⚠️ ${comp.name.split(' ')[0]} ${tRef.current.canvas.botStumbled}`,
                  x: comp.laneX,
                  y: compScreenY - 24,
                  color: '#fb923c',
                  alpha: 1.0,
                  life: 0,
                });

                for (let p = 0; p < 6; p++) {
                  pushParticle(s.particles, {
                    x: comp.laneX + (Math.random() - 0.5) * 18,
                    y: compScreenY + (Math.random() - 0.5) * 18,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -Math.random() * 2 - 0.5,
                    radius: Math.random() * 2.5 + 1.5,
                    color: '#f97316',
                    alpha: 0.85,
                    maxAlpha: 0.85,
                    life: 0,
                    maxLife: 16,
                    kind: 'dust',
                  });
                }
              }
            }

            // Velocidade base idêntica para todos: clima simétrico + apenas quem bate num obstáculo abranda
            let botSpeed = baseWaveSpeed * 1.5 * nextWeather.speedMultiplier;

            if (bot.stumbleTimer > 0) {
              bot.stumbleTimer = Math.max(0, bot.stumbleTimer - dt);
              comp.stumbling = true;
              comp.action = comp.jumpY > 0 ? 'jumping' : comp.action === 'sliding' ? 'sliding' : 'stumbling';
              const botRecovery = 1 - Math.min(1, bot.stumbleTimer / 1.1);
              botSpeed *= 0.45 + 0.42 * botRecovery;
            } else {
              comp.stumbling = false;
              if (comp.action === 'stumbling') {
                comp.action = 'running';
              }
            }

            comp.progressDistance = Math.max(0, comp.progressDistance + dt * Math.max(2.6, botSpeed));
          }
        }

        // Rastro sutil na base dos competidores rivais visíveis na pista
        s.compTrailAcc += dt * 8 * speedNorm;
        if (s.compTrailAcc >= 1) {
          s.compTrailAcc -= 1;
          for (const comp of s.competitorsList) {
            if (comp.isPlayer || comp.stumbling || (comp.jumpY || 0) >= 8) continue;
            const distDelta = comp.progressDistance - s.playerDistance;
            const compScreenY = computeCompetitorScreenY(distDelta);
            if (compScreenY < -30 || compScreenY > CANV_HEIGHT + 20) continue;
            const safeX = Math.max(
              TRACK_MIN_CENTER_X - 8,
              Math.min(TRACK_MAX_CENTER_X + 8, comp.laneX || LANE_CENTERS[comp.lane])
            );
            pushParticle(s.particles, {
              x: safeX + (Math.random() - 0.5) * 7,
              y: compScreenY + PLAYER_HEIGHT * 0.38,
              vx: (Math.random() - 0.5) * 0.16,
              vy: Math.max(1.8, s.speed * 0.42),
              radius: 1.1 + Math.random() * 0.6,
              color: comp.color || '#38bdf8',
              alpha: 0.24,
              maxAlpha: 0.24,
              life: 0,
              maxLife: 9,
              kind: 'trail',
            });
          }
        }

        // Câmara Fantasma (Ghost Observer) segue suavemente o corredor alvo ou o líder
        if (spectatingNow && s.competitorsList.length > 0) {
          const requestedId = spectatedRunnerIdRef.current;
          let followedComp = requestedId
            ? s.competitorsList.find((c) => c.id === requestedId)
            : undefined;
          if (!followedComp) {
            followedComp = [...s.competitorsList].sort(
              (a, b) => b.progressDistance - a.progressDistance
            )[0];
          }
          s.followedRunnerId = followedComp?.id ?? null;
          if (followedComp) {
            const distDiff = followedComp.progressDistance - s.playerDistance;
            if (Math.abs(distDiff) > 120 || s.playerDistance === 0) {
              s.playerDistance = Math.max(0, followedComp.progressDistance);
            } else {
              const distLerp = 1 - Math.exp(-10 * dt);
              s.playerDistance = Math.max(0, s.playerDistance + distDiff * distLerp);
            }
            const followLane = clampLaneIndex(followedComp.targetLane ?? followedComp.lane);
            const followX =
              typeof followedComp.laneX === 'number' && Number.isFinite(followedComp.laneX)
                ? followedComp.laneX
                : LANE_CENTERS[followLane];
            const xLerp = 1 - Math.exp(-12 * dt);
            s.player.laneX = Number.isFinite(s.player.laneX)
              ? s.player.laneX + (followX - s.player.laneX) * xLerp
              : followX;
            s.player.lane = clampLaneIndex(followedComp.lane);
            s.player.targetLane = followLane;
            s.playerLeanAngle = 0;
            s.player.jumpY = 0;
            s.player.slideProgress = 0;
            s.player.dashTimer = 0;
            s.player.nitroTimer = 0;
            s.player.hatImmunityTimer = 0;
            s.player.stumbleTimer = 0;
            s.speed = Math.max(
              2.6,
              baseWaveSpeed *
                (followedComp.stumbling ? 0.65 : followedComp.action === 'dashing' ? 1.45 : 1.0)
            );
          }
        } else {
          s.followedRunnerId = null;
        }

        // Determina a posição instantânea em tempo real do jogador (1º ao 5º lugar) e quantos está à frente
        const sortedRanks = [...s.competitorsList].sort((a, b) => {
          const diff = b.progressDistance - a.progressDistance;
          if (Math.abs(diff) > 0.0001) return diff;
          if (a.isPlayer && !b.isPlayer) return -1;
          if (!a.isPlayer && b.isPlayer) return 1;
          return a.lane - b.lane;
        });
        const trackedRankIdx = spectatingNow
          ? sortedRanks.findIndex((c) => c.id === s.followedRunnerId)
          : sortedRanks.findIndex((c) => c.isPlayer);
        const currentRank = Math.max(
          1,
          Math.min(Math.max(1, s.competitorsList.length), trackedRankIdx >= 0 ? trackedRankIdx + 1 : 1)
        );
        const refDistance = spectatingNow
          ? s.competitorsList.find((c) => c.id === s.followedRunnerId)?.progressDistance ?? s.playerDistance
          : s.playerDistance;
        const behindCount = s.competitorsList.filter(
          (c) => (spectatingNow ? c.id !== s.followedRunnerId : !c.isPlayer) && refDistance > c.progressDistance + 0.0001
        ).length;

        s.playerLiveRank = currentRank;
        s.playerBehindCount = behindCount;

        if (currentRank !== lastRankRef.current || behindCount !== lastBehindRef.current) {
          lastRankRef.current = currentRank;
          lastBehindRef.current = behindCount;
          setLiveRank(currentRank);
          setAheadOfCount(behindCount);
          if (!spectatingNow && onRankUpdateRef.current) onRankUpdateRef.current(currentRank);
        }

        // Fim dos 40 segundos exatos: Coroação no Trono Real!
        // Nota crítica: nunca fazer `return` aqui, senão `requestAnimationFrame(loop)` para e congela as partidas seguintes!
        if (s.elapsedSeconds >= TOTAL_GAME_TIME_SECONDS) {
          s.elapsedSeconds = TOTAL_GAME_TIME_SECONDS;
          s.status = 'completed';
          enforcePlayerLaneBoundary(s.player);
          if (!raceFinishedRef.current) {
            raceFinishedRef.current = true;
            if (!spectatingNow) {
              for (const comp of s.competitorsList) {
                if (comp.isPlayer) {
                  comp.finished = true;
                  if (onLocalRaceTelemetryRef.current) {
                    onLocalRaceTelemetryRef.current({
                      progressDistance: comp.progressDistance,
                      lane: comp.lane,
                      targetLane: comp.targetLane,
                      laneX: comp.laneX,
                      action: comp.action,
                      jumpY: comp.jumpY,
                      stumbling: Boolean(comp.stumbling),
                      finished: true,
                    });
                  }
                }
              }
              sounds.playCoronationFanfare();
              onFinishRef.current(s.competitorsList, buildPerformanceSnapshot());
            } else {
              onFinishRef.current(s.competitorsList);
            }
          }
        } else {

        // Reforça a verificação de limites (Boundary Check) ao final do frame
        enforcePlayerLaneBoundary(s.player);

        // Gravidade parabólica do pulo normalizada a 60Hz
        if (s.player.jumpY > 0 || s.player.jumpVelocity !== 0) {
          s.player.jumpY += s.player.jumpVelocity * dtScale;
          s.player.jumpVelocity -= GRAVITY * dtScale;
          if (s.player.jumpY <= 0) {
            s.player.jumpY = 0;
            s.player.jumpVelocity = 0;
            if (s.player.action === 'jumping') {
              s.player.action = 'running';
            }
          }
        }

        // Agachamento
        if (s.player.slideProgress > 0) {
          s.player.slideProgress -= (dt * 1000) / SLIDE_DURATION_MS;
          if (s.player.slideProgress <= 0) {
            s.player.slideProgress = 0;
            if (s.player.action === 'sliding') {
              s.player.action = 'running';
            }
          }
        }

        // =========================================================================
        // Geração Lógica e Densa de Obstáculos e Moedas (Desviar mais rápido define o vencedor!)
        // =========================================================================
        s.distanceSinceLastSpawn += frameSpeed;

        // Verifica a distância vertical do obstáculo ativo mais alto na pista
        const highestActiveObsY = s.obstacles.reduce(
          (minY, obs) => (obs.passed ? minY : Math.min(minY, obs.y)),
          9999
        );
        const hasAdequateSafetyHeadroom = highestActiveObsY > -240 + MIN_OBSTACLE_VERTICAL_GAP;

        if (
          s.elapsedSeconds >= INITIAL_SAFETY_RUNWAY_SECONDS &&
          s.distanceSinceLastSpawn >= s.nextSpawnDistance &&
          hasAdequateSafetyHeadroom
        ) {
          const rng = waveRngRef.current;
          s.distanceSinceLastSpawn = 0;
          s.nextSpawnDistance =
            currentWave.minWaveSpacing +
            rng() * (currentWave.maxWaveSpacing - currentWave.minWaveSpacing);

          const newWave = spawnCuratedLuandaWave(
            s.obstacleIdCounter,
            s.coinIdCounter,
            -240,
            isHard,
            rng
          );
          s.obstacleIdCounter += newWave.obstacles.length;
          s.coinIdCounter += newWave.coins.length;
          s.obstacles.push(...newWave.obstacles);
          s.coins.push(...newWave.coins);
        } else if (s.elapsedSeconds < INITIAL_SAFETY_RUNWAY_SECONDS && s.distanceSinceLastSpawn >= 140) {
          // Arranque rápido com moedas guia iniciais
          const rng = waveRngRef.current;
          s.distanceSinceLastSpawn = 0;
          const openLane = (Math.floor(rng() * 3) + 1) as Lane;
          s.coins.push({
            id: ++s.coinIdCounter,
            lane: openLane,
            y: -100,
            value: 50,
            collected: false,
          });
        }

        // Validação de colisão de obstáculos (sem morte, abrandamento suave sem teleporte brusco)
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const obs = s.obstacles[i];
          obs.y += frameSpeed;

          const perf = perfRef.current;
          const isJumpableObs =
            obs.type !== 'barrier' && obs.obstacleId !== 'candongueiro-parado';
          if (
            !obs.passed &&
            obs.y > 140 &&
            obs.y < PLAYER_BASE_Y - 12 &&
            (obs.lane === s.player.targetLane || obs.lane === s.player.lane) &&
            !perf.threatStartMap.has(obs.id)
          ) {
            perf.threatStartMap.set(obs.id, nowPerf);
          }

          const res = spectatingNow
            ? { hit: false, evaded: false }
            : checkObstacleCollision(s.player, obs, s.speed);
          if (res.hit && !obs.passed) {
            obs.passed = true;
            if (!perf.countedObsIds.has(obs.id)) {
              perf.countedObsIds.add(obs.id);
              perf.hitCount += 1;
              if (isJumpableObs) perf.jumpableFaced += 1;
            }
            s.player.stumbleTimer = 1.1;
            s.player.action = 'stumbling';
            s.player.dashTimer = 0;
            sounds.playStumble();
            try {
              if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate([32, 20, 32]);
              }
            } catch {
              // Haptics unavailable on host device
            }

            pushFloatingText(s.floatingTexts, {
              id: Date.now() + Math.random(),
              text: tRef.current.canvas.hitSlowedAlert,
              x: s.player.laneX,
              y: PLAYER_BASE_Y - 24,
              color: '#ef4444',
              alpha: 1.0,
              life: 0,
            });

            for (let hp = 0; hp < 10; hp++) {
              pushParticle(s.particles, {
                x: s.player.laneX + (Math.random() - 0.5) * 24,
                y: PLAYER_BASE_Y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 5,
                vy: -Math.random() * 3 - 1,
                radius: Math.random() * 3 + 2,
                color: hp % 2 === 0 ? '#ef4444' : '#f59e0b',
                alpha: 0.9,
                maxAlpha: 0.9,
                life: 0,
                maxLife: 20,
                kind: 'dust',
              });
            }
          } else if (res.evaded && !obs.passed) {
            obs.passed = true;
            if (!perf.countedObsIds.has(obs.id)) {
              perf.countedObsIds.add(obs.id);
              perf.evadedCount += 1;
              if (isJumpableObs) {
                perf.jumpableFaced += 1;
                perf.jumpableCleared += 1;
              }
            }
          } else if (!obs.passed && obs.y > PLAYER_BASE_Y + PLAYER_HEIGHT * 0.85) {
            obs.passed = true;
            if (!spectatingNow && perf.threatStartMap.has(obs.id) && !perf.countedObsIds.has(obs.id)) {
              perf.countedObsIds.add(obs.id);
              perf.evadedCount += 1;
              if (isJumpableObs) {
                perf.jumpableFaced += 1;
                perf.jumpableCleared += 1;
              }
            }
          }

          if (obs.y > CANV_HEIGHT + 80) {
            s.obstacles.splice(i, 1);
          }
        }

        // Coleta e movimentação de Moedas Douradas (Kwanza)
        for (let cIdx = s.coins.length - 1; cIdx >= 0; cIdx--) {
          const coin = s.coins[cIdx];
          coin.y += frameSpeed;

          if (!spectatingNow && checkCoinPickup(s.player, coin)) {
            coin.collected = true;
            onCoinCollectedRef.current(coin.value);
            sounds.playCoin();
            emitMotionBurst('coin', LANE_CENTERS[coin.lane], coin.y, {
              value: coin.value,
            });

            for (let cp = 0; cp < 4; cp++) {
              pushParticle(s.particles, {
                x: LANE_CENTERS[coin.lane] + (Math.random() - 0.5) * 12,
                y: coin.y + (Math.random() - 0.5) * 12,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 2.5 - 1,
                radius: Math.random() * 2.5 + 1.5,
                color: '#fde047',
                alpha: 0.9,
                maxAlpha: 0.9,
                life: 0,
                maxLife: 15,
                kind: 'dust',
              });
            }
          }

          if (coin.y > CANV_HEIGHT + 40 || coin.collected) {
            s.coins.splice(cIdx, 1);
          }
        }

        // Coleta de Power-Ups de Habilidade
        for (let pIdx = s.powerUps.length - 1; pIdx >= 0; pIdx--) {
          const pUp = s.powerUps[pIdx];
          pUp.y += frameSpeed;

          if (!spectatingNow && checkPowerUpPickup(s.player, pUp)) {
            pUp.collected = true;

            if (pUp.type === 'kikuuba-nitro') {
              s.player.nitroTimer = 3.0;
              sounds.playNitro();
              sounds.playSprintBurst();
              setActivePowerUpNotice(tRef.current.canvas.nitroNotice);
            } else if (pUp.type === 'chapeu-kudurista') {
              s.player.hatImmunityTimer = 3.0;
              sounds.playHatImmunity();
              setActivePowerUpNotice(tRef.current.canvas.hatNotice);
            } else if (pUp.type === 'gasosa') {
              s.playerDistance += 20;
              sounds.playGasosa();
              sounds.playSprintBurst();
              setActivePowerUpNotice(tRef.current.canvas.gasosaNotice);
            }

            if (powerUpNoticeTimerRef.current) {
              clearTimeout(powerUpNoticeTimerRef.current);
            }
            powerUpNoticeTimerRef.current = setTimeout(() => {
              powerUpNoticeTimerRef.current = null;
              setActivePowerUpNotice(null);
            }, 2500);

            const localizedPu = getLocalizedPowerUp(pUp.type, langRef.current);
            pushFloatingText(s.floatingTexts, {
              id: Date.now() + Math.random(),
              text: `+ ${localizedPu.name}!`,
              x: LANE_CENTERS[pUp.lane],
              y: pUp.y,
              color: '#10b981',
              alpha: 1.0,
              life: 0,
            });
          }

          if (pUp.y > CANV_HEIGHT + 60 || pUp.collected) {
            s.powerUps.splice(pIdx, 1);
          }
        }
        } // Fecha o bloco `else` de física ativa (mantendo render + rAF ativos após `completed`)
      }

      // Atualiza textos flutuantes (normalizado a 60Hz)
      for (let tIdx = s.floatingTexts.length - 1; tIdx >= 0; tIdx--) {
        const ft = s.floatingTexts[tIdx];
        ft.y -= 1.2 * dtScale;
        ft.life += dtScale;
        ft.alpha = Math.max(0, 1 - ft.life / 35);
        if (ft.life >= 35) s.floatingTexts.splice(tIdx, 1);
      }

      // Atualiza partículas (normalizado a 60Hz)
      for (let pt = s.particles.length - 1; pt >= 0; pt--) {
        const p = s.particles[pt];
        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;
        p.life += dtScale;
        p.alpha = Math.max(0, p.maxAlpha * (1 - p.life / p.maxLife));
        if (p.life >= p.maxLife) s.particles.splice(pt, 1);
      }

      // ==========================================
      // RENDERIZAÇÃO 2D (CANVAS 60 FPS REALISMO LUANDA MARGINAL)
      // ==========================================
      if (canvas && viewMode === '2d') {
        enforcePlayerLaneBoundary(s.player);
        for (const comp of s.competitorsList) {
          enforceCompetitorLaneBoundary(comp);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const isNight = timeMode === 'night';
          const isHard = s.elapsedSeconds >= HARD_MODE_START_SECONDS;

          if (!cachedDaySkyGrad) {
            cachedDaySkyGrad = ctx.createLinearGradient(0, 0, 0, 140);
            cachedDaySkyGrad.addColorStop(0, '#0284c7');
            cachedDaySkyGrad.addColorStop(0.55, '#38bdf8');
            cachedDaySkyGrad.addColorStop(1, '#bae6fd');

            cachedNightSkyGrad = ctx.createLinearGradient(0, 0, 0, 140);
            cachedNightSkyGrad.addColorStop(0, '#020617');
            cachedNightSkyGrad.addColorStop(0.6, '#0b132b');
            cachedNightSkyGrad.addColorStop(1, '#1e293b');

            cachedDaySeaGrad = ctx.createLinearGradient(0, 68, 0, 138);
            cachedDaySeaGrad.addColorStop(0, '#0369a1');
            cachedDaySeaGrad.addColorStop(1, '#0284c7');

            cachedNightSeaGrad = ctx.createLinearGradient(0, 68, 0, 138);
            cachedNightSeaGrad.addColorStop(0, '#021526');
            cachedNightSeaGrad.addColorStop(1, '#062c49');
          }

          ctx.save();
          const activeWeather = s.status === 'running' ? s.weather : createDefaultWeatherState();
          const totalCamShake =
            s.status === 'running'
              ? Math.min(1.0, activeWeather.shakeIntensity + (s.player.stumbleTimer > 0 ? 0.35 : 0))
              : 0;
          if (totalCamShake > 0.01) {
            const shakeSec = currentTime * 0.001;
            const shakeX =
              (Math.sin(shakeSec * 34.0) * 0.65 + Math.cos(shakeSec * 51.0) * 0.35) *
              3.4 *
              totalCamShake;
            const shakeY =
              (Math.cos(shakeSec * 41.0) * 0.6 + Math.sin(shakeSec * 57.0) * 0.4) *
              2.6 *
              totalCamShake;
            ctx.translate(shakeX, shakeY);
          }

          // 1. Céu & Baía de Luanda no Horizonte (margem extra para suportar vibração da câmera sem bordas)
          ctx.fillStyle = (isNight ? cachedNightSkyGrad : cachedDaySkyGrad)!;
          ctx.fillRect(-10, -10, CANV_WIDTH + 20, CANV_HEIGHT + 20);

          // Sol Dourado / Lua Cheia com Halo Atmosférico
          const orbX = isNight ? CANV_WIDTH - 68 : 74;
          const orbY = 34;
          const orbGlow = ctx.createRadialGradient(orbX, orbY, 4, orbX, orbY, 56);
          if (isNight) {
            orbGlow.addColorStop(0, 'rgba(224, 242, 254, 0.95)');
            orbGlow.addColorStop(0.25, 'rgba(125, 211, 252, 0.35)');
            orbGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
          } else {
            orbGlow.addColorStop(0, 'rgba(254, 240, 138, 1)');
            orbGlow.addColorStop(0.3, 'rgba(251, 191, 36, 0.4)');
            orbGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
          }
          ctx.fillStyle = orbGlow;
          ctx.beginPath();
          ctx.arc(orbX, orbY, 56, 0, Math.PI * 2);
          ctx.fill();

          // Estrelas sutis no modo noite
          if (isNight) {
            ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
            const stars = [
              [38, 16], [92, 26], [156, 12], [220, 24], [308, 14], [380, 22], [472, 16],
            ];
            for (let si = 0; si < stars.length; si++) {
              ctx.fillRect(stars[si][0], stars[si][1], 1.5, 1.5);
            }
          }

          // Skyline estilizado da Marginal de Luanda
          ctx.fillStyle = isNight ? '#070c18' : '#0f3654';
          const buildings = [
            [12, 34, 26, 38], [40, 44, 22, 28], [64, 28, 30, 44], [98, 46, 20, 26],
            [404, 42, 24, 30], [430, 30, 28, 42], [462, 38, 22, 34], [488, 48, 20, 24],
          ];
          for (let bi = 0; bi < buildings.length; bi++) {
            const [bx, by, bw, bh] = buildings[bi];
            ctx.fillRect(bx, by, bw, bh);
            if (isNight) {
              ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
              for (let wy = by + 5; wy < by + bh - 6; wy += 7) {
                for (let wx = bx + 4; wx < bx + bw - 5; wx += 6) {
                  if ((wx + wy) % 3 !== 0) ctx.fillRect(wx, wy, 2.5, 3);
                }
              }
              ctx.fillStyle = '#070c18';
            }
          }

          // Baía de Luanda (Oceano Atlântico lateral e horizonte)
          ctx.fillStyle = (isNight ? cachedNightSeaGrad : cachedDaySeaGrad)!;
          ctx.fillRect(0, 72, CANV_WIDTH, CANV_HEIGHT - 72);

          // Brilho da água / Ondulação na Baía
          ctx.fillStyle = isNight ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.28)';
          for (let w = 0; w < 6; w++) {
            const waveY = 82 + w * 9;
            const waveOffset = Math.sin(s.playerDistance * 0.05 + w) * 14;
            ctx.fillRect(36 + waveOffset, waveY, CANV_WIDTH - 72, 1.8);
          }

          // Calçadão Português / Passeios Laterais da Marginal
          const leftWalkWidth = TRACK_LEFT;
          const rightWalkLeft = TRACK_LEFT + TRACK_WIDTH;
          const rightWalkWidth = CANV_WIDTH - rightWalkLeft;

          const walkGradL = ctx.createLinearGradient(0, 0, leftWalkWidth, 0);
          walkGradL.addColorStop(0, isNight ? '#060a14' : '#1e293b');
          walkGradL.addColorStop(1, isNight ? '#151c2c' : '#334155');
          ctx.fillStyle = walkGradL;
          ctx.fillRect(0, 72, leftWalkWidth, CANV_HEIGHT - 72);

          const walkGradR = ctx.createLinearGradient(rightWalkLeft, 0, CANV_WIDTH, 0);
          walkGradR.addColorStop(0, isNight ? '#151c2c' : '#334155');
          walkGradR.addColorStop(1, isNight ? '#060a14' : '#1e293b');
          ctx.fillStyle = walkGradR;
          ctx.fillRect(rightWalkLeft, 72, rightWalkWidth, CANV_HEIGHT - 72);

          // Padrão de calçada em movimento nos passeios
          const tileStep = 44;
          const tileShift = s.curbOffset % tileStep;
          ctx.strokeStyle = isNight ? 'rgba(148, 163, 184, 0.08)' : 'rgba(226, 232, 240, 0.14)';
          ctx.lineWidth = 1;
          for (let ty = -tileStep; ty < CANV_HEIGHT + tileStep; ty += tileStep) {
            const drawTy = ty + tileShift;
            ctx.beginPath();
            ctx.moveTo(0, drawTy);
            ctx.lineTo(TRACK_LEFT - 6, drawTy);
            ctx.moveTo(rightWalkLeft + 6, drawTy);
            ctx.lineTo(CANV_WIDTH, drawTy);
            ctx.stroke();
          }

          // Palmeiras Realistas da Marginal com Troncos Curvos & 6 Frondas Arqueadas + Balanço ao Vento
          const palmSwayPx =
            activeWeather.kind === 'wind-gust'
              ? activeWeather.windDirection *
                (3.2 + 4.4 * activeWeather.gustPulse) *
                activeWeather.intensity
              : activeWeather.kind === 'light-rain'
              ? activeWeather.windDirection * 1.6 * activeWeather.intensity
              : 0;
          const drawMarginalPalm = (px: number, py: number, flip: number) => {
            // Sombra no passeio
            ctx.fillStyle = 'rgba(0,0,0,0.34)';
            ctx.beginPath();
            ctx.ellipse(px + flip * 3, py + 22, 10, 3.6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Tronco segmentado curvo
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 4.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(px, py + 22);
            ctx.quadraticCurveTo(
              px + flip * 3 + palmSwayPx * 0.45,
              py + 9,
              px + flip * 2 + palmSwayPx,
              py - 5
            );
            ctx.stroke();

            // Copa com 6 frondas arqueadas
            const crownX = px + flip * 2 + palmSwayPx;
            const crownY = py - 5;
            const frondColor = isNight ? '#065f46' : '#15803d';
            const frondHighlight = isNight ? '#10b981' : '#22c55e';
            const frondAngles = [-2.55, -1.95, -1.15, -0.45, 0.35, 1.05];
            for (let fi = 0; fi < frondAngles.length; fi++) {
              const ang = frondAngles[fi];
              const tipX = crownX + Math.cos(ang) * 15;
              const tipY = crownY + Math.sin(ang) * 10 + 4;
              ctx.strokeStyle = fi % 2 === 0 ? frondColor : frondHighlight;
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.moveTo(crownX, crownY);
              ctx.quadraticCurveTo(
                (crownX + tipX) * 0.5,
                Math.min(crownY, tipY) - 4,
                tipX,
                tipY
              );
              ctx.stroke();
            }

            // Cocos dourados na base da copa
            ctx.fillStyle = '#92400e';
            ctx.beginPath();
            ctx.arc(crownX - 1.5, crownY + 1.5, 1.8, 0, Math.PI * 2);
            ctx.arc(crownX + 1.8, crownY + 1.8, 1.8, 0, Math.PI * 2);
            ctx.fill();
          };

          const palmSpacing = 160;
          const palmOffset = s.palmOffset;
          for (let py = -palmSpacing; py < CANV_HEIGHT + palmSpacing; py += palmSpacing) {
            const currentPalmY = py + palmOffset;
            drawMarginalPalm(TRACK_LEFT - 18, currentPalmY, -1);
            drawMarginalPalm(TRACK_LEFT + TRACK_WIDTH + 18, currentPalmY, 1);

            // Halo luminoso de poste na calçada à noite
            if (isNight) {
              const lampGlowL = ctx.createRadialGradient(TRACK_LEFT - 10, currentPalmY + 58, 1, TRACK_LEFT - 10, currentPalmY + 58, 22);
              lampGlowL.addColorStop(0, 'rgba(250, 204, 21, 0.32)');
              lampGlowL.addColorStop(1, 'rgba(250, 204, 21, 0)');
              ctx.fillStyle = lampGlowL;
              ctx.beginPath();
              ctx.arc(TRACK_LEFT - 10, currentPalmY + 58, 22, 0, Math.PI * 2);
              ctx.fill();

              const lampGlowR = ctx.createRadialGradient(TRACK_LEFT + TRACK_WIDTH + 10, currentPalmY + 58, 1, TRACK_LEFT + TRACK_WIDTH + 10, currentPalmY + 58, 22);
              lampGlowR.addColorStop(0, 'rgba(250, 204, 21, 0.32)');
              lampGlowR.addColorStop(1, 'rgba(250, 204, 21, 0)');
              ctx.fillStyle = lampGlowR;
              ctx.beginPath();
              ctx.arc(TRACK_LEFT + TRACK_WIDTH + 10, currentPalmY + 58, 22, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Asfalto Realista da Marginal (5 Faixas oficiais com gradiente de profundidade + marcas de pneu)
          const roadGrad = ctx.createLinearGradient(TRACK_LEFT, 0, TRACK_LEFT + TRACK_WIDTH, 0);
          if (isNight) {
            roadGrad.addColorStop(0, '#090e1a');
            roadGrad.addColorStop(0.5, '#111827');
            roadGrad.addColorStop(1, '#090e1a');
          } else {
            roadGrad.addColorStop(0, '#182235');
            roadGrad.addColorStop(0.5, '#26334a');
            roadGrad.addColorStop(1, '#182235');
          }
          ctx.fillStyle = roadGrad;
          ctx.fillRect(TRACK_LEFT, 0, TRACK_WIDTH, CANV_HEIGHT);
          if (activeWeather.kind === 'light-rain' && activeWeather.intensity > 0.03) {
            ctx.fillStyle = `rgba(125, 211, 252, ${(0.085 * activeWeather.intensity).toFixed(3)})`;
            ctx.fillRect(TRACK_LEFT, 0, TRACK_WIDTH, CANV_HEIGHT);
          }

          // Sulcos sutis de desgaste dos pneus em cada uma das 5 faixas + destaque da faixa do jogador
          for (let li = 0; li < 5; li++) {
            const laneCenterX = LANE_CENTERS[li];
            ctx.fillStyle = isNight ? 'rgba(2, 6, 15, 0.34)' : 'rgba(15, 23, 42, 0.24)';
            ctx.fillRect(laneCenterX - 18, 0, 8, CANV_HEIGHT);
            ctx.fillRect(laneCenterX + 10, 0, 8, CANV_HEIGHT);
          }

          // Brilho sutil na faixa alvo atual do jogador para leitura instantânea
          const targetLaneCenter = LANE_CENTERS[s.player.targetLane] ?? LANE_CENTERS[2];
          ctx.fillStyle = isHard
            ? 'rgba(244, 63, 94, 0.055)'
            : 'rgba(245, 158, 11, 0.05)';
          ctx.fillRect(targetLaneCenter - LANE_WIDTH * 0.48, 0, LANE_WIDTH * 0.96, CANV_HEIGHT);

          // Calçadão / Guia zebrada vermelha e branca com chanfro tridimensional
          const curbSegment = 28;
          const curbPeriod = curbSegment * 2;
          const curbOffset = s.curbOffset;
          for (let cy = -curbPeriod; cy < CANV_HEIGHT + curbPeriod; cy += curbPeriod) {
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(TRACK_LEFT - 7, cy + curbOffset, 7, curbSegment);
            ctx.fillRect(TRACK_LEFT + TRACK_WIDTH, cy + curbOffset, 7, curbSegment);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(TRACK_LEFT - 7, cy + curbOffset + curbSegment, 7, curbSegment);
            ctx.fillRect(TRACK_LEFT + TRACK_WIDTH, cy + curbOffset + curbSegment, 7, curbSegment);
          }
          // Linha de sombra interna nas guias
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(TRACK_LEFT, 0, 3, CANV_HEIGHT);
          ctx.fillRect(TRACK_LEFT + TRACK_WIDTH - 3, 0, 3, CANV_HEIGHT);

          // Divisórias tracejadas entre as 5 Faixas + Olhos-de-gato refletores
          ctx.strokeStyle = isNight ? 'rgba(245, 158, 11, 0.42)' : 'rgba(253, 224, 71, 0.65)';
          ctx.lineWidth = 2.4;
          ctx.setLineDash([26, 22]);
          ctx.lineDashOffset = -s.trackOffset;

          [1, 2, 3, 4].forEach((l) => {
            const divX = TRACK_LEFT + LANE_WIDTH * l;
            ctx.beginPath();
            ctx.moveTo(divX, 0);
            ctx.lineTo(divX, CANV_HEIGHT);
            ctx.stroke();
          });
          ctx.setLineDash([]);

          // Olhos-de-gato refletores âmbar ao longo das divisórias
          const studStep = 96;
          const studShift = s.trackOffset % studStep;
          ctx.fillStyle = isNight ? '#fbbf24' : '#fef08a';
          for (let sy = -studStep; sy < CANV_HEIGHT + studStep; sy += studStep) {
            const drawSy = sy + studShift;
            for (let l = 1; l <= 4; l++) {
              const divX = TRACK_LEFT + LANE_WIDTH * l;
              ctx.fillRect(divX - 1.5, drawSy, 3, 4);
            }
          }

          // Linhas de velocidade / Dash Streaks nas laterais durante aceleração
          if (s.player.dashTimer > 0 || s.player.nitroTimer > 0) {
            ctx.strokeStyle =
              s.player.nitroTimer > 0
                ? 'rgba(56, 189, 248, 0.55)'
                : 'rgba(250, 204, 21, 0.52)';
            ctx.lineWidth = 2.2;
            for (let st = 0; st < 14; st++) {
              const sx = TRACK_LEFT + Math.random() * TRACK_WIDTH;
              const sy = Math.random() * CANV_HEIGHT;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(sx, sy + 44);
              ctx.stroke();
            }
          }

          // Arco Monumental de Chegada & Trono Real nos últimos 4 segundos (36s a 40s)
          if (s.elapsedSeconds >= TOTAL_GAME_TIME_SECONDS - 4 || s.status === 'completed') {
            const finishProgress =
              s.status === 'completed'
                ? 1
                : Math.max(0, Math.min(1, (s.elapsedSeconds - (TOTAL_GAME_TIME_SECONDS - 4)) / 4));
            const dynamicFinishY = -45 + finishProgress * (PLAYER_BASE_Y - 85 - -45);
            const bannerY = Math.max(-45, Math.min(FINISH_THRONE_Y + 260, dynamicFinishY));
            ctx.save();

            // Feixe de luz real na meta
            const finishBeam = ctx.createLinearGradient(0, bannerY - 40, 0, bannerY + 40);
            finishBeam.addColorStop(0, 'rgba(245, 158, 11, 0)');
            finishBeam.addColorStop(0.5, 'rgba(245, 158, 11, 0.22)');
            finishBeam.addColorStop(1, 'rgba(245, 158, 11, 0)');
            ctx.fillStyle = finishBeam;
            ctx.fillRect(TRACK_LEFT, bannerY - 40, TRACK_WIDTH, 80);

            // Pilares dourados laterais
            ctx.fillStyle = '#b45309';
            ctx.fillRect(TRACK_LEFT - 10, bannerY - 28, 12, 48);
            ctx.fillRect(TRACK_LEFT + TRACK_WIDTH - 2, bannerY - 28, 12, 48);

            // Faixa superior da Meta Real
            const archGrad = ctx.createLinearGradient(CANV_WIDTH / 2 - 150, bannerY - 28, CANV_WIDTH / 2 + 150, bannerY + 14);
            archGrad.addColorStop(0, '#090a10');
            archGrad.addColorStop(0.5, '#1e1b18');
            archGrad.addColorStop(1, '#090a10');
            ctx.fillStyle = archGrad;
            ctx.beginPath();
            ctx.roundRect(CANV_WIDTH / 2 - 150, bannerY - 28, 300, 42, 6);
            ctx.fill();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Xadrez de chegada em toda a largura da pista
            const squareCount = 20;
            const sqW = TRACK_WIDTH / squareCount;
            for (let cb = 0; cb < squareCount; cb++) {
              ctx.fillStyle = cb % 2 === 0 ? '#ffffff' : '#09090b';
              ctx.fillRect(TRACK_LEFT + cb * sqW, bannerY + 14, sqW, 6);
              ctx.fillStyle = cb % 2 === 1 ? '#ffffff' : '#09090b';
              ctx.fillRect(TRACK_LEFT + cb * sqW, bannerY + 20, sqW, 6);
            }

            ctx.fillStyle = '#fef08a';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(tRef.current.canvas.throneBanner, CANV_WIDTH / 2, bannerY - 3);
            ctx.restore();
          }

          // 2. Renderiza Power-Ups na pista com auras pulsantes
          for (const pu of s.powerUps) {
            const px = LANE_CENTERS[pu.lane];
            const py = pu.y;
            ctx.save();

            // Glow circular
            const puGlow = ctx.createRadialGradient(px, py, 4, px, py, 26);
            puGlow.addColorStop(0, 'rgba(245, 158, 11, 0.9)');
            puGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
            ctx.fillStyle = puGlow;
            ctx.beginPath();
            ctx.arc(px, py, 26, 0, Math.PI * 2);
            ctx.fill();

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.ellipse(px, py + 16, 14, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ícone do Power-up
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icon =
              pu.type === 'kikuuba-nitro' ? '⚡' : pu.type === 'chapeu-kudurista' ? '🎩' : '⛽';
            ctx.fillText(icon, px, py - 2);

            // Nome do Item traduzido
            const localizedPu = getLocalizedPowerUp(pu.type, langRef.current);
            ctx.fillStyle = '#fef08a';
            ctx.font = 'bold 8px monospace';
            ctx.fillText(localizedPu.name.slice(0, 14).toUpperCase(), px, py + 15);
            ctx.restore();
          }

          // 2.5. Renderiza Moedas Douradas (Kwanza) com rotação e brilho
          for (const coin of s.coins) {
            if (coin.collected) continue;
            const cx = LANE_CENTERS[coin.lane];
            const cy = coin.y;
            if (cy < -30 || cy > CANV_HEIGHT + 30) continue;

            ctx.save();
            ctx.translate(cx, cy);

            const spin = Math.sin(s.playerDistance * 0.12 + coin.id * 1.5);
            const scaleX = Math.abs(spin) * 0.75 + 0.25;
            ctx.scale(scaleX, 1);

            ctx.fillStyle = 'rgba(0,0,0,0.34)';
            ctx.beginPath();
            ctx.ellipse(0, 12, 10 * scaleX, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.fill();

            const coinGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 11);
            coinGrad.addColorStop(0, '#fef08a');
            coinGrad.addColorStop(0.5, '#f59e0b');
            coinGrad.addColorStop(1, '#b45309');
            ctx.fillStyle = coinGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            if (scaleX > 0.45) {
              ctx.fillStyle = '#78350f';
              ctx.font = 'bold 9px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('★', 0, 0.5);
            }

            ctx.restore();
          }

          // 3. Renderiza os 10 Obstáculos Principais em 3D Volumétrico
          const obstacleTags = {
            jump: tRef.current.canvas.tagJump,
            slide: tRef.current.canvas.tagSlide,
            dodge: tRef.current.canvas.tagDodge,
          };
          const nowMs = currentTime;
          for (const obs of s.obstacles) {
            const ox = LANE_CENTERS[obs.lane];
            const oy = obs.y;
            if (oy < -80 || oy > CANV_HEIGHT + 80) continue;

            ctx.save();
            ctx.translate(ox, oy);
            drawVolumetricObstacle25D(ctx, obs.obstacleId, obstacleTags, nowMs);
            ctx.restore();
          }

          // 4. Renderiza os Competidores (todos visíveis em modo espectador)
          for (const comp of s.competitorsList) {
            if (!spectatingNow && comp.isPlayer) continue;

            const cx = Math.max(
              LANE_CENTERS[0],
              Math.min(LANE_CENTERS[4], comp.laneX || LANE_CENTERS[comp.lane])
            );
            const distDelta = comp.progressDistance - s.playerDistance;
            const cy = computeCompetitorScreenY(distDelta);
            const isCompSliding = comp.action === 'sliding';
            const compJump = comp.jumpY || 0;
            const drawY = cy - compJump + (isCompSliding ? 10 : 0);
            const compAirScale = 1 + Math.min(0.26, compJump / 340);
            const compShadowScale = Math.max(0.45, 1 - compJump / 220);
            const isFollowedTarget = spectatingNow && s.followedRunnerId === comp.id;

            ctx.save();
            ctx.fillStyle = `rgba(0,0,0,${(0.42 * compShadowScale).toFixed(2)})`;
            ctx.beginPath();
            ctx.ellipse(
              cx,
              cy + PLAYER_HEIGHT * 0.4,
              (isCompSliding ? 20 : 15) * compShadowScale,
              6 * compShadowScale,
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();

            if (isFollowedTarget) {
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.ellipse(cx, cy + PLAYER_HEIGHT * 0.4, 24, 9, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();

            ctx.save();
            ctx.translate(cx, drawY);
            ctx.scale(compAirScale, compAirScale);

            if (comp.stumbling) {
              ctx.rotate(Math.sin(performance.now() * 0.03) * 0.16);
            }

            const actionGlyph = comp.stumbling
              ? '⚠️'
              : comp.action === 'dashing'
              ? '⚡'
              : comp.action === 'jumping' || compJump > 8
              ? '🦘'
              : isCompSliding
              ? '⬇️'
              : '';

            if (comp.action === 'dashing') {
              ctx.save();
              ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
              ctx.lineWidth = 3;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(-7, 10);
              ctx.lineTo(-7, 28);
              ctx.moveTo(7, 10);
              ctx.lineTo(7, 28);
              ctx.stroke();
              ctx.restore();
            }

            const baseCompLabel = comp.stumbling
              ? tRef.current.canvas.botSlowLabel
              : `${isFollowedTarget ? '👻 ' : !comp.isBot ? '🟢 ' : ''}${comp.name.slice(0, 11)}${
                  actionGlyph ? ` ${actionGlyph}` : ''
                }`;

            drawCanvasRunnerAvatar({
              ctx,
              avatarId: comp.avatarId,
              name: comp.name,
              color: comp.color,
              isPlayer: false,
              isBot: Boolean(comp.isBot),
              isSliding: isCompSliding,
              isAirborne: compJump > 8,
              strideCycle: comp.progressDistance * 0.45,
              stumbling: Boolean(comp.stumbling),
              labelText: baseCompLabel,
              scale: isFollowedTarget ? 1.0 : 0.9,
            });

            ctx.restore();
          }

          // Atualiza barra compacta de corredores & apostas ao vivo (~8Hz durante a corrida)
          if (currentTime - lastHudRunnersEmitRef.current >= 120) {
            lastHudRunnersEmitRef.current = currentTime;
            const snapshot = s.competitorsList.map((c) => ({ ...c }));
            setLiveHudRunners(snapshot);
            if (spectatingNow && onCompetitorsProgressRef.current) {
              onCompetitorsProgressRef.current(snapshot);
            }
          }

          // 5. Renderiza o Jogador com o Avatar/Roupa selecionada (ou emblema Fantasma em modo espectador)
          if (spectatingNow) {
            ctx.save();
            ctx.fillStyle = 'rgba(8, 47, 73, 0.85)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(CANV_WIDTH / 2 - 58, PLAYER_BASE_Y + 40, 116, 24, 12);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#bae6fd';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👻 GHOST', CANV_WIDTH / 2, PLAYER_BASE_Y + 52);
            ctx.restore();
          } else {
            const p = s.player;
            const playerComp = s.competitorsList.find((c) => c.isPlayer);
            const px = p.laneX;
            const jumpHeight = p.jumpY || 0;
            const py = PLAYER_BASE_Y - jumpHeight;
            const isSliding = p.slideProgress > 0.05;
            const strideCycle = s.playerDistance * 0.45;
            const airScale = 1 + Math.min(0.28, jumpHeight / 340);
            const shadowScale = Math.max(0.45, 1 - jumpHeight / 220);

            ctx.save();
            ctx.fillStyle = `rgba(0,0,0,${(0.52 * shadowScale).toFixed(2)})`;
            ctx.beginPath();
            ctx.ellipse(
              px,
              PLAYER_BASE_Y + PLAYER_HEIGHT * 0.42,
              (isSliding ? 24 : 18) * shadowScale,
              7 * shadowScale,
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.translate(px, py);
            ctx.scale(airScale, airScale);

            const stumbleTilt = p.stumbleTimer > 0 ? Math.sin(p.stumbleTimer * 40) * 0.15 : 0;
            ctx.rotate((s.playerLeanAngle || 0) + stumbleTilt);

            const rawPlayerName = playerComp?.name || `REI ZERO ${tRef.current.youTag}`;
            const playerLabel =
              p.stumbleTimer > 0
                ? tRef.current.canvas.playerHitLabel
                : rawPlayerName.slice(0, 16);

            drawCanvasRunnerAvatar({
              ctx,
              avatarId: playerComp?.avatarId || 'rei-zero',
              name: playerComp?.name || 'REI ZERO',
              color: playerComp?.color || '#f59e0b',
              isPlayer: true,
              isBot: false,
              isSliding,
              isAirborne: jumpHeight > 8,
              strideCycle,
              stumbling: p.stumbleTimer > 0,
              hatImmunity: p.hatImmunityTimer > 0,
              labelText: playerLabel,
              scale: 1,
            });

            ctx.restore();
          }

          // 6. Partículas de Rastro na Base & Poeira
          if (s.particles.length > 0) {
            ctx.save();
            for (let pi = 0; pi < s.particles.length; pi++) {
              const pt = s.particles[pi];
              if (pt.alpha <= 0.02) continue;
              ctx.globalAlpha = pt.alpha;
              if (pt.kind === 'trail') {
                const streakLen = pt.radius * 3.4;
                ctx.strokeStyle = pt.color;
                ctx.lineWidth = pt.radius * 1.35;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(pt.x - pt.vx * 1.5, pt.y + streakLen);
                ctx.stroke();
              } else {
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.restore();
          }

          // 7. Textos Flutuantes
          if (s.floatingTexts.length > 0) {
            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            for (let fi = 0; fi < s.floatingTexts.length; fi++) {
              const ft = s.floatingTexts[fi];
              ctx.globalAlpha = ft.alpha;
              ctx.strokeText(ft.text, ft.x, ft.y);
              ctx.fillStyle = ft.color;
              ctx.fillText(ft.text, ft.x, ft.y);
            }
            ctx.restore();
          }

          // 7b. Efeito Climático 2D (Gotas de Chuva Leve / Rajadas de Vento na Marginal)
          if (s.status === 'running' && activeWeather.intensity > 0.03 && activeWeather.kind !== 'clear') {
            ctx.save();
            const weatherT = currentTime * 0.001;
            const wInt = activeWeather.intensity;
            const windDir = activeWeather.windDirection;
            if (activeWeather.kind === 'light-rain') {
              ctx.strokeStyle = `rgba(186, 230, 253, ${(0.42 * wInt).toFixed(2)})`;
              ctx.lineWidth = 1.25;
              ctx.lineCap = 'round';
              ctx.beginPath();
              for (let ri = 0; ri < 46; ri++) {
                const rxBase = ((ri * 89 + weatherT * windDir * 190) % (CANV_WIDTH + 60) + (CANV_WIDTH + 60)) % (CANV_WIDTH + 60) - 30;
                const ryBase = ((ri * 137 + weatherT * 760) % (CANV_HEIGHT + 40)) - 20;
                ctx.moveTo(rxBase, ryBase);
                ctx.lineTo(rxBase + windDir * 5.5, ryBase + 16);
              }
              ctx.stroke();
            } else {
              ctx.strokeStyle = `rgba(226, 232, 240, ${((0.18 + 0.22 * activeWeather.gustPulse) * wInt).toFixed(2)})`;
              ctx.lineWidth = 1.4;
              ctx.lineCap = 'round';
              ctx.beginPath();
              const windVx = windDir * (540 + 260 * activeWeather.gustPulse);
              for (let wi = 0; wi < 20; wi++) {
                const wxBase = ((wi * 127 + weatherT * windVx) % (CANV_WIDTH + 120) + (CANV_WIDTH + 120)) % (CANV_WIDTH + 120) - 60;
                const wyBase = ((wi * 193 + weatherT * 110) % (CANV_HEIGHT - 80)) + 72;
                const streakLen = 26 + (wi % 4) * 9;
                ctx.moveTo(wxBase, wyBase);
                ctx.lineTo(wxBase + windDir * streakLen, wyBase + 4);
              }
              ctx.stroke();
            }
            ctx.restore();
          }

          ctx.restore();

          // ==========================================
          // 8. HUD TELEMETRIA GAME-STYLE SOBRE O CANVAS
          // ==========================================
          const currentKmh = Math.max(18, Math.round((s.speed / 6.8) * 72));
          const cTrans = tRef.current.canvas;

          ctx.save();
          ctx.fillStyle = 'rgba(6, 9, 18, 0.9)';
          ctx.beginPath();
          ctx.roundRect(10, 14, 138, 46, 8);
          ctx.fill();
          ctx.strokeStyle = s.player.stumbleTimer > 0 ? '#ef4444' : isHard ? '#f43f5e' : '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = s.player.stumbleTimer > 0 ? '#fca5a5' : isHard ? '#fb7185' : '#facc15';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            s.player.stumbleTimer > 0 ? `🐢 ${currentKmh} KM/H` : `⚡ ${currentKmh} KM/H`,
            18,
            33
          );

          ctx.fillStyle = s.player.stumbleTimer > 0 ? '#f87171' : '#94a3b8';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(
            s.player.stumbleTimer > 0
              ? cTrans.slowedHud
              : isHard
              ? cTrans.kingBpmHud
              : cTrans.margBpmHud,
            18,
            48
          );

          const pRank = s.playerLiveRank || 1;
          const totalRivalsCount = Math.max(1, s.competitorsList.length - 1);
          const behindTxt = `${cTrans.aheadOfPrefix} ${s.playerBehindCount || 0}/${totalRivalsCount}`;
          const followedSpectatorTarget = s.isSpectating
            ? s.competitorsList.find((c) => c.id === s.followedRunnerId) || s.competitorsList[0]
            : null;
          const rankColors = s.isSpectating
            ? {
                bg: 'rgba(8, 51, 68, 0.94)',
                border: '#22d3ee',
                text: '#cffafe',
                sub: '#67e8f9',
                title: '👻 GHOST',
                tag: followedSpectatorTarget
                  ? followedSpectatorTarget.name.replace(/\s*\(.*?\)\s*$/, '').slice(0, 18)
                  : 'LIVE',
              }
            : {
                1: { bg: 'rgba(245, 158, 11, 0.96)', border: '#fef08a', text: '#090a10', sub: '#451a03', title: `👑 1 ${cTrans.placeLabel}`, tag: behindTxt },
                2: { bg: 'rgba(14, 165, 233, 0.94)', border: '#7dd3fc', text: '#082f49', sub: '#0369a1', title: `🥈 2 ${cTrans.placeLabel}`, tag: behindTxt },
                3: { bg: 'rgba(249, 115, 22, 0.94)', border: '#fed7aa', text: '#431407', sub: '#9a3412', title: `🥉 3 ${cTrans.placeLabel}`, tag: behindTxt },
                4: { bg: 'rgba(24, 24, 27, 0.94)', border: '#71717a', text: '#f4f4f5', sub: '#a1a1aa', title: `⚡ 4 ${cTrans.placeLabel}`, tag: behindTxt },
                5: { bg: 'rgba(225, 29, 72, 0.94)', border: '#fda4af', text: '#ffffff', sub: '#ffe4e6', title: `⚠️ 5 ${cTrans.placeLabel}`, tag: behindTxt },
              }[pRank as 1 | 2 | 3 | 4 | 5] || {
                bg: 'rgba(24, 24, 27, 0.94)', border: '#71717a', text: '#f4f4f5', sub: '#a1a1aa', title: `${pRank} ${cTrans.placeLabel}`, tag: behindTxt
              };

          ctx.fillStyle = rankColors.bg;
          ctx.beginPath();
          ctx.roundRect(CANV_WIDTH / 2 - 84, 14, 168, 46, 8);
          ctx.fill();
          ctx.strokeStyle = rankColors.border;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = rankColors.text;
          ctx.font = '900 13px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(rankColors.title, CANV_WIDTH / 2, 33);

          ctx.fillStyle = rankColors.sub;
          ctx.font = 'bold 8px monospace';
          ctx.fillText(rankColors.tag, CANV_WIDTH / 2, 48);

          ctx.fillStyle = 'rgba(6, 9, 18, 0.9)';
          ctx.beginPath();
          ctx.roundRect(CANV_WIDTH - 148, 14, 138, 46, 8);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${cTrans.laneLabel} ${s.player.targetLane + 1}/5`, CANV_WIDTH - 18, 33);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`${cTrans.distLabel}: ${Math.round(s.playerDistance)}m`, CANV_WIDTH - 18, 48);
          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [viewMode, timeMode, syncDashUi, buildPerformanceSnapshot]);

  return (
    <div id="race-track-canvas" className="flex flex-col items-center w-full max-w-[520px] select-none scroll-mt-2">
      {/* Barra de Status da Corrida */}
      <div className="w-full flex items-center justify-between px-3.5 py-2.5 game-panel-gold rounded-t-2xl rounded-b-none border-b-0 text-xs font-mono gap-1.5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-amber-400 font-black flex items-center gap-1 text-sm tabular-nums">
            <span>⏱️</span>
            <span>{Math.max(0, TOTAL_GAME_TIME_SECONDS - Math.floor(elapsedSeconds))}s</span>
          </span>
          <span className="text-zinc-600 hidden sm:inline">·</span>
          <span
            className={`font-black hidden sm:inline uppercase tracking-wider text-[11px] ${
              elapsedSeconds >= HARD_MODE_START_SECONDS ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
            }`}
          >
            {elapsedSeconds >= HARD_MODE_START_SECONDS ? '🔥 REI' : 'Marginal'}
          </span>
          {status === 'running' && weatherKindUi !== 'clear' && (() => {
            const badge = getWeatherUiBadge(weatherKindUi, lang);
            return (
              <span
                title={badge.effectHint}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-black tracking-tight ${
                  weatherKindUi === 'light-rain'
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                    : 'bg-slate-400/20 border-slate-300/60 text-slate-100'
                }`}
              >
                <span>{badge.icon}</span>
                <span className="hidden md:inline">{badge.label}</span>
              </span>
            );
          })()}
        </div>

        {/* Posição em Tempo Real (1º ao 5º Lugar) ou Modo Espectador Fantasma */}
        {isSpectating ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border shadow-md font-mono font-black text-xs bg-cyan-950/90 border-cyan-400/70 text-cyan-200">
            <span>👻</span>
            <span>{mpStrings.ghostObserverBadge}</span>
          </div>
        ) : (
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border shadow-md font-mono font-black text-xs transition-all ${
              liveRank === 1
                ? 'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/25 border-amber-400 text-amber-200 shadow-amber-500/25'
                : liveRank === 2
                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                : liveRank === 3
                ? 'bg-orange-500/20 border-orange-400 text-orange-200'
                : liveRank === 4
                ? 'bg-zinc-800/90 border-zinc-600 text-zinc-200'
                : 'bg-rose-950/90 border-rose-500 text-rose-200'
            }`}
          >
            <span>{liveRank === 1 ? '👑' : liveRank === 2 ? '🥈' : liveRank === 3 ? '🥉' : '🏃'}</span>
            <span>
              {liveRank} {t.canvas.placeLabel}
            </span>
            <span className="text-[10px] font-bold opacity-85 uppercase hidden xs:inline">
              · {t.canvas.aheadOfPrefix} {aheadOfCount}/{Math.max(1, competitors.length - 1)}
            </span>
          </div>
        )}

        {/* Indicador de Dash (4s cooldown) e 5 Faixas */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isSpectating && (
            <div
              ref={dashPillRef}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black bg-amber-500/20 border-amber-400/70 text-amber-300 shadow-sm"
            >
              <span>⚡</span>
              <span ref={dashPillTextRef} className="tabular-nums">
                {t.canvas.dashReady}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg game-subplate">
            <span className="text-xs">🏁</span>
            <span className="text-[11px] font-black text-sky-300 tabular-nums">
              {t.canvas.laneLabel} {stateRef.current.player.targetLane + 1}/5
            </span>
          </div>
        </div>
      </div>

      {/* Tira ao Vivo dos 5 Corredores: Movimentos em Tempo Real e Apostas */}
      <div className="w-full px-2.5 py-2 game-panel border-x border-b border-amber-500/25 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
          <span className="font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{mpStrings.liveRunnersBarTitle}</span>
          </span>
          <span className="text-amber-300 font-bold">
            {mpStrings.roomBetInlineLabel}: {formatMoney(betAmountKz)}
          </span>
        </div>
        {/* Mini-pista de 5 Faixas com ícones dos competidores animados via Framer Motion */}
        <div
          className="relative w-full h-8 rounded-xl bg-zinc-950/90 border border-white/10 overflow-hidden px-1 flex items-center"
          aria-label={mpStrings.liveRunnersBarTitle}
        >
          {/* Divisórias das 5 faixas */}
          <div className="absolute inset-0 grid grid-cols-5 pointer-events-none">
            {[0, 1, 2, 3, 4].map((laneNum) => (
              <div
                key={laneNum}
                className="h-full border-r last:border-r-0 border-dashed border-white/10 flex items-end justify-center pb-0.5"
              >
                <span className="text-[7px] font-mono text-zinc-600 font-bold">
                  F{laneNum + 1}
                </span>
              </div>
            ))}
          </div>

          {liveHudRunners.slice(0, 5).map((runner) => {
            const laneCenterX =
              typeof runner.laneX === 'number' && Number.isFinite(runner.laneX)
                ? runner.laneX
                : LANE_CENTERS[clampLaneIndex(runner.targetLane ?? runner.lane)];
            const normalizedLaneRatio = Math.max(
              0,
              Math.min(1, (laneCenterX - LANE_CENTERS[0]) / Math.max(1, LANE_CENTERS[4] - LANE_CENTERS[0]))
            );
            const leftPct = 10 + normalizedLaneRatio * 80;
            const isRemoteLive = !runner.isBot && !runner.isPlayer && !runner.id.startsWith('friend-');
            return (
              <motion.div
                key={`radar-avatar-${runner.id}`}
                data-testid={`competitor-lane-avatar-${runner.id}`}
                data-lane={clampLaneIndex(runner.targetLane ?? runner.lane)}
                initial={false}
                animate={{
                  left: `${leftPct}%`,
                  scale: runner.stumbling ? 0.88 : runner.action === 'dashing' ? 1.12 : 1,
                  y: (runner.jumpY || 0) > 8 ? -3 : 0,
                }}
                transition={{
                  left: { type: 'spring', stiffness: 280, damping: 24, mass: 0.75 },
                  scale: { duration: 0.2 },
                  y: { duration: 0.18 },
                }}
                style={{ transform: 'translateX(-50%)' }}
                className={`absolute top-1 z-10 w-6 h-6 rounded-full flex items-center justify-center border shadow-md ${
                  runner.isPlayer
                    ? 'bg-amber-500/30 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                    : isRemoteLive
                    ? 'bg-emerald-950/90 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                    : 'bg-zinc-900/95 border-zinc-600/80'
                }`}
                title={`${runner.name.replace(/\s*\(.*?\)\s*$/, '')} · F${clampLaneIndex(runner.targetLane ?? runner.lane) + 1}`}
              >
                <AvatarDoll
                  avatarId={runner.avatarId}
                  name={runner.name}
                  color={runner.color}
                  size={18}
                  variant="bust"
                  stumbling={Boolean(runner.stumbling)}
                />
              </motion.div>
            );
          })}
        </div>

        <LayoutGroup id="live-runners-strip">
          <div className="grid grid-cols-5 gap-1">
            {[...liveHudRunners]
              .sort((a, b) => (a.targetLane ?? a.lane) - (b.targetLane ?? b.lane))
              .slice(0, 5)
              .map((runner) => {
                const displayLane = Math.max(0, Math.min(4, runner.targetLane ?? runner.lane)) + 1;
                const moveGlyph = runner.profileReady === false
                  ? '⏳'
                  : runner.stumbling
                  ? '⚠️'
                  : runner.action === 'dashing'
                  ? '⚡'
                  : runner.action === 'jumping' || (runner.jumpY || 0) > 8
                  ? '🦘'
                  : runner.action === 'sliding'
                  ? '⬇️'
                  : '🏃';
                const moveLabel = runner.stumbling
                  ? mpStrings.actionStumbling
                  : runner.action === 'dashing'
                  ? mpStrings.actionDashing
                  : runner.action === 'jumping' || (runner.jumpY || 0) > 8
                  ? mpStrings.actionJumping
                  : runner.action === 'sliding'
                  ? mpStrings.actionSliding
                  : mpStrings.actionRunning;
                const isRemoteLive = !runner.isBot && !runner.isPlayer && !runner.id.startsWith('friend-');
                const runnerBet = runner.betAmount ?? betAmountKz;
                return (
                  <motion.div
                    key={runner.id}
                    layout="position"
                    transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.85 }}
                    className={`px-1.5 py-1 rounded-lg border text-[9px] font-mono flex flex-col gap-0.5 min-w-0 ${
                      runner.isPlayer
                        ? 'bg-amber-500/15 border-amber-400/70 text-amber-100'
                        : isRemoteLive
                        ? 'bg-emerald-950/45 border-emerald-500/50 text-emerald-100'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-0.5">
                      <span className="flex items-center gap-1 min-w-0">
                        <motion.span
                          layout="position"
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-950/80 border border-white/15 shrink-0 overflow-hidden"
                        >
                          <AvatarDoll
                            avatarId={runner.avatarId}
                            name={runner.name}
                            color={runner.color}
                            size={15}
                            variant="bust"
                            stumbling={Boolean(runner.stumbling)}
                          />
                        </motion.span>
                        <span className="font-black text-[9px] truncate">F{displayLane}</span>
                      </span>
                      <span title={moveLabel}>{moveGlyph}</span>
                    </div>
                    <span className="truncate font-bold text-[9px] leading-tight">
                      {runner.name.replace(/\s*\(.*?\)\s*$/, '')}
                    </span>
                    <div className="flex items-center justify-between gap-0.5 text-[8px] opacity-90 tabular-nums">
                      <span className="text-amber-300 font-bold truncate">
                        {formatMoney(runnerBet)}
                      </span>
                      {status === 'running' && (
                        <span className="text-zinc-300 shrink-0">
                          {Math.round(runner.progressDistance || 0)}m
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </LayoutGroup>
      </div>

      {/* Notificação Ativa de Power-Up */}
      <AnimatePresence>
        {activePowerUpNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full bg-emerald-950/95 border-x border-b border-emerald-500/50 py-1.5 text-center text-xs text-emerald-300 font-black tracking-wider"
          >
            {activePowerUpNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Área da Pista: Alternância Fluida 2D vs 3D com Camera Zoom-in e Screen Shake no Countdown 0 */}
      <motion.div
        animate={
          countdownValue === 0
            ? {
                scale: [1, 1.055, 1.025, 1],
                x: [0, -3.5, 3.5, -2, 2, 0],
                y: [0, 2.5, -3, 2, -1, 0],
              }
            : { scale: 1, x: 0, y: 0 }
        }
        transition={{ duration: 0.52, type: 'tween', ease: 'easeOut' }}
        className="relative w-full aspect-[520/680] bg-[#04070e] border-x border-b border-amber-500/35 rounded-b-2xl overflow-hidden shadow-[0_24px_60px_-10px_rgba(0,0,0,0.85)] origin-center"
      >
        {/* Flash de Adrenalina & Shockwave quando a largada dispara (Countdown 0) */}
        <AnimatePresence>
          {countdownValue === 0 && (
            <motion.div
              initial={{ opacity: 0.85, scale: 0.55 }}
              animate={{ opacity: [0.85, 0.45, 0], scale: [0.55, 1.25, 1.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, type: 'tween', ease: 'easeOut' }}
              className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-hidden"
            >
              <div className="w-[420px] h-[420px] rounded-full border-4 border-amber-400/90 shadow-[0_0_80px_rgba(245,158,11,0.95)]" />
              <div className="absolute inset-0 bg-radial from-amber-500/25 via-transparent to-amber-500/10" />
            </motion.div>
          )}
        </AnimatePresence>

        {viewMode === '3d' ? (
          <ThreeCanvas
            status={status}
            elapsedSeconds={elapsedSeconds}
            competitors={competitors}
            obstacles={stateRef.current.obstacles}
            powerUps={stateRef.current.powerUps}
            coins={stateRef.current.coins}
            playerLane={stateRef.current.player.lane}
            playerJumpY={stateRef.current.player.jumpY}
            playerSlideProgress={stateRef.current.player.slideProgress}
            isDashing={stateRef.current.player.dashTimer > 0}
            isNitro={stateRef.current.player.nitroTimer > 0}
            isStumbling={stateRef.current.player.stumbleTimer > 0}
            liveStateRef={stateRef}
            timeMode={timeMode}
            paused={pause3d}
            isSpectating={Boolean(isSpectating)}
            spectatedRunnerId={spectatedRunnerId ?? null}
            onMoveLane={moveLane}
            onJump={triggerJump}
            onSlide={triggerSlide}
            onDash={triggerDash}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={CANV_WIDTH}
            height={CANV_HEIGHT}
            data-game-surface="2d"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerCancel}
            onLostPointerCapture={handleCanvasLostPointerCapture}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              touchAction: status === 'running' || status === 'starting' ? 'none' : 'auto',
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
              userSelect: 'none',
            }}
            className={`w-full h-full block cursor-default select-none ${
              status === 'running' || status === 'starting' ? 'touch-none' : 'touch-auto'
            }`}
          />
        )}

        {/* Partículas Framer Motion ao Saltar ou Coletar Moedas */}
        <CanvasMotionParticles bursts={motionBursts} />

        {/* HUD Telemetria em Tempo Real no Modo 3D (sem backdrop-blur para não pesar na GPU WebGL) */}
        {status === 'running' && viewMode === '3d' && (
          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5 pointer-events-none z-20 font-mono">
            {/* Velocidade & Estado de Abrandamento */}
            <div
              className={`px-2.5 py-1.5 rounded-xl border shadow-lg flex flex-col ${
                stateRef.current.player.stumbleTimer > 0
                  ? 'bg-rose-950/95 border-rose-500 text-rose-200'
                  : elapsedSeconds >= HARD_MODE_START_SECONDS
                  ? 'bg-zinc-950/95 border-rose-500/80 text-rose-300'
                  : 'bg-zinc-950/95 border-amber-500/80 text-amber-300'
              }`}
            >
              <span className="text-[11px] font-black leading-tight tabular-nums">
                {stateRef.current.player.stumbleTimer > 0 ? '🐢' : '⚡'}{' '}
                {Math.max(18, Math.round((stateRef.current.speed / 6.8) * 72))} KM/H
              </span>
              <span className="text-[8px] font-bold uppercase opacity-85">
                {stateRef.current.player.stumbleTimer > 0
                  ? t.canvas.slowedHud
                  : elapsedSeconds >= HARD_MODE_START_SECONDS
                  ? t.canvas.kingBpmHud
                  : t.canvas.margBpmHud}
              </span>
            </div>

            {/* Posição Instantânea em Tempo Real ou Badge Ghost */}
            {isSpectating ? (
              <div className="px-3.5 py-1.5 rounded-xl flex flex-col items-center border-2 shadow-2xl font-black bg-cyan-950/95 border-cyan-400 text-cyan-200">
                <span className="text-xs leading-tight flex items-center gap-1">
                  <span>👻</span>
                  <span>{mpStrings.ghostObserverBadge}</span>
                </span>
                <span className="text-[8px] font-extrabold uppercase opacity-90 truncate max-w-[130px]">
                  {spectatedRunnerId
                    ? (competitors.find((c) => c.id === spectatedRunnerId)?.name || mpStrings.autoLeaderLabel)
                    : mpStrings.autoLeaderLabel}
                </span>
              </div>
            ) : (
              <div
                className={`px-3.5 py-1.5 rounded-xl flex flex-col items-center border-2 shadow-2xl font-black ${
                  liveRank === 1
                    ? 'bg-amber-500/95 border-amber-200 text-zinc-950 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                    : liveRank === 2
                    ? 'bg-sky-500/95 border-sky-200 text-sky-950'
                    : liveRank === 3
                    ? 'bg-orange-500/95 border-orange-200 text-orange-950'
                    : liveRank === 4
                    ? 'bg-zinc-900/95 border-zinc-600 text-zinc-100'
                    : 'bg-rose-600/95 border-rose-300 text-white'
                }`}
              >
                <span className="text-xs leading-tight flex items-center gap-1">
                  <span>
                    {liveRank === 1 ? '👑' : liveRank === 2 ? '🥈' : liveRank === 3 ? '🥉' : liveRank === 4 ? '4️⃣' : '5️⃣'}
                  </span>
                  <span>
                    {liveRank} {t.canvas.placeLabel}
                  </span>
                </span>
                <span className="text-[8px] font-extrabold uppercase opacity-90">
                  {t.canvas.aheadOfPrefix} {aheadOfCount}/{Math.max(1, competitors.length - 1)}
                </span>
              </div>
            )}

            {/* Faixa & Distância */}
            <div className="px-2.5 py-1.5 rounded-xl bg-zinc-950/95 border border-sky-400/70 shadow-lg flex flex-col items-end">
              <span className="text-[11px] font-black text-sky-300 leading-tight tabular-nums">
                {t.canvas.laneLabel} {stateRef.current.player.targetLane + 1}/5
              </span>
              <span className="text-[8px] font-bold text-slate-300 tabular-nums">
                {t.canvas.distLabel}: {Math.round(stateRef.current.playerDistance)}m
              </span>
              {weatherKindUi !== 'clear' && (() => {
                const badge = getWeatherUiBadge(weatherKindUi, lang);
                return (
                  <span
                    className={`mt-0.5 text-[8px] font-black uppercase ${
                      weatherKindUi === 'light-rain' ? 'text-sky-300' : 'text-slate-200'
                    }`}
                  >
                    {badge.icon} {badge.label}
                  </span>
                );
              })()}
            </div>
          </div>
        )}

        {/* Contagem Regressiva Inicial */}
        <AnimatePresence>
          {status === 'starting' && countdownValue !== null && (
            <motion.div
              key="countdown-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 pointer-events-none"
            >
              <motion.div
                key={countdownValue}
                initial={{ scale: 0.25, opacity: 0 }}
                animate={{ scale: [0.25, 1.25, 1], opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.45, type: 'tween', ease: 'easeOut' }}
                className="flex flex-col items-center text-center px-4"
              >
                <span className="text-7xl sm:text-8xl font-black font-display tracking-tight text-amber-400 drop-shadow-[0_0_35px_rgba(245,158,11,0.95)]">
                  {countdownValue === 0 ? t.canvas.countdownGo : countdownValue}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-200 mt-2 bg-zinc-950/90 px-4 py-1.5 rounded-lg border border-amber-500/50">
                  {countdownValue === 0 ? t.canvas.countdownGoSub : t.canvas.countdownWaitSub}
                </span>
              </motion.div>
            </motion.div>
          )}

          {/* Chegada ao Trono Real */}
          {status === 'completed' && (
            <motion.div
              key="completed-overlay"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-amber-950/92 text-center"
            >
              <span className="text-6xl mb-2">👑</span>
              <h3 className="text-2xl font-black font-display text-amber-300 uppercase tracking-wide">
                {t.canvas.throneReachedTitle}
              </h3>
              <p className="text-xs text-amber-200 mt-1">{t.canvas.throneReachedSub}</p>
              <div className="my-3 px-5 py-2 rounded-xl game-subplate border-amber-500/50 font-mono text-xs font-bold text-amber-300">
                {t.canvas.loadingCeremony}
              </div>
              {onRestart && (
                <button
                  type="button"
                  onClick={onRestart}
                  className="mt-2 px-6 py-2.5 rounded-xl game-btn-gold font-black text-xs uppercase cursor-pointer"
                >
                  {t.canvas.viewCoronationBtn}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {isSpectating ? (
        <div className="w-full mt-3 p-3 rounded-2xl bg-zinc-950/95 border border-sky-400/55 flex flex-col gap-2.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono font-black px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-400/50 shrink-0">
                👻 {mpStrings.ghostObserverBadge}
              </span>
              <span className="text-[11px] font-mono text-zinc-300 truncate">
                {mpStrings.followingRunnerPrefix}{' '}
                <strong className="text-sky-300">
                  {(() => {
                    const target = spectatedRunnerId
                      ? liveHudRunners.find((r) => r.id === spectatedRunnerId)
                      : [...liveHudRunners].sort(
                          (a, b) => b.progressDistance - a.progressDistance
                        )[0];
                    return target
                      ? target.name.replace(/\s*\(.*?\)\s*$/, '')
                      : mpStrings.autoLeaderLabel;
                  })()}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenSpectatorOverview && (
                <button
                  type="button"
                  data-testid="canvas-spectator-overview-btn"
                  onClick={onOpenSpectatorOverview}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/60 text-sky-200 hover:text-white font-mono font-black text-[11px] uppercase cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  📊 {mpStrings.spectatorOverviewBtn}
                </button>
              )}
              {onExitSpectator && (
                <button
                  type="button"
                  onClick={onExitSpectator}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/90 hover:bg-rose-600 border border-rose-500/50 text-rose-200 hover:text-white font-mono font-black text-[11px] uppercase cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  ✕ {mpStrings.exitSpectatorBtn}
                </button>
              )}
            </div>
          </div>

          {onSelectSpectatedRunner && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectSpectatedRunner(null)}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                  !spectatedRunnerId
                    ? 'bg-sky-500 text-zinc-950 border-sky-300 font-black'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-sky-400/60'
                }`}
              >
                👑 {mpStrings.autoLeaderLabel}
              </button>
              {liveHudRunners.map((runner) => {
                const selected = spectatedRunnerId === runner.id;
                return (
                  <button
                    key={runner.id}
                    type="button"
                    onClick={() => onSelectSpectatedRunner(runner.id)}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      selected
                        ? 'bg-sky-500 text-zinc-950 border-sky-300 font-black'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-sky-400/60'
                    }`}
                  >
                    <span>{runner.avatar}</span>
                    <span className="truncate max-w-[100px]">
                      {runner.name.replace(/\s*\(.*?\)\s*$/, '')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="text-[10px] font-mono text-sky-300/80 border-t border-zinc-800/80 pt-1.5">
            {mpStrings.noBetSpectatorNote}
          </div>
        </div>
      ) : (
        /* Exemplo de Jogabilidade Oficial (Sem botões virtuais — 100% Controles por Gestos) */
        <div className="w-full mt-3 p-3.5 rounded-2xl game-panel-gold flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">👆</span>
              <span className="text-xs font-black font-display uppercase tracking-wider text-amber-400">
                {t.canvas.gestureBoxTitle}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40">
              {t.canvas.gestureBoxBadge}
            </span>
          </div>

          {/* 4 Movimentos + Dash (Duplo Toque, 4s recarga) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl game-subplate flex flex-col items-center text-center">
              <div className="flex items-center gap-1.5 text-amber-400 text-lg mb-1">
                <span>👈</span>
                <span>👉</span>
              </div>
              <span className="text-[11px] font-black text-zinc-100">{t.canvas.gestureSidesTitle}</span>
              <span className="text-[9px] text-zinc-400 mt-0.5 font-medium leading-tight">
                {t.canvas.gestureSidesSub}
              </span>
            </div>

            <div className="p-2.5 rounded-xl game-subplate border-amber-500/30 flex flex-col items-center text-center">
              <span className="text-lg text-amber-400 mb-1">👆</span>
              <span className="text-[11px] font-black text-amber-300">{t.canvas.gestureUpTitle}</span>
              <span className="text-[9px] text-zinc-400 mt-0.5 font-medium leading-tight">
                {t.canvas.gestureUpSub}
              </span>
            </div>

            <div className="p-2.5 rounded-xl game-subplate border-cyan-500/30 flex flex-col items-center text-center">
              <span className="text-lg text-cyan-400 mb-1">👇</span>
              <span className="text-[11px] font-black text-cyan-300">{t.canvas.gestureDownTitle}</span>
              <span className="text-[9px] text-zinc-400 mt-0.5 font-medium leading-tight">
                {t.canvas.gestureDownSub}
              </span>
            </div>

            <div
              ref={dashCardRef}
              className="p-2.5 rounded-xl border flex flex-col items-center text-center transition-colors bg-amber-950/35 border-amber-400/50"
            >
              <span className="text-lg text-yellow-400 mb-1">⚡</span>
              <span className="text-[11px] font-black text-yellow-300">{t.canvas.gestureDashTitle}</span>
              <span ref={dashCardTextRef} className="text-[9px] text-zinc-400 mt-0.5 font-medium leading-tight">
                {`${t.canvas.gestureDashReady} · 4s`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-800/80 font-mono">
            <span>{t.canvas.gestureFooter}</span>
            <span className="text-amber-400 font-bold">{t.canvas.officialRaceDuration}</span>
          </div>
        </div>
      )}
    </div>
  );
};
