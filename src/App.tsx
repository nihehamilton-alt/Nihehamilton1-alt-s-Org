import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  GameStatus,
  RoundHistory,
  Competitor,
  RoomConfig,
  Lane,
  ViewMode,
  TimeMode,
  RoomAccessMode,
  RacePerformanceMetrics,
  RemoteRunnerSnapshot,
  LocalRunnerTelemetry,
  RoomStandingEntry,
  TelemetryInvestigationEntry,
  ServerRaceStatus,
  PlayerAction,
  RoomChatMessage,
} from './types/game';
import { getMultiplayerStrings } from './utils/multiplayerStrings';
import { ClientTelemetryValidator } from './utils/telemetryValidator';
import { Trash2, Shuffle, Lock, Users, Share2, Check, QrCode, Download, X, Copy, Camera, LogOut, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { TOTAL_GAME_TIME_SECONDS, LANE_CENTERS, RIVAL_LANE_SLOTS } from './game/constants';
import { ANGOLAN_BOTS, pickRotatedPublicBots } from './data/bots';
import { AVATARS, AvatarItem } from './data/avatars';
import { getLocalizedAvatar, getLocalizedBot } from './data/translations';
import { useI18n } from './contexts/I18nContext';
import { LanguageGeoModal } from './components/LanguageGeoModal';
import { calculateThreeTorneiras, clampBetKz, PASSE_DO_REI_MONTHLY_KZ } from './data/currency';
import { sounds } from './audio/soundEffects';
import { GameHeader } from './components/GameHeader';
import { GameCanvas } from './components/GameCanvas';
import { BettingPanel } from './components/BettingPanel';
import { RulesModal } from './components/RulesModal';
import { HowToPlayTutorialModal } from './components/HowToPlayTutorialModal';
import { SpectatorOverviewModal } from './components/SpectatorOverviewModal';
import {
  Top3StreakCelebrationOverlay,
  Top3CelebrationPayload,
} from './components/Top3StreakCelebrationOverlay';
import { LobbyRoom } from './components/LobbyRoom';
import { ResultsPodium } from './components/ResultsPodium';
import { RankingModal } from './components/RankingModal';
import { ShopModal } from './components/ShopModal';
import { AdminPanel } from './components/AdminPanel';
import { OperatorSelector, OPERATOR_THEMES, OperatorTheme } from './components/OperatorSelector';
import { ProvablyFairModal } from './components/ProvablyFairModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DailyMissionsWidget } from './components/DailyMissionsWidget';
import { MatchHistoryCard } from './components/MatchHistoryCard';
import { VoiceChatProvider } from './contexts/VoiceChatContext';
import { VoiceChatPanel } from './components/VoiceChatPanel';
import { VoiceSpeakerOverlay } from './components/VoiceSpeakerOverlay';
import {
  DAILY_MISSIONS,
  DailyMissionsState,
  createFreshDailyMissionsState,
  getLocalDateKey,
  getMissionProgress,
  loadDailyMissionsState,
  saveDailyMissionsState,
} from './data/missions';
import {
  saveRaceRecord,
  getSessionPlayerId,
  restoreSessionPlayerId,
  markCreatedRoomSession,
  getCreatedRoomCreatorId,
  clearCreatedRoomSession,
} from './utils/offlineSync';
import { InviteOnboardingModal } from './components/InviteOnboardingModal';
import { PerformanceAnalysisWidget } from './components/PerformanceAnalysisWidget';
import { AiCoachPanel } from './components/AiCoachPanel';
import { AvatarDoll } from './components/AvatarDoll';

class PodiumErrorBoundary extends React.Component<
  { onRecover: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onRecover: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error('Erro recuperado no pódio:', err);
    setTimeout(() => {
      this.props.onRecover();
      this.setState({ hasError: false });
    }, 250);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const roomControlGridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

const roomControlItemVariants = {
  hidden: { opacity: 0, y: 6, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: 'easeOut' as const },
  },
};

export default function App() {
  // 1. Rota Restrita /admin-rei-zero (Exclusivo para Hamilton David Nihefe Muenda)
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      return (
        path.includes('admin-rei-zero') ||
        hash.includes('admin-rei-zero') ||
        search.includes('admin-rei-zero')
      );
    }
    return false;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      setIsAdminRoute(
        path.includes('admin-rei-zero') ||
          hash.includes('admin-rei-zero') ||
          search.includes('admin-rei-zero')
      );
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') ||
        (e.altKey && e.key.toLowerCase() === 'a')
      ) {
        e.preventDefault();
        setIsAdminRoute((prev) => !prev);
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 2. Modos Visuais: 2D vs 3D | Dia vs Noite
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [timeMode, setTimeMode] = useState<TimeMode>('day');

  // 3. Sistema Global de Idiomas (15), Geo-Deteção e Conversão de Moeda (11)
  const { lang, t, formatMoney } = useI18n();

  // 4. Modo Demo (Treino) vs Modo Real (KZ)
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') !== 'real';
    }
    return true;
  });
  const shouldReduceMotion = useReducedMotion();

  // 5. Saldos em Kwanzas (KZ)
  const [demoBalance, setDemoBalance] = useState<number>(() => {
    const saved = localStorage.getItem('rei_zero_demo_balance');
    return saved ? Math.floor(parseFloat(saved)) : 100_000;
  });

  const [realBalance, setRealBalance] = useState<number>(() => {
    const saved = localStorage.getItem('rei_zero_real_balance');
    return saved ? Math.floor(parseFloat(saved)) : 0;
  });

  const balance = isDemo ? demoBalance : realBalance;
  const setBalance = isDemo ? setDemoBalance : setRealBalance;

  useEffect(() => {
    localStorage.setItem('rei_zero_demo_balance', demoBalance.toString());
  }, [demoBalance]);

  useEffect(() => {
    localStorage.setItem('rei_zero_real_balance', realBalance.toString());
  }, [realBalance]);

  // 6. Estado da Corrida e Aposta (mínimo 50 Kz, máximo 100.000 Kz)
  const [betAmount, setBetAmount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') || params.get('sala')) {
        const betParam = parseInt(params.get('bet') || '500', 10);
        return isNaN(betParam) ? 500 : clampBetKz(betParam);
      }
    }
    return 500;
  });
  const [status, setStatus] = useState<GameStatus>('idle');
  const statusRef = useRef<GameStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [coinsCollected, setCoinsCollected] = useState<number>(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [roundNonce, setRoundNonce] = useState<number>(0);
  const [lastPerformance, setLastPerformance] = useState<RacePerformanceMetrics | null>(null);

  // 6.1 Contador de Vitórias Consecutivas no Pódio (Top 3 Streak)
  const [top3Streak, setTop3Streak] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rei_zero_top3_streak');
      return saved ? parseInt(saved, 10) || 0 : 0;
    }
    return 0;
  });
  const top3StreakRef = useRef<number>(top3Streak);
  const [top3Celebration, setTop3Celebration] = useState<Top3CelebrationPayload | null>(null);
  const handleDismissTop3Celebration = useCallback(() => setTop3Celebration(null), []);

  useEffect(() => {
    top3StreakRef.current = top3Streak;
    localStorage.setItem('rei_zero_top3_streak', top3Streak.toString());
  }, [top3Streak]);

  // 6.2 Missões Diárias (Progresso diário offline + reinício automático à meia-noite)
  const [dailyMissionsState, setDailyMissionsState] = useState<DailyMissionsState>(() =>
    loadDailyMissionsState()
  );

  useEffect(() => {
    saveDailyMissionsState(dailyMissionsState);
  }, [dailyMissionsState]);

  useEffect(() => {
    const checkMidnightReset = () => {
      const todayKey = getLocalDateKey();
      setDailyMissionsState((prev) =>
        prev.dateKey === todayKey ? prev : createFreshDailyMissionsState(todayKey)
      );
    };
    const interval = setInterval(checkMidnightReset, 60_000);
    window.addEventListener('focus', checkMidnightReset);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkMidnightReset);
    };
  }, []);

  // 7. Configurações de Modais, Operadora B2B e Áudio
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.7);
  const [rulesOpen, setRulesOpen] = useState<boolean>(false);
  const [howToPlayTutorialOpen, setHowToPlayTutorialOpen] = useState<boolean>(false);
  const tutorialShownThisSessionRef = useRef<boolean>(false);
  const [lobbyOpen, setLobbyOpen] = useState<boolean>(false);
  const [showPodium, setShowPodium] = useState<boolean>(false);
  const [rankingOpen, setRankingOpen] = useState<boolean>(false);
  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [isProvablyFairOpen, setIsProvablyFairOpen] = useState<boolean>(false);
  const [currentOperator, setCurrentOperator] = useState<OperatorTheme>(OPERATOR_THEMES[0]);

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    sounds.setVolume(newVol);
    if (newVol > 0 && !soundEnabled) {
      setSoundEnabled(true);
    }
  };

  // 7.1 Tela Oficial de Carregamento (Loading)
  const [isLoadingScreen, setIsLoadingScreen] = useState<boolean>(() => {
    return true;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingScreen(false);
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  // 8. Os 10 Avatares Oficiais (Persistidos no telemóvel / offline)
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rei_zero_selected_avatar') || 'rei-zero';
    }
    return 'rei-zero';
  });
  const [unlockedAvatars, setUnlockedAvatars] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('rei_zero_unlocked_avatars');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // fallback para padrão
      }
    }
    return ['rei-zero'];
  });
  const [hasPasseDoRei, setHasPasseDoRei] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rei_zero_passe_do_rei') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('rei_zero_selected_avatar', selectedAvatarId);
  }, [selectedAvatarId]);

  useEffect(() => {
    localStorage.setItem('rei_zero_unlocked_avatars', JSON.stringify(unlockedAvatars));
  }, [unlockedAvatars]);

  useEffect(() => {
    localStorage.setItem('rei_zero_passe_do_rei', String(hasPasseDoRei));
  }, [hasPasseDoRei]);

  // 9. Configuração de Sala e Arena Privada dos Amigos (com suporte a link compartilhado)
  const clampRoomMax = (val: unknown, fallback = 5): 2 | 3 | 4 | 5 => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback as 2 | 3 | 4 | 5;
    return Math.max(2, Math.min(5, Math.round(n))) as 2 | 3 | 4 | 5;
  };

  const [roomConfig, setRoomConfig] = useState<RoomConfig>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room') || params.get('sala');
      if (roomParam) {
        const hostParam = params.get('host') || 'Hamilton Nihefe';
        const titleParam = params.get('title') || `Arena de ${hostParam}`;
        const betParam = parseInt(params.get('bet') || '500', 10);
        const maxParam = parseInt(params.get('max') || '5', 10);
        const accessParam = params.get('access');
        const accessMode: RoomAccessMode = accessParam === 'random' ? 'random' : 'invite-only';
        return {
          code: roomParam.toUpperCase(),
          title: titleParam,
          hostName: hostParam,
          maxPlayers: clampRoomMax(maxParam, 5),
          minPlayers: 2,
          betAmount: isNaN(betParam) ? 500 : clampBetKz(betParam),
          fillWithBots: params.get('bots') === 'true',
          isDemo: params.get('mode') !== 'real',
          isPrivate: accessMode === 'invite-only',
          accessMode,
        };
      }
    }
    return {
      code: 'ARENA-AO-VIVO',
      title: 'Arena Pública ao Vivo',
      hostName: 'Anfitrião',
      maxPlayers: 5,
      minPlayers: 2,
      betAmount: 500,
      fillWithBots: true,
      isDemo: true,
      isPrivate: false,
      accessMode: 'random',
    };
  });

  // 9.1 Identidade do Jogador na Arena (para salas compartilhadas com amigos)
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rei_zero_player_name') || 'REI ZERO';
    }
    return 'REI ZERO';
  });
  const [serverRoomConnected, setServerRoomConnected] = useState<boolean>(false);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  const [confirmDeleteMain, setConfirmDeleteMain] = useState<boolean>(false);
  const [roomUrlCopied, setRoomUrlCopied] = useState<boolean>(false);
  const shareCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mpStrings = useMemo(() => getMultiplayerStrings(lang), [lang]);
  const initialHasUrlRoom =
    typeof window !== 'undefined' &&
    Boolean(
      new URLSearchParams(window.location.search).get('room') ||
        new URLSearchParams(window.location.search).get('sala')
    );
  const initialCreatedCreatorId =
    typeof window !== 'undefined' ? getCreatedRoomCreatorId(roomConfig.code) : null;
  if (initialCreatedCreatorId) {
    restoreSessionPlayerId(initialCreatedCreatorId);
  }
  const isInitialLocalCreator = Boolean(initialHasUrlRoom && initialCreatedCreatorId);
  const isAutoMatchRef = useRef<boolean>(!initialHasUrlRoom);
  const isRoomCreatorRef = useRef<boolean>(isInitialLocalCreator);
  const [wsRoomSessionKey, setWsRoomSessionKey] = useState<string>(() =>
    initialHasUrlRoom
      ? `EXPLICIT_${roomConfig.code}`
      : `AUTO_PUBLIC_${isDemo ? 'DEMO' : 'REAL'}`
  );
  const remotePlayersRef = useRef<Map<string, RemoteRunnerSnapshot>>(new Map());
  const telemetryValidatorRef = useRef<ClientTelemetryValidator>(new ClientTelemetryValidator());
  const [investigatingCompetitors, setInvestigatingCompetitors] = useState<
    Record<string, TelemetryInvestigationEntry>
  >({});
  const roomWsRef = useRef<WebSocket | null>(null);
  const serverClockOffsetRef = useRef<number>(0);
  const bestRttRef = useRef<number>(Number.POSITIVE_INFINITY);
  const [roomRttMs, setRoomRttMs] = useState<number | null>(null);
  const [roomChatMessages, setRoomChatMessages] = useState<RoomChatMessage[]>([]);
  const hasCalibratedClockRef = useRef<boolean>(false);
  const forceSynchronizedRunRef = useRef<(() => void) | null>(null);
  const startRequestLockUntilRef = useRef<number>(0);
  const activeRaceRoundRef = useRef<number>(0);
  const activeRaceSeedRef = useRef<number | null>(null);
  const [activeRaceRound, setActiveRaceRound] = useState<number>(0);
  const startedRoundSetRef = useRef<Set<string>>(new Set());
  const finalizedRoundSetRef = useRef<Set<string>>(new Set());
  const activeBetForRoundRef = useRef<number>(betAmount);
  const finishFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalBetChangeAtRef = useRef<number>(0);
  const serverHumansCountRef = useRef<number>(1);
  const [raceSeed, setRaceSeed] = useState<number | null>(null);
  const [syncedRaceStartAt, setSyncedRaceStartAt] = useState<number | null>(null);
  const [isLocalRoomHost, setIsLocalRoomHost] = useState<boolean>(
    () => !initialHasUrlRoom || isInitialLocalCreator
  );
  const [isEditingRoomOrProfile, setIsEditingRoomOrProfile] = useState<boolean>(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState<boolean>(false);
  const [waitingOpponentNames, setWaitingOpponentNames] = useState<string[]>([]);
  const [authoritativeRankings, setAuthoritativeRankings] = useState<RoomStandingEntry[] | null>(null);
  const [pendingSyncPodium, setPendingSyncPodium] = useState<boolean>(false);
  const [wsReconnectNonce, setWsReconnectNonce] = useState<number>(0);
  const [serverRaceStatus, setServerRaceStatus] = useState<ServerRaceStatus>('idle');
  const serverRaceStatusRef = useRef<ServerRaceStatus>('idle');
  const serverRaceRoundRef = useRef<number>(0);
  const serverRaceSeedRef = useRef<number | null>(null);
  const serverRaceStartAtRef = useRef<number | null>(null);
  const [isSpectating, setIsSpectating] = useState<boolean>(false);
  const isSpectatingRef = useRef<boolean>(false);
  const [spectatedRunnerId, setSpectatedRunnerId] = useState<string | null>(null);
  const [wasSpectatorOutcome, setWasSpectatorOutcome] = useState<boolean>(false);
  const [spectatorOverviewOpen, setSpectatorOverviewOpen] = useState<boolean>(false);
  const [liveCanvasRunners, setLiveCanvasRunners] = useState<Competitor[]>([]);
  const [spectatorOverviewTick, setSpectatorOverviewTick] = useState<number>(0);
  const previousPublicBotIdsRef = useRef<string[]>([]);
  const publicRoundCompletedRef = useRef<boolean>(false);
  const rotatePublicBotsInCompetitorsRef = useRef<
    ((targetBetKz: number, forceReplaceBots?: boolean, deterministicSeed?: number) => void) | null
  >(null);
  const latestServerRoomRef = useRef<{
    code: string;
    raceStatus?: ServerRaceStatus;
    raceRound?: number;
    raceSeed?: number;
    raceStartAt?: number | null;
    syncedRaceStartAt?: number | null;
    betAmount: number;
    fillWithBots?: boolean;
    maxPlayers?: number;
    participants: Array<{
      id: string;
      name: string;
      avatar: string;
      avatarId: string;
      color: string;
      isHost: boolean;
      lane?: number;
      targetLane?: number;
      laneX?: number;
      progressDistance?: number;
      action?: string;
      jumpY?: number;
      stumbling?: boolean;
      finished?: boolean;
      profileReady?: boolean;
      selectingProfile?: boolean;
      connected?: boolean;
      betAmount?: number;
      sessionStatus?: 'normal' | 'investigating';
      isSpectating?: boolean;
    }>;
  } | null>(null);
  const applyServerRoomStateRef = useRef<((forceCompetitorSync?: boolean) => void) | null>(null);

  const beginSynchronizedCountdownRef = useRef<((payload: {
    room: {
      code: string;
      title: string;
      hostName: string;
      hostId?: string;
      creatorId?: string;
      maxPlayers?: number;
      betAmount: number;
      fillWithBots?: boolean;
      isDemo?: boolean;
      accessMode?: RoomAccessMode;
      pendingStart?: boolean;
      raceStatus?: 'idle' | 'starting' | 'running' | 'completed';
      raceRound?: number;
      raceSeed?: number;
      raceStartAt?: number | null;
      syncedRaceStartAt?: number | null;
      participants: Array<{
        id: string;
        name: string;
        avatar: string;
        avatarId: string;
        color: string;
        isHost: boolean;
        lane?: number;
        targetLane?: number;
        laneX?: number;
        progressDistance?: number;
        action?: string;
        jumpY?: number;
        stumbling?: boolean;
        finished?: boolean;
        profileReady?: boolean;
        selectingProfile?: boolean;
        connected?: boolean;
        betAmount?: number;
        sessionStatus?: 'normal' | 'investigating';
        isSpectating?: boolean;
      }>;
    };
    raceRound: number;
    raceSeed: number;
    raceStartAt: number;
    betAmount: number;
    serverTime?: number;
  }) => void) | null>(null);

  useEffect(() => {
    telemetryValidatorRef.current.setSessionContext({
      roomCode: roomConfig.code,
      raceRound: activeRaceRoundRef.current,
      reporterId: getSessionPlayerId(),
    });
  }, [roomConfig.code]);

  useEffect(() => {
    void telemetryValidatorRef.current.flushBatch();
    telemetryValidatorRef.current.resetAll();
    startedRoundSetRef.current.clear();
    finalizedRoundSetRef.current.clear();
    setInvestigatingCompetitors({});
  }, [wsRoomSessionKey]);

  useEffect(() => {
    const validator = telemetryValidatorRef.current;
    const handlePageHide = () => {
      void validator.flushBatch(true);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      validator.dispose();
    };
  }, []);

  const [showTrackQr, setShowTrackQr] = useState<boolean>(false);
  const [trackQrDataUrl, setTrackQrDataUrl] = useState<string>('');
  const [qrInviteCopied, setQrInviteCopied] = useState<boolean>(false);
  const qrCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildInviteUrlFromConfig = useCallback(
    (cfg: RoomConfig): string => {
      const access = cfg.accessMode || 'invite-only';
      const maxPlayers = Math.max(2, Math.min(5, cfg.maxPlayers || 5));
      const botsFlag = cfg.fillWithBots ? 'true' : 'false';
      if (typeof window !== 'undefined') {
        return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
          cfg.code
        )}&host=${encodeURIComponent(cfg.hostName)}&title=${encodeURIComponent(
          cfg.title
        )}&bet=${cfg.betAmount}&max=${maxPlayers}&bots=${botsFlag}&mode=${isDemo ? 'demo' : 'real'}&access=${access}`;
      }
      return `https://rei-run.app/?room=${encodeURIComponent(cfg.code)}&max=${maxPlayers}&bots=${botsFlag}&access=${access}`;
    },
    [isDemo]
  );

  const roomInviteUrl = useMemo(
    () => buildInviteUrlFromConfig(roomConfig),
    [buildInviteUrlFromConfig, roomConfig]
  );

  const handleCreateRoomRef = useRef<((cfg: RoomConfig) => void) | null>(null);

  const ensureShareableCreatorRoom = useCallback((): string => {
    const needsPromotionToDedicatedRoom =
      isAutoMatchRef.current ||
      wsRoomSessionKey.startsWith('SOLO_IDLE_') ||
      roomConfig.code === 'ARENA-AO-VIVO' ||
      roomConfig.code.startsWith('ARENA-AO-VIVO-');

    // Convidado numa sala existente partilha apenas o link da própria sala em que está
    if (!needsPromotionToDedicatedRoom || (!isLocalRoomHost && !wsRoomSessionKey.startsWith('SOLO_IDLE_'))) {
      return buildInviteUrlFromConfig(roomConfig);
    }

    const freshCode =
      roomConfig.code &&
      roomConfig.code !== 'ARENA-AO-VIVO' &&
      !roomConfig.code.startsWith('ARENA-AO-VIVO-')
        ? roomConfig.code
        : `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanHost = playerName.trim() || 'Hamilton O Zero';
    const cleanTitle =
      !roomConfig.title || roomConfig.title === 'Arena Pública ao Vivo'
        ? `Arena de ${cleanHost}`
        : roomConfig.title;
    const promotedConfig: RoomConfig = {
      ...roomConfig,
      code: freshCode,
      title: cleanTitle,
      hostName: cleanHost,
      maxPlayers: clampRoomMax(roomConfig.maxPlayers, 5),
      minPlayers: 2,
      betAmount: clampBetKz(betAmount),
      fillWithBots: isAutoMatchRef.current ? false : Boolean(roomConfig.fillWithBots),
      isDemo,
      isPrivate: true,
      accessMode: 'invite-only',
    };
    handleCreateRoomRef.current?.(promotedConfig);
    return buildInviteUrlFromConfig(promotedConfig);
  }, [betAmount, buildInviteUrlFromConfig, isDemo, isLocalRoomHost, playerName, roomConfig, wsRoomSessionKey]);

  const handleShareRoomUrl = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const urlToCopy = ensureShareableCreatorRoom();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = urlToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = urlToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setRoomUrlCopied(true);
    if (shareCopyTimerRef.current) {
      clearTimeout(shareCopyTimerRef.current);
    }
    shareCopyTimerRef.current = setTimeout(() => {
      setRoomUrlCopied(false);
    }, 2500);
  }, [ensureShareableCreatorRoom]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(roomInviteUrl, {
      width: 380,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setTrackQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Erro gerando QR Code da sala:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [roomInviteUrl]);

  useEffect(() => {
    if (!showTrackQr) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTrackQr(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTrackQr]);

  const handleCopyQrInviteUrl = useCallback(async () => {
    const urlToCopy = ensureShareableCreatorRoom();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = urlToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = urlToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setQrInviteCopied(true);
    if (qrCopyTimerRef.current) clearTimeout(qrCopyTimerRef.current);
    qrCopyTimerRef.current = setTimeout(() => setQrInviteCopied(false), 2500);
  }, [ensureShareableCreatorRoom]);

  const handleDownloadTrackQr = useCallback(() => {
    if (!trackQrDataUrl) return;
    const a = document.createElement('a');
    a.href = trackQrDataUrl;
    a.download = `REI-RUN-${roomConfig.code}-QR.png`;
    a.click();
  }, [trackQrDataUrl, roomConfig.code]);

  const [trackQrCameraActive, setTrackQrCameraActive] = useState<boolean>(false);
  const [trackQrCameraError, setTrackQrCameraError] = useState<string | null>(null);
  const trackQrVideoRef = useRef<HTMLVideoElement | null>(null);
  const trackQrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackQrStreamRef = useRef<MediaStream | null>(null);

  const stopTrackQrCamera = useCallback(() => {
    if (trackQrStreamRef.current) {
      trackQrStreamRef.current.getTracks().forEach((tr) => tr.stop());
      trackQrStreamRef.current = null;
    }
    if (trackQrVideoRef.current) {
      trackQrVideoRef.current.srcObject = null;
    }
    setTrackQrCameraActive(false);
  }, []);

  useEffect(() => {
    if (!showTrackQr) {
      stopTrackQrCamera();
      setTrackQrCameraError(null);
    }
  }, [showTrackQr, stopTrackQrCamera]);

  useEffect(() => {
    return () => {
      stopTrackQrCamera();
    };
  }, [stopTrackQrCamera]);

  const startTrackQrScanner = useCallback(async () => {
    setTrackQrCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setTrackQrCameraError(t.lobby.cameraHint);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      trackQrStreamRef.current = stream;
      setTrackQrCameraActive(true);
      requestAnimationFrame(() => {
        if (trackQrVideoRef.current) {
          trackQrVideoRef.current.srcObject = stream;
          trackQrVideoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setTrackQrCameraError(t.lobby.manualCodeLabel);
      setTrackQrCameraActive(false);
    }
  }, [t.lobby.cameraHint, t.lobby.manualCodeLabel]);
  const [needsInviteOnboarding, setNeedsInviteOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (isInitialLocalCreator) return false;
    const params = new URLSearchParams(window.location.search);
    const hasRoom = Boolean(params.get('room') || params.get('sala'));
    if (!hasRoom) return false;
    const forceOnboard = params.get('new') === '1' || params.get('onboard') === '1';
    const profileReady = localStorage.getItem('rei_zero_profile_ready') === 'true';
    return forceOnboard || !profileReady;
  });
  const removedLocalIdsRef = useRef<Set<string>>(new Set());
  const startedFromRoomRef = useRef<boolean>(false);
  const viaInviteRef = useRef<boolean>(initialHasUrlRoom && !isInitialLocalCreator);
  const hasAutoOpenedInviteLobbyRef = useRef<boolean>(false);

  // Apenas o onboarding inicial de nome/avatar de um convidado bloqueia a largada;
  // abrir modais informativos (Regras, Loja, Tutorial, QR) nunca pode travar a sala inteira.
  const isLocalActivityBusy = needsInviteOnboarding;

  useEffect(() => {
    if (wsRoomSessionKey.startsWith('SOLO_IDLE_')) return;
    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:activity-state',
          roomCode: roomConfig.code,
          selectingProfile: Boolean(isLocalActivityBusy),
        })
      );
    }
  }, [isLocalActivityBusy, roomConfig.code, wsRoomSessionKey, serverRoomConnected]);

  const handleChangePlayerName = (newName: string) => {
    const clean = newName.trim() || 'REI ZERO';
    setPlayerName(clean);
    localStorage.setItem('rei_zero_player_name', clean);
    localStorage.setItem('rei_zero_profile_ready', 'true');
    setCompetitors((prev) =>
      prev.map((c) => (c.isPlayer ? { ...c, name: `${clean} ${t.youTag}` } : c))
    );
    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && !needsInviteOnboarding) {
      const av = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];
      ws.send(
        JSON.stringify({
          type: 'room:profile-ready',
          roomCode: roomConfig.code,
          player: {
            id: getSessionPlayerId(),
            name: clean,
            avatar: av.avatar,
            avatarId: av.id,
            color: av.color,
          },
        })
      );
    }
  };

  // Auto-abrir Lobby da Arena apenas uma vez quando o jogador convidado já escolheu seu avatar e nome
  useEffect(() => {
    if (typeof window !== 'undefined' && !needsInviteOnboarding && !hasAutoOpenedInviteLobbyRef.current) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') || params.get('sala')) {
        hasAutoOpenedInviteLobbyRef.current = true;
        const timer = setTimeout(() => {
          if (statusRef.current === 'idle' && !isSpectatingRef.current) {
            setLobbyOpen(true);
          }
        }, 1400);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [needsInviteOnboarding]);

  // Modal tutorial "Como Jogar" — exibido automaticamente apenas na primeira visita direta (não em links de convite)
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      tutorialShownThisSessionRef.current ||
      isLoadingScreen ||
      needsInviteOnboarding ||
      initialHasUrlRoom ||
      viaInviteRef.current ||
      isAdminRoute ||
      lobbyOpen ||
      showPodium ||
      status !== 'idle'
    ) {
      return;
    }
    try {
      const alreadySeen = localStorage.getItem('rei_zero_how_to_play_seen_v1') === 'true';
      if (alreadySeen) {
        tutorialShownThisSessionRef.current = true;
        return;
      }
      tutorialShownThisSessionRef.current = true;
      localStorage.setItem('rei_zero_how_to_play_seen_v1', 'true');
      setHowToPlayTutorialOpen(true);
    } catch {
      tutorialShownThisSessionRef.current = true;
    }
  }, [isLoadingScreen, needsInviteOnboarding, initialHasUrlRoom, isAdminRoute, lobbyOpen, showPodium, status]);

  // 10. 5 Concorrentes nas 5 Faixas (Largam juntos na mesma linha: yOffset = 0, distance = 0)
  const [competitors, setCompetitors] = useState<Competitor[]>(() => {
    return [
      {
        id: ANGOLAN_BOTS[0].id,
        name: ANGOLAN_BOTS[0].name,
        avatar: ANGOLAN_BOTS[0].avatar,
        avatarId: ANGOLAN_BOTS[0].avatarId,
        color: ANGOLAN_BOTS[0].color,
        lane: 0 as Lane, // Faixa 1
        targetLane: 0 as Lane,
        laneX: LANE_CENTERS[0],
        yOffset: 0,
        progressDistance: 0,
        action: 'running',
        jumpY: 0,
        isBot: true,
        isPlayer: false,
        stumbling: false,
        finished: false,
      },
      {
        id: ANGOLAN_BOTS[1].id,
        name: ANGOLAN_BOTS[1].name,
        avatar: ANGOLAN_BOTS[1].avatar,
        avatarId: ANGOLAN_BOTS[1].avatarId,
        color: ANGOLAN_BOTS[1].color,
        lane: 1 as Lane, // Faixa 2
        targetLane: 1 as Lane,
        laneX: LANE_CENTERS[1],
        yOffset: 0,
        progressDistance: 0,
        action: 'running',
        jumpY: 0,
        isBot: true,
        isPlayer: false,
        stumbling: false,
        finished: false,
      },
      {
        id: 'player-rei-zero',
        name: `${
          (AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0]).name
        } (Você)`,
        avatar: (AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0]).avatar,
        avatarId: selectedAvatarId,
        color: (AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0]).color,
        lane: 2 as Lane, // Faixa 3 (Centro)
        targetLane: 2 as Lane,
        laneX: LANE_CENTERS[2],
        yOffset: 0,
        progressDistance: 0,
        action: 'running',
        jumpY: 0,
        isBot: false,
        isPlayer: true,
        stumbling: false,
        finished: false,
      },
      {
        id: ANGOLAN_BOTS[2].id,
        name: ANGOLAN_BOTS[2].name,
        avatar: ANGOLAN_BOTS[2].avatar,
        avatarId: ANGOLAN_BOTS[2].avatarId,
        color: ANGOLAN_BOTS[2].color,
        lane: 3 as Lane, // Faixa 4
        targetLane: 3 as Lane,
        laneX: LANE_CENTERS[3],
        yOffset: 0,
        progressDistance: 0,
        action: 'running',
        jumpY: 0,
        isBot: true,
        isPlayer: false,
        stumbling: false,
        finished: false,
      },
      {
        id: ANGOLAN_BOTS[3].id,
        name: ANGOLAN_BOTS[3].name,
        avatar: ANGOLAN_BOTS[3].avatar,
        avatarId: ANGOLAN_BOTS[3].avatarId,
        color: ANGOLAN_BOTS[3].color,
        lane: 4 as Lane, // Faixa 5
        targetLane: 4 as Lane,
        laneX: LANE_CENTERS[4],
        yOffset: 0,
        progressDistance: 0,
        action: 'running',
        jumpY: 0,
        isBot: true,
        isPlayer: false,
        stumbling: false,
        finished: false,
      },
    ];
  });
  const competitorsRef = useRef<Competitor[]>(competitors);
  competitorsRef.current = competitors;

  // 11. Resultados e Histórico
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number>(1);
  const [history, setHistory] = useState<RoundHistory[]>(() => {
    const saved = localStorage.getItem('rei_zero_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Áudio e Trilha Sonora de Luanda
  useEffect(() => {
    sounds.enabled = soundEnabled;
    if (!soundEnabled) {
      sounds.stopRaceBgm();
      sounds.stopCelebrationAudio();
    } else {
      sounds.unlockAudio();
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (status === 'running' && soundEnabled) {
      sounds.playRaceBgm();
    } else {
      sounds.stopRaceBgm();
    }
  }, [status, soundEnabled]);

  // Garante faixas exclusivas preservando posições atribuídas pelo servidor (anfitrião=2, convidados=[1,3,0,4])
  const assignDistinctLanes = useCallback((list: Competitor[], resetProgress = false): Competitor[] => {
    const usedLanes = new Set<Lane>();
    const assignedLanes = new Map<string, Lane>();

    for (const c of list) {
      if (
        typeof c.lane === 'number' &&
        c.lane >= 0 &&
        c.lane <= 4 &&
        !usedLanes.has(c.lane as Lane)
      ) {
        const validLane = c.lane as Lane;
        usedLanes.add(validLane);
        assignedLanes.set(c.id, validLane);
      }
    }

    const fallbackOrder: Lane[] = [2, ...RIVAL_LANE_SLOTS];
    return list.map((c) => {
      let lane = assignedLanes.get(c.id);
      if (lane === undefined) {
        lane = fallbackOrder.find((l) => !usedLanes.has(l)) ?? 0;
        usedLanes.add(lane);
        assignedLanes.set(c.id, lane);
      }
      return {
        ...c,
        lane,
        targetLane: lane,
        laneX: LANE_CENTERS[lane],
        ...(resetProgress
          ? {
              yOffset: 0,
              progressDistance: 0,
              stumbling: false,
              finished: false,
              action: 'running' as const,
            }
          : {}),
      };
    });
  }, []);

  const connectedHumansCount = useMemo(
    () => competitors.filter((c) => !c.isBot && !c.id.startsWith('friend-')).length,
    [competitors]
  );

  // Reset de competidores alinhados rigorosamente da mesma linha em faixas distintas
  const resetCompetitors = useCallback(() => {
    setCompetitors((prev) => assignDistinctLanes(prev, true));
  }, [assignDistinctLanes]);

  // Rotaciona os competidores bots em partidas públicas/globais garantindo aposta igual e determinismo opcional
  const rotatePublicBotsInCompetitors = useCallback(
    (targetBetKz: number, forceReplaceBots = true, deterministicSeed?: number) => {
      const safeBet = clampBetKz(targetBetKz);
      setCompetitors((prev) => {
        const playerEntry = prev.find((c) => c.isPlayer);
        const remoteHumans = prev.filter((c) => !c.isPlayer && !c.isBot);
        const maxCap = clampRoomMax(roomConfigRef.current.maxPlayers, 5);
        const baseList: Competitor[] = [];
        if (playerEntry) {
          baseList.push({ ...playerEntry, betAmount: safeBet });
        }
        for (const h of remoteHumans) {
          if (baseList.length >= maxCap) break;
          baseList.push({ ...h, betAmount: safeBet });
        }
        const shouldFillBots =
          roomConfigRef.current.fillWithBots ||
          isAutoMatchRef.current ||
          roomConfigRef.current.accessMode === 'random';
        const neededBots = shouldFillBots ? Math.max(0, maxCap - baseList.length) : 0;
        if (neededBots === 0) {
          return assignDistinctLanes(baseList, true);
        }
        const currentBotIds = prev.filter((c) => c.isBot).map((b) => b.id);
        const excludeForRotation = forceReplaceBots
          ? Array.from(new Set([...previousPublicBotIdsRef.current, ...currentBotIds]))
          : previousPublicBotIdsRef.current;
        const pickedBots = pickRotatedPublicBots(
          neededBots,
          excludeForRotation,
          baseList.map((c) => c.id),
          deterministicSeed
        );
        previousPublicBotIdsRef.current = pickedBots.map((b) => b.id);
        const botCompetitors: Competitor[] = pickedBots.map((b, idx) => {
          const localized = getLocalizedBot(b.id, lang);
          const botLane = (RIVAL_LANE_SLOTS[idx % RIVAL_LANE_SLOTS.length] ?? 0) as Lane;
          return {
            id: b.id,
            name: localized.name || b.name,
            avatar: b.avatar,
            avatarId: b.avatarId,
            color: b.color,
            lane: botLane,
            targetLane: botLane,
            laneX: LANE_CENTERS[botLane],
            yOffset: 0,
            progressDistance: 0,
            action: 'running',
            jumpY: 0,
            isBot: true,
            isPlayer: false,
            stumbling: false,
            finished: false,
            betAmount: safeBet,
          };
        });
        return assignDistinctLanes([...baseList, ...botCompetitors].slice(0, maxCap), true);
      });
    },
    [assignDistinctLanes, lang]
  );
  rotatePublicBotsInCompetitorsRef.current = rotatePublicBotsInCompetitors;

  // Gestão segura dos timers de contagem regressiva
  const countdownTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const countdownRafRef = useRef<number | null>(null);

  const clearCountdownTimers = useCallback(() => {
    countdownTimersRef.current.forEach((id) => clearTimeout(id));
    countdownTimersRef.current = [];
    if (countdownRafRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(countdownRafRef.current);
      countdownRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCountdownTimers();
      if (finishFallbackTimerRef.current) clearTimeout(finishFallbackTimerRef.current);
    };
  }, [clearCountdownTimers]);

  const alignTrackToTop = useCallback((behavior: ScrollBehavior, onlyIfOffscreen = false) => {
    if (typeof window === 'undefined') return;
    const trackEl =
      document.getElementById('race-track-canvas') ||
      document.getElementById('race-track-section');
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    if (onlyIfOffscreen && rect.top >= -12 && rect.top <= 80 && rect.bottom <= window.innerHeight + 24) {
      return;
    }
    trackEl.scrollIntoView({ behavior, block: 'start' });
  }, []);

  // Retorno limpo ao lobby ou sala após o fim da corrida (mantendo todos os participantes unidos na mesma sala)
  const handleReturnToLobby = useCallback(() => {
    if (statusRef.current === 'starting' || statusRef.current === 'running') {
      return;
    }
    const returningFromSpectator = isSpectatingRef.current || wasSpectatorOutcome;
    const isPublicMatch = isAutoMatchRef.current || roomConfig.accessMode === 'random';
    const shouldRotateBotsInRoom = isPublicMatch && publicRoundCompletedRef.current;
    clearCountdownTimers();
    if (finishFallbackTimerRef.current) {
      clearTimeout(finishFallbackTimerRef.current);
      finishFallbackTimerRef.current = null;
    }
    remotePlayersRef.current.clear();
    isSpectatingRef.current = false;
    setIsSpectating(false);
    setSpectatedRunnerId(null);
    setWasSpectatorOutcome(false);
    setTop3Celebration(null);
    setShowPodium(false);
    setPendingSyncPodium(false);
    setAuthoritativeRankings(null);
    setWaitingForOpponent(false);
    setWaitingOpponentNames([]);
    setCountdownValue(null);
    setRaceSeed(null);
    setSyncedRaceStartAt(null);
    statusRef.current = 'idle';
    setStatus('idle');
    setElapsedSeconds(0);
    setCoinsCollected(0);
    if (shouldRotateBotsInRoom) {
      publicRoundCompletedRef.current = false;
      const nextSeed =
        Array.from(roomConfig.code).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7) +
        (serverRaceRoundRef.current || activeRaceRoundRef.current || 1) * 7919;
      rotatePublicBotsInCompetitors(clampBetKz(roomConfig.betAmount || betAmount), true, nextSeed);
    } else {
      resetCompetitors();
    }
    setRoundNonce((n) => n + 1);

    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (returningFromSpectator) {
        ws.send(
          JSON.stringify({
            type: 'room:spectate-state',
            roomCode: roomConfig.code,
            isSpectating: false,
          })
        );
      } else {
        ws.send(JSON.stringify({ type: 'room:return-lobby', roomCode: roomConfig.code }));
      }
    }

    if (applyServerRoomStateRef.current) {
      applyServerRoomStateRef.current(true);
    }

    if (startedFromRoomRef.current || returningFromSpectator) {
      setLobbyOpen(true);
    } else if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        const betEl = document.getElementById('betting-panel-section');
        if (betEl) {
          betEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, [
    betAmount,
    clearCountdownTimers,
    resetCompetitors,
    roomConfig.accessMode,
    roomConfig.betAmount,
    roomConfig.code,
    rotatePublicBotsInCompetitors,
    wasSpectatorOutcome,
  ]);

  // Aplica o desfecho oficial de uma corrida (pódio, payout, saldo, histórico, streak e missões)
  const applyCompletedRaceOutcome = useCallback(
    (
      finalCompetitors: Competitor[],
      usedBet: number,
      performance?: RacePerformanceMetrics | null,
      serverRankings?: RoomStandingEntry[] | null,
      spectated?: boolean
    ) => {
      const roundNum = activeRaceRoundRef.current;
      const roundKey = `${(roomConfigRef.current.code || 'ARENA').toUpperCase()}:${roundNum}`;
      if (roundNum > 0) {
        if (finalizedRoundSetRef.current.has(roundKey)) return;
        finalizedRoundSetRef.current.add(roundKey);
      }

      if (finishFallbackTimerRef.current) {
        clearTimeout(finishFallbackTimerRef.current);
        finishFallbackTimerRef.current = null;
      }

      const spectatedOutcome = Boolean(spectated ?? isSpectatingRef.current);
      isSpectatingRef.current = false;
      setIsSpectating(false);
      setSpectatedRunnerId(null);
      setWasSpectatorOutcome(spectatedOutcome);

      sounds.stopRaceBgm();
      statusRef.current = 'completed';
      setStatus('completed');
      setPendingSyncPodium(false);
      if (performance !== undefined) {
        setLastPerformance(spectatedOutcome ? null : performance ?? null);
      }

      const myId = getSessionPlayerId();
      const effectiveBet = clampBetKz(usedBet);

      const resolveWeightedPayoutForOutcome = (
        targetRank: number,
        racers: Competitor[],
        stakeKz: number
      ) => {
        const nonSpectators = racers.filter((c) => !c.isSpectating);
        const rawCount = nonSpectators.length > 0 ? nonSpectators.length : racers.length;
        // Valida explicitamente partidas de 2, 3, 4 ou 5 jogadores
        const validatedPlayerCount: 2 | 3 | 4 | 5 =
          rawCount <= 2 ? 2 : rawCount === 3 ? 3 : rawCount === 4 ? 4 : 5;

        const split = calculateThreeTorneiras(stakeKz, validatedPlayerCount);

        // Garante integridade matemática das porcentagens (100%) e conservação exata do pote
        const pctSum =
          Math.round(
            ((split.firstPercent ?? 0) +
              (split.secondPercent ?? 0) +
              (split.thirdPercent ?? 0) +
              (split.housePercent ?? 0) +
              (split.creatorPercent ?? 0)) *
              10
          ) / 10;
        const potSum =
          split.firstPrizeKz +
          split.secondPrizeKz +
          split.thirdPrizeKz +
          split.houseFeeKz +
          split.creatorRoyaltyKz;

        if (pctSum !== 100 || potSum !== split.totalPotKz) {
          const safePot = stakeKz * validatedPlayerCount;
          const fallbackFirst = Math.floor(safePot * 0.5);
          const fallbackThird = validatedPlayerCount >= 4 ? stakeKz : 0;
          const fallbackSecond =
            validatedPlayerCount >= 3
              ? Math.max(0, Math.min(safePot - fallbackFirst - fallbackThird, Math.floor(safePot * 0.2)))
              : 0;
          if (targetRank === 1) return fallbackFirst;
          if (targetRank === 2) return fallbackSecond;
          if (targetRank === 3) return fallbackThird;
          return 0;
        }

        if (targetRank === 1) return split.firstPrizeKz;
        if (targetRank === 2) return split.secondPrizeKz;
        if (targetRank === 3) return split.thirdPrizeKz; // Devolução da aposta em 4–5J; 0 em 3J (último)
        return 0; // 4º e 5º lugares perdem sempre
      };

      let displayCompetitors = finalCompetitors;
      let rank = 1;
      let payout = 0;

      if (serverRankings && serverRankings.length > 0) {
        const mergedById = new Map(serverRankings.map((r) => [r.id, r]));
        displayCompetitors = serverRankings.map((r) => {
          const localMatch = finalCompetitors.find(
            (c) => c.id === r.id || (!spectatedOutcome && r.id === myId && c.isPlayer)
          );
          const isMeActive = !spectatedOutcome && r.id === myId;
          return {
            id: r.id,
            name: isMeActive ? (localMatch?.name || `${r.name} ${t.youTag}`) : r.name,
            avatar: r.avatar,
            avatarId: r.avatarId,
            color: r.color,
            lane: (Math.max(0, Math.min(4, r.lane)) as Lane),
            targetLane: (Math.max(0, Math.min(4, r.lane)) as Lane),
            laneX: LANE_CENTERS[Math.max(0, Math.min(4, r.lane)) as Lane],
            yOffset: 0,
            progressDistance: r.progressDistance,
            action: 'running' as const,
            jumpY: 0,
            isBot: r.isBot,
            isPlayer: isMeActive,
            stumbling: false,
            finished: true,
            rank: r.rank,
          };
        });

        const normalizedServerRankings: RoomStandingEntry[] = serverRankings.map((entry) => ({
          ...entry,
          betAmount: entry.betAmount || effectiveBet,
          payoutKz: resolveWeightedPayoutForOutcome(
            entry.rank,
            displayCompetitors,
            entry.betAmount || effectiveBet
          ),
        }));
        setAuthoritativeRankings(normalizedServerRankings);

        if (!spectatedOutcome) {
          const myEntry = mergedById.get(myId);
          if (myEntry) {
            rank = myEntry.rank;
            payout = resolveWeightedPayoutForOutcome(rank, displayCompetitors, effectiveBet);
          } else {
            const sortedLocal = [...displayCompetitors].sort(
              (a, b) => b.progressDistance - a.progressDistance
            );
            rank = Math.max(1, sortedLocal.findIndex((c) => c.isPlayer) + 1);
            payout = resolveWeightedPayoutForOutcome(rank, displayCompetitors, effectiveBet);
          }
        }
      } else {
        setAuthoritativeRankings(null);
        const sorted = [...finalCompetitors].sort(
          (a, b) => b.progressDistance - a.progressDistance
        );
        const rankById = new Map(sorted.map((c, idx) => [c.id, idx + 1]));
        displayCompetitors = finalCompetitors.map((c) => ({
          ...c,
          rank: rankById.get(c.id) ?? c.rank,
        }));
        if (!spectatedOutcome) {
          rank = Math.max(1, sorted.findIndex((c) => c.isPlayer) + 1);
          payout = resolveWeightedPayoutForOutcome(rank, displayCompetitors, effectiveBet);
        }
      }

      setCompetitors(displayCompetitors);

      if (!spectatedOutcome && (isAutoMatchRef.current || roomConfigRef.current.accessMode === 'random')) {
        publicRoundCompletedRef.current = true;
        const finishedBotIds = displayCompetitors.filter((c) => c.isBot).map((c) => c.id);
        if (finishedBotIds.length > 0) {
          previousPublicBotIdsRef.current = finishedBotIds;
        }
      }

      if (spectatedOutcome) {
        setUserRank(1);
        setLastPayout(0);
        setShowPodium(true);
        return;
      }

      setUserRank(rank);
      setLastPayout(payout);
      if (payout > 0) {
        setBalance((prev) => prev + payout);
      }

      if (rank === 1) {
        sounds.playVictoryFanfare();
      } else if (rank >= 2 && rank <= 3) {
        sounds.playTopThreeCelebration(rank);
      }

      if (rank === 1 || rank === 2 || rank === 3) {
        const nextStreak = top3StreakRef.current + 1;
        top3StreakRef.current = nextStreak;
        setTop3Streak(nextStreak);
        localStorage.setItem('rei_zero_top3_streak', nextStreak.toString());
        setTop3Celebration({
          key: Date.now(),
          rank,
          streak: nextStreak,
        });
      } else {
        top3StreakRef.current = 0;
        setTop3Streak(0);
        localStorage.setItem('rei_zero_top3_streak', '0');
        setTop3Celebration(null);
      }

      setShowPodium(true);

      const entry: RoundHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        betAmount: effectiveBet,
        timeSeconds: TOTAL_GAME_TIME_SECONDS,
        won: payout > effectiveBet,
        payout,
        playerRank: rank,
        totalPlayers: displayCompetitors.length,
        currency: 'KZ',
      };
      setHistory((prev) => {
        const updated = [entry, ...prev.slice(0, 19)];
        localStorage.setItem('rei_zero_history', JSON.stringify(updated));
        return updated;
      });

      saveRaceRecord({
        roomCode: roomConfig.code,
        roomTitle: roomConfig.title,
        betAmount: effectiveBet,
        playerRank: rank,
        distanceMeters: Math.floor(displayCompetitors.find((c) => c.isPlayer)?.progressDistance || 0),
        coinsCollected,
        prizeKz: payout,
        streak: rank <= 3 ? top3Streak + 1 : 0,
      });

      setDailyMissionsState((prev) => {
        const todayKey = getLocalDateKey();
        const base =
          prev.dateKey === todayKey ? prev : createFreshDailyMissionsState(todayKey);
        return {
          ...base,
          stats: {
            ...base.stats,
            races: base.stats.races + 1,
            podiums: base.stats.podiums + (rank <= 3 ? 1 : 0),
            wins: base.stats.wins + (rank === 1 ? 1 : 0),
          },
        };
      });
    },
    [setBalance, roomConfig.code, roomConfig.title, coinsCollected, top3Streak, t.youTag]
  );

  // Entrar como Observador Fantasma (Spectator Mode) numa corrida já a decorrer na sala
  const handleEnterSpectatorMode = useCallback(() => {
    if (statusRef.current !== 'idle') return;
    if (wsRoomSessionKey.startsWith('SOLO_IDLE_')) return;
    if (serverRaceStatusRef.current !== 'running' && serverRaceStatusRef.current !== 'starting') {
      return;
    }

    const myId = getSessionPlayerId();
    const serverRoom = latestServerRoomRef.current;
    const roundNum = serverRaceRoundRef.current || serverRoom?.raceRound || 1;
    const seedVal = serverRaceSeedRef.current ?? serverRoom?.raceSeed ?? null;
    const rawStartAt = serverRaceStartAtRef.current ?? serverRoom?.syncedRaceStartAt ?? serverRoom?.raceStartAt;
    const localStartAt =
      typeof rawStartAt === 'number'
        ? rawStartAt - serverClockOffsetRef.current
        : Date.now();

    const activeParticipants = (serverRoom?.participants || []).filter(
      (p) => p.id !== myId && p.isSpectating !== true && p.connected !== false
    );

    const activeInvestigations = telemetryValidatorRef.current.getInvestigations();
    const spectatorList: Competitor[] = [];

    for (let i = 0; i < activeParticipants.length; i++) {
      const p = activeParticipants[i];
      const snap = remotePlayersRef.current.get(p.id);
      const laneNum = (typeof (snap?.lane ?? p.lane) === 'number'
        ? Math.max(0, Math.min(4, Number(snap?.lane ?? p.lane)))
        : (RIVAL_LANE_SLOTS[i % RIVAL_LANE_SLOTS.length] as Lane)) as Lane;
      const targetLaneNum = (typeof (snap?.targetLane ?? p.targetLane ?? laneNum) === 'number'
        ? Math.max(0, Math.min(4, Number(snap?.targetLane ?? p.targetLane ?? laneNum)))
        : laneNum) as Lane;
      const dist = snap?.progressDistance ?? Number(p.progressDistance || 0);
      const laneXVal =
        typeof (snap?.laneX ?? p.laneX) === 'number'
          ? Number(snap?.laneX ?? p.laneX)
          : LANE_CENTERS[targetLaneNum];
      const act = (snap?.action ?? (p.action as Competitor['action'])) || 'running';
      const jumpVal = snap?.jumpY ?? Number(p.jumpY || 0);

      remotePlayersRef.current.set(p.id, {
        playerId: p.id,
        progressDistance: dist,
        lane: laneNum,
        targetLane: targetLaneNum,
        laneX: laneXVal,
        action: act,
        jumpY: jumpVal,
        stumbling: Boolean(snap?.stumbling ?? p.stumbling),
        finished: Boolean(snap?.finished ?? p.finished),
        updatedAt: snap?.updatedAt || Date.now(),
      });

      spectatorList.push({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        avatarId: p.avatarId,
        color: p.color,
        lane: laneNum,
        targetLane: targetLaneNum,
        laneX: laneXVal,
        yOffset: 0,
        progressDistance: dist,
        action: act,
        jumpY: jumpVal,
        isBot: false,
        isPlayer: false,
        isHost: p.isHost,
        isRemoteHuman: true,
        profileReady: true,
        betAmount: typeof p.betAmount === 'number' ? clampBetKz(p.betAmount) : serverRoom?.betAmount ?? betAmountRef.current,
        sessionStatus: activeInvestigations[p.id]?.sessionStatus ?? p.sessionStatus ?? 'normal',
        stumbling: Boolean(snap?.stumbling ?? p.stumbling),
        finished: Boolean(snap?.finished ?? p.finished),
      });
    }

    if (spectatorList.length === 0) {
      competitorsRef.current
        .filter((c) => !c.isPlayer)
        .forEach((c) => spectatorList.push({ ...c, isPlayer: false }));
    }
    if (spectatorList.length === 0) {
      const b = ANGOLAN_BOTS[0];
      spectatorList.push({
        id: b.id,
        name: b.name,
        avatar: b.avatar,
        avatarId: b.avatarId,
        color: b.color,
        lane: 2,
        targetLane: 2,
        laneX: LANE_CENTERS[2],
        yOffset: 0,
        progressDistance: 0,
        action: 'running',
        jumpY: 0,
        isBot: true,
        isPlayer: false,
        stumbling: false,
        finished: false,
      });
    }

    clearCountdownTimers();
    if (finishFallbackTimerRef.current) {
      clearTimeout(finishFallbackTimerRef.current);
      finishFallbackTimerRef.current = null;
    }

    activeRaceRoundRef.current = roundNum;
    setActiveRaceRound(roundNum);
    activeBetForRoundRef.current = clampBetKz(serverRoom?.betAmount ?? betAmountRef.current);
    telemetryValidatorRef.current.setSessionContext({
      roomCode: roomConfig.code,
      raceRound: roundNum,
      reporterId: myId,
    });

    isSpectatingRef.current = true;
    setIsSpectating(true);
    setSpectatedRunnerId(null);
    setWasSpectatorOutcome(false);
    setCompetitors(spectatorList);
    setRaceSeed(seedVal);
    setSyncedRaceStartAt(localStartAt);
    setLobbyOpen(false);
    setShowPodium(false);
    setAuthoritativeRankings(null);
    setPendingSyncPodium(false);
    setLastPerformance(null);
    setCoinsCollected(0);
    setElapsedSeconds(
      Math.max(0, Math.min(TOTAL_GAME_TIME_SECONDS, (Date.now() - localStartAt) / 1000))
    );
    setRoundNonce((n) => n + 1);

    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:spectate-state',
          roomCode: roomConfig.code,
          isSpectating: true,
        })
      );
    }

    if (localStartAt > Date.now() + 250 && serverRaceStatusRef.current === 'starting') {
      statusRef.current = 'starting';
      setStatus('starting');
      const rem = Math.max(250, localStartAt - Date.now());
      setCountdownValue(Math.max(1, Math.min(3, Math.ceil(rem / 1000))));
      countdownTimersRef.current.push(
        setTimeout(() => {
          setCountdownValue(null);
          statusRef.current = 'running';
          setStatus('running');
        }, rem)
      );
    } else {
      setCountdownValue(null);
      statusRef.current = 'running';
      setStatus('running');
    }

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => alignTrackToTop('smooth'));
    }
  }, [alignTrackToTop, clearCountdownTimers, roomConfig.code, wsRoomSessionKey]);

  const handleEnterSpectatorWithFocus = useCallback(
    (focusRunnerId?: string | null) => {
      handleEnterSpectatorMode();
      if (focusRunnerId) {
        setSpectatedRunnerId(focusRunnerId);
      }
    },
    [handleEnterSpectatorMode]
  );

  const handleExitSpectatorMode = useCallback(() => {
    clearCountdownTimers();
    if (finishFallbackTimerRef.current) {
      clearTimeout(finishFallbackTimerRef.current);
      finishFallbackTimerRef.current = null;
    }
    isSpectatingRef.current = false;
    setIsSpectating(false);
    setSpectatedRunnerId(null);
    setWasSpectatorOutcome(false);
    setSpectatorOverviewOpen(false);
    setLiveCanvasRunners([]);
    setCountdownValue(null);
    statusRef.current = 'idle';
    setStatus('idle');
    setElapsedSeconds(0);
    setShowPodium(false);
    setPendingSyncPodium(false);

    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:spectate-state',
          roomCode: roomConfig.code,
          isSpectating: false,
        })
      );
    }

    if (applyServerRoomStateRef.current) {
      applyServerRoomStateRef.current(true);
    } else {
      resetCompetitors();
    }
    setLobbyOpen(true);
  }, [clearCountdownTimers, resetCompetitors, roomConfig.code]);

  useEffect(() => {
    if (showPodium && spectatorOverviewOpen) {
      setSpectatorOverviewOpen(false);
    }
  }, [showPodium, spectatorOverviewOpen]);

  useEffect(() => {
    if (!spectatorOverviewOpen) return;
    if (isSpectating) return;
    if (serverRaceStatus !== 'running' && serverRaceStatus !== 'starting') return;

    const timer = setInterval(() => {
      setSpectatorOverviewTick((tick) => tick + 1);
    }, 220);
    return () => clearInterval(timer);
  }, [spectatorOverviewOpen, isSpectating, serverRaceStatus]);

  const { overviewRunners, overviewElapsedSeconds } = useMemo(() => {
    void spectatorOverviewTick;
    if (isSpectating) {
      const source = liveCanvasRunners.length > 0 ? liveCanvasRunners : competitors;
      return {
        overviewRunners: source,
        overviewElapsedSeconds: elapsedSeconds,
      };
    }

    const myId = getSessionPlayerId();
    const serverRoom = latestServerRoomRef.current;
    const activeInvestigations = telemetryValidatorRef.current.getInvestigations();
    const serverParticipants = (serverRoom?.participants || []).filter(
      (p) => p.connected !== false && p.isSpectating !== true
    );

    let mergedRunners: Competitor[] = [];
    if (serverParticipants.length > 0) {
      mergedRunners = serverParticipants.map((p, idx) => {
        const snap = remotePlayersRef.current.get(p.id);
        const laneVal = (typeof (snap?.lane ?? p.lane) === 'number'
          ? Math.max(0, Math.min(4, Number(snap?.lane ?? p.lane)))
          : (RIVAL_LANE_SLOTS[idx % RIVAL_LANE_SLOTS.length] as Lane)) as Lane;
        const targetLaneVal = (typeof (snap?.targetLane ?? p.targetLane ?? laneVal) === 'number'
          ? Math.max(0, Math.min(4, Number(snap?.targetLane ?? p.targetLane ?? laneVal)))
          : laneVal) as Lane;
        const distVal = snap?.progressDistance ?? Number(p.progressDistance || 0);
        const laneXVal =
          typeof (snap?.laneX ?? p.laneX) === 'number'
            ? Number(snap?.laneX ?? p.laneX)
            : LANE_CENTERS[targetLaneVal];

        return {
          id: p.id,
          name: p.id === myId ? `${p.name} ${t.youTag}` : p.name,
          avatar: p.avatar,
          avatarId: p.avatarId,
          color: p.color,
          lane: laneVal,
          targetLane: targetLaneVal,
          laneX: laneXVal,
          yOffset: 0,
          progressDistance: distVal,
          action: (snap?.action ?? (p.action as PlayerAction)) || 'running',
          jumpY: snap?.jumpY ?? Number(p.jumpY || 0),
          isBot: false,
          isPlayer: p.id === myId,
          isHost: p.isHost,
          isRemoteHuman: p.id !== myId,
          profileReady: p.profileReady !== false && !p.selectingProfile,
          betAmount:
            typeof p.betAmount === 'number'
              ? clampBetKz(p.betAmount)
              : serverRoom?.betAmount ?? betAmountRef.current,
          sessionStatus: activeInvestigations[p.id]?.sessionStatus ?? p.sessionStatus ?? 'normal',
          stumbling: Boolean(snap?.stumbling ?? p.stumbling),
          finished: Boolean(snap?.finished ?? p.finished),
        };
      });
    } else {
      mergedRunners = competitors.filter((c) => !c.isSpectating);
    }

    const rawStartAt =
      serverRaceStartAtRef.current ?? serverRoom?.syncedRaceStartAt ?? serverRoom?.raceStartAt;
    const localStartAt =
      typeof rawStartAt === 'number' ? rawStartAt - serverClockOffsetRef.current : null;
    const computedElapsed =
      serverRaceStatus === 'completed'
        ? TOTAL_GAME_TIME_SECONDS
        : localStartAt && (serverRaceStatus === 'running' || serverRaceStatus === 'starting')
        ? Math.max(0, Math.min(TOTAL_GAME_TIME_SECONDS, (Date.now() - localStartAt) / 1000))
        : elapsedSeconds;

    return {
      overviewRunners: mergedRunners,
      overviewElapsedSeconds: computedElapsed,
    };
  }, [
    spectatorOverviewTick,
    isSpectating,
    liveCanvasRunners,
    competitors,
    elapsedSeconds,
    serverRaceStatus,
    t.youTag,
  ]);

  // Início da corrida (exclusivo do líder criador em salas sincronizadas)
  const handleStartRound = (fromRoom = false) => {
    if (isSpectatingRef.current) return;
    const inMultiplayerContext =
      !wsRoomSessionKey.startsWith('SOLO_IDLE_') ||
      viaInviteRef.current ||
      initialHasUrlRoom;
    if (inMultiplayerContext && !isLocalRoomHost) {
      setRoomNotice(mpStrings.onlyHostCanStart);
      return;
    }

    const effectiveBet = clampBetKz(fromRoom ? roomConfig.betAmount : betAmount);
    if (balance < effectiveBet || status === 'running' || status === 'starting') return;
    if (Date.now() < startRequestLockUntilRef.current) return;

    sounds.unlockAudio();
    setTop3Celebration(null);

    const inServerRoomSession =
      !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
      (serverRoomConnected ||
        viaInviteRef.current ||
        initialHasUrlRoom ||
        connectedHumansCount > 1 ||
        serverHumansCountRef.current > 1 ||
        !isAutoMatchRef.current);
    const ws = roomWsRef.current;

    const isPublicMatch = isAutoMatchRef.current || roomConfig.accessMode === 'random';

    if (inServerRoomSession) {
      if (
        statusRef.current === 'idle' &&
        (serverRaceStatusRef.current === 'running' || serverRaceStatusRef.current === 'starting')
      ) {
        handleEnterSpectatorMode();
        return;
      }
      if (!isLocalRoomHost) {
        setRoomNotice(mpStrings.onlyHostCanStart);
        return;
      }
      if (
        !isPublicMatch &&
        !roomConfig.fillWithBots &&
        competitorsRef.current.length < 2 &&
        serverHumansCountRef.current < 2
      ) {
        setRoomNotice(mpStrings.waitingMorePlayersToStart);
        return;
      }
      if (isPublicMatch) {
        publicRoundCompletedRef.current = false;
      }
      startRequestLockUntilRef.current = Date.now() + 1200;
      startedFromRoomRef.current = fromRoom || lobbyOpen;
      setRoomNotice(null);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room:start-request', roomCode: roomConfig.code }));
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        fetch(`/api/rooms/${encodeURIComponent(roomConfig.code)}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requesterId: getSessionPlayerId() }),
        })
          .then(async (resp) => {
            const data = (await resp.json().catch(() => ({}))) as {
              ok?: boolean;
              onlyHost?: boolean;
              started?: boolean;
              syncedRaceStartAt?: number | null;
              waitingNames?: string[];
              serverTime?: number;
              room?: Parameters<NonNullable<typeof beginSynchronizedCountdownRef.current>>[0]['room'];
            };
            if (resp.status === 403 && data.onlyHost) {
              setRoomNotice(mpStrings.onlyHostCanStart);
              return;
            }
            if (data.ok && data.room) {
              const targetStart = data.syncedRaceStartAt ?? data.room.syncedRaceStartAt ?? data.room.raceStartAt;
              if (
                data.started &&
                typeof targetStart === 'number' &&
                typeof data.room.raceRound === 'number' &&
                typeof data.room.raceSeed === 'number' &&
                beginSynchronizedCountdownRef.current
              ) {
                beginSynchronizedCountdownRef.current({
                  room: data.room,
                  raceRound: data.room.raceRound,
                  raceSeed: data.room.raceSeed,
                  raceStartAt: targetStart,
                  betAmount: data.room.betAmount,
                  serverTime: data.serverTime,
                });
              } else {
                setWaitingForOpponent(true);
                setWaitingOpponentNames(Array.isArray(data.waitingNames) ? data.waitingNames : []);
              }
            } else {
              setWsReconnectNonce((n) => n + 1);
            }
          })
          .catch(() => {
            setWsReconnectNonce((n) => n + 1);
          });
      } else {
        setWsReconnectNonce((n) => n + 1);
      }
      // Nunca cair para partida local isolada quando o jogador está numa sala multijogador
      return;
    }

    if (betAmount !== effectiveBet) {
      setBetAmount(effectiveBet);
    }

    startedFromRoomRef.current = fromRoom;
    activeRaceRoundRef.current = 0;
    setActiveRaceRound(0);
    activeBetForRoundRef.current = effectiveBet;
    remotePlayersRef.current.clear();
    setAuthoritativeRankings(null);
    setPendingSyncPodium(false);
    setRaceSeed(null);
    setSyncedRaceStartAt(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('rei_zero_profile_ready', 'true');
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    clearCountdownTimers();
    statusRef.current = 'starting';
    setBalance((prev) => prev - effectiveBet);
    setElapsedSeconds(0);
    setCoinsCollected(0);
    setLastPerformance(null);
    if (isPublicMatch && publicRoundCompletedRef.current) {
      publicRoundCompletedRef.current = false;
      rotatePublicBotsInCompetitors(effectiveBet, true);
    } else {
      resetCompetitors();
    }
    setRoundNonce((n) => n + 1);
    setLobbyOpen(false);
    setShowPodium(false);
    setStatus('starting');
    setLastPayout(null);

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => alignTrackToTop('smooth'));
      countdownTimersRef.current.push(
        setTimeout(() => alignTrackToTop('auto'), 420)
      );
    }

    const STEP_INTERVAL_MS = 650;
    const GO_DURATION_MS = 650;
    const startPerfMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const firedSteps = { s3: false, s2: false, s1: false, s0: false, run: false };

    const triggerStep = (step: 's3' | 's2' | 's1' | 's0' | 'run') => {
      if (firedSteps[step]) return;
      firedSteps[step] = true;
      if (step === 's3') {
        setCountdownValue(3);
        sounds.playCountdownTick();
      } else if (step === 's2') {
        setCountdownValue(2);
        sounds.playCountdownTick();
      } else if (step === 's1') {
        setCountdownValue(1);
        sounds.playCountdownTick();
      } else if (step === 's0') {
        setCountdownValue(0);
        sounds.playCountdownGo();
      } else {
        if (countdownRafRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(countdownRafRef.current);
          countdownRafRef.current = null;
        }
        setCountdownValue(null);
        alignTrackToTop('auto', true);
        statusRef.current = 'running';
        setStatus('running');
      }
    };

    triggerStep('s3');

    if (typeof requestAnimationFrame !== 'undefined') {
      const monitorCountdown = () => {
        const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsed = nowPerf - startPerfMs;
        if (elapsed >= STEP_INTERVAL_MS && !firedSteps.s2) triggerStep('s2');
        if (elapsed >= STEP_INTERVAL_MS * 2 && !firedSteps.s1) triggerStep('s1');
        if (elapsed >= STEP_INTERVAL_MS * 3 && !firedSteps.s0) triggerStep('s0');
        if (elapsed >= STEP_INTERVAL_MS * 3 + GO_DURATION_MS && !firedSteps.run) {
          triggerStep('run');
          return;
        }
        if (!firedSteps.run) {
          countdownRafRef.current = requestAnimationFrame(monitorCountdown);
        }
      };
      countdownRafRef.current = requestAnimationFrame(monitorCountdown);
    }

    countdownTimersRef.current.push(
      setTimeout(() => triggerStep('s2'), STEP_INTERVAL_MS),
      setTimeout(() => triggerStep('s1'), STEP_INTERVAL_MS * 2),
      setTimeout(() => triggerStep('s0'), STEP_INTERVAL_MS * 3),
      setTimeout(() => triggerStep('run'), STEP_INTERVAL_MS * 3 + GO_DURATION_MS)
    );
  };

  // Envia telemetria em tempo real da corrida do jogador local para os adversários na sala
  const handleLocalRaceTelemetry = useCallback(
    (telemetry: LocalRunnerTelemetry) => {
      if (isSpectatingRef.current) return;
      const ws = roomWsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (activeRaceRoundRef.current <= 0) return;
      ws.send(
        JSON.stringify({
          type: 'room:race-telemetry',
          roomCode: roomConfig.code,
          raceRound: activeRaceRoundRef.current,
          progressDistance: telemetry.progressDistance,
          lane: telemetry.lane,
          targetLane: telemetry.targetLane,
          laneX: telemetry.laneX,
          action: telemetry.action,
          jumpY: telemetry.jumpY,
          stumbling: telemetry.stumbling,
          finished: telemetry.finished,
        })
      );
    },
    [roomConfig.code]
  );

  // Fim da corrida após os 40 segundos exatos
  const handleRaceFinish = useCallback(
    (finalCompetitors: Competitor[], performance?: RacePerformanceMetrics) => {
      const spectatingNow = isSpectatingRef.current;
      sounds.stopRaceBgm();
      statusRef.current = 'completed';
      setStatus('completed');
      setCompetitors(finalCompetitors);
      setLastPerformance(spectatingNow ? null : performance ?? null);
      void telemetryValidatorRef.current.flushBatch();

      const usedBet = activeBetForRoundRef.current || betAmount;
      const roundNum = activeRaceRoundRef.current;
      const roundTrackKey = `${(roomConfig.code || 'ARENA').toUpperCase()}:${roundNum}`;
      const ws = roomWsRef.current;
      const inServerRoom =
        roundNum > 0 &&
        !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
        ws &&
        ws.readyState === WebSocket.OPEN;
      const hasMultiHumans =
        connectedHumansCount > 1 || serverHumansCountRef.current > 1 || spectatingNow;

      if (spectatingNow) {
        if (inServerRoom) {
          setPendingSyncPodium(true);
          if (finishFallbackTimerRef.current) clearTimeout(finishFallbackTimerRef.current);
          finishFallbackTimerRef.current = setTimeout(() => {
            if (!finalizedRoundSetRef.current.has(roundTrackKey)) {
              applyCompletedRaceOutcome(finalCompetitors, usedBet, null, null, true);
            }
          }, 1800);
          return;
        }
        applyCompletedRaceOutcome(finalCompetitors, usedBet, null, null, true);
        return;
      }

      if (inServerRoom && ws) {
        const playerComp = finalCompetitors.find((c) => c.isPlayer);
        setPendingSyncPodium(true);
        ws.send(
          JSON.stringify({
            type: 'room:race-finish',
            roomCode: roomConfig.code,
            raceRound: roundNum,
            progressDistance: playerComp?.progressDistance || 0,
            bots: finalCompetitors
              .filter((c) => c.isBot || c.id.startsWith('friend-'))
              .map((b) => ({
                id: b.id,
                name: b.name,
                avatar: b.avatar,
                avatarId: b.avatarId,
                color: b.color,
                lane: b.lane,
                progressDistance: b.progressDistance,
              })),
          })
        );

        if (finishFallbackTimerRef.current) clearTimeout(finishFallbackTimerRef.current);
        finishFallbackTimerRef.current = setTimeout(() => {
          if (!finalizedRoundSetRef.current.has(roundTrackKey)) {
            applyCompletedRaceOutcome(finalCompetitors, usedBet, performance, null);
          }
        }, hasMultiHumans ? 1800 : 850);
        return;
      }

      applyCompletedRaceOutcome(finalCompetitors, usedBet, performance, null);
    },
    [applyCompletedRaceOutcome, betAmount, connectedHumansCount, roomConfig.code, wsRoomSessionKey]
  );

  const handleCoinCollected = useCallback((_points?: number) => {
    setCoinsCollected((prev) => prev + 1);
    setDailyMissionsState((prev) => {
      const todayKey = getLocalDateKey();
      const base =
        prev.dateKey === todayKey ? prev : createFreshDailyMissionsState(todayKey);
      return {
        ...base,
        stats: {
          ...base.stats,
          coins: base.stats.coins + 1,
        },
      };
    });
  }, []);

  const handleClaimDailyMission = useCallback(
    (missionId: string) => {
      const mission = DAILY_MISSIONS.find((m) => m.id === missionId);
      if (!mission) return;

      const todayKey = getLocalDateKey();
      const base =
        dailyMissionsState.dateKey === todayKey
          ? dailyMissionsState
          : createFreshDailyMissionsState(todayKey);

      const progress = getMissionProgress(mission, base.stats);
      if (progress < mission.target || base.claimedIds.includes(missionId)) return;

      sounds.playCoin();
      setBalance((prev) => prev + mission.rewardKz);
      setDailyMissionsState({
        ...base,
        claimedIds: [...base.claimedIds, missionId],
      });
    },
    [dailyMissionsState, setBalance]
  );

  const handleClaimAllDailyMissions = useCallback(() => {
    const todayKey = getLocalDateKey();
    const base =
      dailyMissionsState.dateKey === todayKey
        ? dailyMissionsState
        : createFreshDailyMissionsState(todayKey);

    const ready = DAILY_MISSIONS.filter((m) => {
      const progress = getMissionProgress(m, base.stats);
      return progress >= m.target && !base.claimedIds.includes(m.id);
    });
    if (ready.length === 0) return;

    const totalReward = ready.reduce((sum, m) => sum + m.rewardKz, 0);
    sounds.playCoin();
    setBalance((prev) => prev + totalReward);
    setDailyMissionsState({
      ...base,
      claimedIds: [...base.claimedIds, ...ready.map((m) => m.id)],
    });
  }, [dailyMissionsState, setBalance]);

  // Ajusta a lista de corredores para respeitar o limite exato da sala (2, 3, 4 ou 5 jogadores)
  const fitCompetitorsToCapacity = useCallback(
    (list: Competitor[], maxCap: number, fillBots: boolean): Competitor[] => {
      const cap = clampRoomMax(maxCap, 5);
      const playerEntry = list.find((c) => c.isPlayer);
      const humanFriends = list.filter((c) => !c.isPlayer && !c.isBot);
      const existingBots = list.filter((c) => c.isBot);

      const result: Competitor[] = [];
      if (playerEntry) result.push(playerEntry);
      for (const friend of humanFriends) {
        if (result.length >= cap) break;
        result.push(friend);
      }

      if (fillBots) {
        for (const bot of existingBots) {
          if (result.length >= cap) break;
          result.push(bot);
        }
        let botIdx = 0;
        while (result.length < cap && botIdx < ANGOLAN_BOTS.length) {
          const b = ANGOLAN_BOTS[botIdx];
          botIdx++;
          if (result.some((c) => c.id === b.id)) continue;
          const lane = (result.length % 5) as Lane;
          result.push({
            id: b.id,
            name: b.name,
            avatar: b.avatar,
            avatarId: b.avatarId,
            color: b.color,
            lane,
            targetLane: lane,
            laneX: LANE_CENTERS[lane],
            yOffset: 0,
            progressDistance: 0,
            action: 'running',
            jumpY: 0,
            isBot: true,
            isPlayer: false,
            stumbling: false,
            finished: false,
          });
        }
      }

      return assignDistinctLanes(result.slice(0, cap));
    },
    [assignDistinctLanes]
  );

  // Garante na carga inicial (via link ?max=2|3|4|5) que os competidores respeitam o limite
  useEffect(() => {
    setCompetitors((prev) => {
      if (prev.length <= roomConfig.maxPlayers) return prev;
      return fitCompetitorsToCapacity(prev, roomConfig.maxPlayers, roomConfig.fillWithBots);
    });
  }, [fitCompetitorsToCapacity, roomConfig.fillWithBots, roomConfig.maxPlayers]);

  // Gerenciamento e Simulação Realista de Amigos Entrando pelo Link
  const handleAddFriendSimulation = () => {
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
      setRoomNotice(mpStrings.onlyLeaderControlsRoom);
      return;
    }
    const cap = clampRoomMax(roomConfig.maxPlayers, 5);
    if (competitors.length >= cap) return;
    const botIdx = competitors.length;
    const angolanFriends = [
      { name: 'Edson Manuel (Amigo)', avatar: '🧑🏾‍🎤', avatarId: 'kudurista-supremo', color: '#38bdf8' },
      { name: 'Yola Semedo (Amiga)', avatar: '👩🏾‍🎤', avatarId: 'pantera-marginal', color: '#ec4899' },
      { name: 'Mauro Cazenga (Amigo)', avatar: '🧑🏾‍🔧', avatarId: 'furia-samba', color: '#f97316' },
      { name: 'Kelson Luanda (Amigo)', avatar: '🥷🏾', avatarId: 'espectro-roxo', color: '#a855f7' },
      { name: 'Bruna Tatiana (Amiga)', avatar: '🧑🏾‍🚀', avatarId: 'diamante-lunda', color: '#10b981' },
    ];
    const profile = angolanFriends[botIdx % angolanFriends.length] || ANGOLAN_BOTS[botIdx % ANGOLAN_BOTS.length];
    const usedLanes = new Set(competitors.map((c) => c.lane));
    const availableLane =
      (RIVAL_LANE_SLOTS.find((l) => !usedLanes.has(l)) as Lane | undefined) ??
      (([0, 1, 2, 3, 4] as Lane[]).find((l) => !usedLanes.has(l)) ?? 0);

    const newFriend: Competitor = {
      id: `friend-${Date.now()}-${botIdx}`,
      name: `${profile.name}`,
      avatar: profile.avatar,
      avatarId: profile.avatarId,
      color: profile.color,
      lane: availableLane,
      targetLane: availableLane,
      laneX: LANE_CENTERS[availableLane],
      yOffset: 0,
      progressDistance: 0,
      action: 'running',
      jumpY: 0,
      isBot: false,
      isPlayer: false,
      stumbling: false,
      finished: false,
    };
    setCompetitors((prev) => (prev.length >= cap ? prev : [...prev, newFriend]));
  };

  const handleCreateRoom = (newConfig: RoomConfig) => {
    const cap = clampRoomMax(newConfig.maxPlayers, 5);
    const accessMode: RoomAccessMode = newConfig.accessMode || 'invite-only';
    const validatedBet = clampBetKz(newConfig.betAmount);
    const normalizedConfig: RoomConfig = {
      ...newConfig,
      betAmount: validatedBet,
      maxPlayers: cap,
      accessMode,
      isPrivate: accessMode === 'invite-only',
    };
    const myId = getSessionPlayerId();
    markCreatedRoomSession(normalizedConfig.code, myId);
    removedLocalIdsRef.current.clear();
    isAutoMatchRef.current = false;
    viaInviteRef.current = false;
    isRoomCreatorRef.current = true;
    setIsLocalRoomHost(true);
    setRoomNotice(null);
    setConfirmDeleteMain(false);
    setRoomConfig(normalizedConfig);
    setBetAmount(normalizedConfig.betAmount);
    setWsRoomSessionKey(`EXPLICIT_${normalizedConfig.code}_${Date.now()}`);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rei_zero_profile_ready', 'true');
    }
    setCompetitors((prev) => {
      const playerOnly = prev.filter((c) => c.isPlayer);
      return fitCompetitorsToCapacity(
        playerOnly.length > 0 ? playerOnly : prev,
        cap,
        normalizedConfig.fillWithBots
      );
    });
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', normalizedConfig.code);
      url.searchParams.set('host', normalizedConfig.hostName);
      url.searchParams.set('title', normalizedConfig.title);
      url.searchParams.set('bet', normalizedConfig.betAmount.toString());
      url.searchParams.set('max', String(cap));
      url.searchParams.set('bots', normalizedConfig.fillWithBots ? 'true' : 'false');
      url.searchParams.set('access', accessMode);
      window.history.replaceState(
        { reiCreatorRoom: normalizedConfig.code.toUpperCase(), reiCreatorId: myId },
        '',
        url.toString()
      );
    }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const myAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...normalizedConfig,
          creatorId: myId,
          requesterId: myId,
          player: {
            id: myId,
            name: playerName,
            avatar: myAvatar.avatar,
            avatarId: myAvatar.id,
            color: myAvatar.color,
          },
        }),
      })
        .then((r) => r.ok && setServerRoomConnected(true))
        .catch(() => setServerRoomConnected(false));

      const ws = roomWsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'room:update-config',
            roomCode: normalizedConfig.code,
            title: normalizedConfig.title,
            maxPlayers: normalizedConfig.maxPlayers,
            betAmount: normalizedConfig.betAmount,
            fillWithBots: normalizedConfig.fillWithBots,
            accessMode: normalizedConfig.accessMode,
          })
        );
      }
    }
  };
  handleCreateRoomRef.current = handleCreateRoom;

  const betSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (betSyncTimerRef.current) clearTimeout(betSyncTimerRef.current);
    };
  }, []);

  const handleMainBetChange = useCallback(
    (nextAmt: number) => {
      if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
        setRoomNotice(mpStrings.onlyLeaderControlsRoom);
        return;
      }
      const clamped = clampBetKz(nextAmt);
      lastLocalBetChangeAtRef.current = Date.now();
      setBetAmount(clamped);
      setRoomConfig((prev) =>
        prev.betAmount === clamped ? prev : { ...prev, betAmount: clamped }
      );
      setCompetitors((prev) => prev.map((c) => ({ ...c, betAmount: clamped })));
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.searchParams.has('room') || url.searchParams.has('sala')) {
          url.searchParams.set('bet', clamped.toString());
          window.history.replaceState(window.history.state, '', url.toString());
        }
      }
      const ws = roomWsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'room:update-bet',
            roomCode: roomConfig.code,
            betAmount: clamped,
          })
        );
      }
      if (betSyncTimerRef.current) {
        clearTimeout(betSyncTimerRef.current);
      }
      if (
        !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
        typeof navigator !== 'undefined' &&
        navigator.onLine
      ) {
        const currentCode = roomConfig.code;
        betSyncTimerRef.current = setTimeout(() => {
          fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: currentCode,
              requesterId: getSessionPlayerId(),
              betAmount: clamped,
            }),
          }).catch(() => {});
        }, 250);
      }
    },
    [roomConfig.code, isLocalRoomHost, wsRoomSessionKey, mpStrings.onlyLeaderControlsRoom]
  );

  const handleUpdateMaxPlayers = (newMax: 2 | 3 | 4 | 5) => {
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
      setRoomNotice(mpStrings.onlyLeaderControlsRoom);
      return;
    }
    const cap = clampRoomMax(newMax, 5);
    setRoomConfig((prev) => ({ ...prev, maxPlayers: cap }));
    setCompetitors((prev) => fitCompetitorsToCapacity(prev, cap, roomConfig.fillWithBots));
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('max', String(cap));
      window.history.replaceState(window.history.state, '', url.toString());
    }
    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:update-config',
          roomCode: roomConfig.code,
          maxPlayers: cap,
        })
      );
    }
    if (
      !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomConfig.code,
          requesterId: getSessionPlayerId(),
          maxPlayers: cap,
        }),
      }).catch(() => {});
    }
  };

  const handleToggleAccessMode = (explicitMode?: RoomAccessMode) => {
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
      setRoomNotice(mpStrings.onlyLeaderControlsRoom);
      return;
    }
    const current: RoomAccessMode = roomConfig.accessMode || 'invite-only';
    const nextMode: RoomAccessMode = explicitMode ?? (current === 'random' ? 'invite-only' : 'random');
    setRoomConfig((prev) => ({
      ...prev,
      accessMode: nextMode,
      isPrivate: nextMode === 'invite-only',
    }));
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('room') && !url.searchParams.has('sala')) {
        url.searchParams.set('room', roomConfig.code);
      }
      url.searchParams.set('access', nextMode);
      window.history.replaceState(window.history.state, '', url.toString());
    }
    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:update-config',
          roomCode: roomConfig.code,
          accessMode: nextMode,
        })
      );
    }
    if (
      !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      const myAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];
      const myId = getSessionPlayerId();
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomConfig.code,
          requesterId: myId,
          title: roomConfig.title,
          hostName: roomConfig.hostName,
          maxPlayers: roomConfig.maxPlayers,
          betAmount: roomConfig.betAmount,
          fillWithBots: roomConfig.fillWithBots,
          isDemo,
          accessMode: nextMode,
          player: {
            id: myId,
            name: playerName,
            avatar: myAvatar.avatar,
            avatarId: myAvatar.id,
            color: myAvatar.color,
          },
        }),
      }).catch(() => {});
    }
  };

  const enterSoloLobbyState = useCallback(
    (noticeMessage?: string) => {
      clearCountdownTimers();
      if (finishFallbackTimerRef.current) {
        clearTimeout(finishFallbackTimerRef.current);
        finishFallbackTimerRef.current = null;
      }
      clearCreatedRoomSession(roomConfigRef.current.code);
      setConfirmDeleteMain(false);
      startedFromRoomRef.current = false;
      isAutoMatchRef.current = false;
      viaInviteRef.current = false;
      isRoomCreatorRef.current = false;
      removedLocalIdsRef.current.clear();
      remotePlayersRef.current.clear();
      startedRoundSetRef.current.clear();
      finalizedRoundSetRef.current.clear();
      setIsLocalRoomHost(true);
      setServerRoomConnected(false);
      setWaitingForOpponent(false);
      setWaitingOpponentNames([]);
      setCountdownValue(null);
      setRaceSeed(null);
      setSyncedRaceStartAt(null);
      setPendingSyncPodium(false);
      setAuthoritativeRankings(null);
      setRoomChatMessages([]);
      statusRef.current = 'idle';
      setStatus('idle');

      const freshCode = `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;
      const myAvatar = getLocalizedAvatar(selectedAvatarId, lang);
      const displayName = playerName && playerName !== 'REI ZERO' ? playerName : myAvatar.name;

      setRoomConfig({
        code: freshCode,
        title: `Arena de ${playerName}`,
        hostName: playerName,
        maxPlayers: 5,
        minPlayers: 2,
        betAmount: 500,
        fillWithBots: false,
        isDemo,
        isPrivate: true,
        accessMode: 'invite-only',
      });
      setBetAmount(500);
      setWsRoomSessionKey(`SOLO_IDLE_${Date.now()}`);
      setCompetitors([
        {
          id: 'player-rei-zero',
          name: `${displayName} ${t.youTag}`,
          avatar: myAvatar.avatar,
          avatarId: myAvatar.id,
          color: myAvatar.color,
          lane: 2 as Lane,
          targetLane: 2 as Lane,
          laneX: LANE_CENTERS[2],
          yOffset: 0,
          progressDistance: 0,
          action: 'running',
          jumpY: 0,
          isBot: false,
          isPlayer: true,
          isHost: true,
          stumbling: false,
          finished: false,
          betAmount: 500,
        },
      ]);

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        ['room', 'sala', 'host', 'title', 'max', 'bots', 'bet', 'access', 'new', 'onboard'].forEach((k) =>
          url.searchParams.delete(k)
        );
        window.history.replaceState({}, '', url.toString());
      }

      setShowPodium(false);
      setShowTrackQr(false);
      setLobbyOpen(true);

      if (noticeMessage) {
        setRoomNotice(noticeMessage);
        setTimeout(() => setRoomNotice(null), 4500);
      }
    },
    [clearCountdownTimers, isDemo, lang, playerName, selectedAvatarId, t.youTag]
  );

  const enterSoloLobbyStateRef = useRef(enterSoloLobbyState);
  enterSoloLobbyStateRef.current = enterSoloLobbyState;

  const handleLeaveRoom = useCallback(() => {
    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'room:leave', roomCode: roomConfig.code }));
    }
    enterSoloLobbyState(mpStrings.leftRoomNotice);
  }, [enterSoloLobbyState, mpStrings.leftRoomNotice, roomConfig.code]);

  const handleSendRoomChatMessage = useCallback((rawText: string) => {
    const cleaned = rawText.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 240);
    if (!cleaned) return;
    const ws = roomWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: 'room:chat-send',
        roomCode: roomConfigRef.current.code,
        text: cleaned,
      })
    );
  }, []);

  const handleDeleteRoom = async () => {
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
      handleLeaveRoom();
      return;
    }
    const codeToDelete = roomConfig.code;
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && typeof navigator !== 'undefined' && navigator.onLine) {
      await fetch(`/api/rooms/${encodeURIComponent(codeToDelete)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: getSessionPlayerId() }),
      }).catch(() => {});
    }
    enterSoloLobbyState(t.app.roomDeletedNotice);
  };

  const handleJoinRoom = (payload: {
    code: string;
    title?: string;
    hostName?: string;
    maxPlayers?: number;
    betAmount?: number;
    isDemo?: boolean;
    accessMode?: RoomAccessMode;
    viaInvite?: boolean;
    viaRandomMatch?: boolean;
    fillWithBots?: boolean;
  }) => {
    const cleanCode = payload.code.trim().toUpperCase();
    const cap = clampRoomMax(payload.maxPlayers ?? roomConfig.maxPlayers, 5);
    const accessMode: RoomAccessMode = payload.accessMode || roomConfig.accessMode || 'invite-only';
    const shouldFillBots = payload.fillWithBots ?? (Boolean(payload.viaRandomMatch) || accessMode === 'random');
    isAutoMatchRef.current = Boolean(payload.viaRandomMatch);
    isRoomCreatorRef.current = false;
    viaInviteRef.current = payload.viaInvite ?? true;
    setIsLocalRoomHost(!viaInviteRef.current);
    removedLocalIdsRef.current.clear();
    publicRoundCompletedRef.current = false;
    setRoomChatMessages([]);
    setRoomNotice(null);
    const updatedConfig: RoomConfig = {
      code: cleanCode,
      title: payload.title || `Arena ${cleanCode}`,
      hostName: payload.hostName || roomConfig.hostName,
      maxPlayers: cap,
      minPlayers: 2,
      betAmount: clampBetKz(payload.betAmount ?? betAmount),
      fillWithBots: shouldFillBots,
      isDemo: payload.isDemo ?? isDemo,
      isPrivate: accessMode === 'invite-only',
      accessMode,
    };
    setRoomConfig(updatedConfig);
    setBetAmount(updatedConfig.betAmount);
    setWsRoomSessionKey(`EXPLICIT_${cleanCode}_${Date.now()}`);
    if (shouldFillBots && (payload.viaRandomMatch || accessMode === 'random')) {
      rotatePublicBotsInCompetitors(updatedConfig.betAmount, true);
    } else {
      setCompetitors((prev) => fitCompetitorsToCapacity(prev, cap, shouldFillBots));
    }
    if (typeof payload.isDemo === 'boolean') {
      setIsDemo(payload.isDemo);
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleanCode);
      if (payload.hostName) url.searchParams.set('host', payload.hostName);
      if (payload.title) url.searchParams.set('title', payload.title);
      url.searchParams.set('max', String(cap));
      url.searchParams.set('bots', shouldFillBots ? 'true' : 'false');
      url.searchParams.set('bet', updatedConfig.betAmount.toString());
      url.searchParams.set('access', accessMode);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleJoinRoomRef = useRef(handleJoinRoom);
  handleJoinRoomRef.current = handleJoinRoom;

  const parseScannedTrackQrAndJoin = useCallback(
    (rawValue: string) => {
      const cleaned = rawValue.trim();
      if (!cleaned) return false;

      let parsedPayload: {
        code: string;
        title?: string;
        hostName?: string;
        maxPlayers?: number;
        betAmount?: number;
        fillWithBots?: boolean;
        isDemo?: boolean;
        accessMode?: RoomAccessMode;
        viaInvite?: boolean;
      } | null = null;

      try {
        if (cleaned.includes('http') || cleaned.includes('?')) {
          const url = new URL(
            cleaned.startsWith('http') ? cleaned : `https://rei-run.app/${cleaned}`
          );
          const roomCode = url.searchParams.get('room') || url.searchParams.get('sala');
          if (roomCode) {
            const betNum = parseInt(url.searchParams.get('bet') || '500', 10);
            const maxNum = parseInt(url.searchParams.get('max') || '5', 10);
            const accessParam = url.searchParams.get('access');
            parsedPayload = {
              code: roomCode.trim().toUpperCase(),
              hostName: url.searchParams.get('host') || undefined,
              title: url.searchParams.get('title') || undefined,
              maxPlayers: !isNaN(maxNum) ? Math.max(2, Math.min(5, maxNum)) : undefined,
              betAmount: isNaN(betNum) ? undefined : clampBetKz(betNum),
              fillWithBots: url.searchParams.has('bots')
                ? url.searchParams.get('bots') === 'true'
                : undefined,
              isDemo: url.searchParams.get('mode') ? url.searchParams.get('mode') !== 'real' : undefined,
              accessMode: accessParam === 'random' ? 'random' : 'invite-only',
              viaInvite: true,
            };
          }
        }
      } catch {
        // Fallback to direct room code below
      }

      if (!parsedPayload) {
        const fallbackCode = cleaned.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        if (fallbackCode) {
          parsedPayload = {
            code: fallbackCode,
            viaInvite: true,
          };
        }
      }

      if (!parsedPayload || !parsedPayload.code) return false;

      stopTrackQrCamera();
      setShowTrackQr(false);
      handleJoinRoomRef.current(parsedPayload);
      return true;
    },
    [stopTrackQrCamera]
  );

  useEffect(() => {
    if (!showTrackQr || !trackQrCameraActive) return;
    let rafId = 0;
    let active = true;

    const scanFrame = () => {
      if (!active) return;
      const video = trackQrVideoRef.current;
      const canvas = trackQrCanvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (decoded && decoded.data && parseScannedTrackQrAndJoin(decoded.data)) {
            return;
          }
        }
      }
      rafId = requestAnimationFrame(scanFrame);
    };

    rafId = requestAnimationFrame(scanFrame);
    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, [showTrackQr, trackQrCameraActive, parseScannedTrackQrAndJoin]);

  const handleFindRandomRoom = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setRoomNotice(t.lobby.noRandomRoomNotice);
      return;
    }
    try {
      const targetBet = clampBetKz(betAmount);
      const query = new URLSearchParams({
        playerId: getSessionPlayerId(),
        betAmount: String(targetBet),
        isDemo: isDemo ? '1' : '0',
        excludeRoom: roomConfig.code,
      });
      const resp = await fetch(`/api/rooms/open/random?${query.toString()}`);
      if (!resp.ok) {
        setRoomNotice(t.lobby.noRandomRoomNotice);
        return;
      }
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        room?: {
          code: string;
          title: string;
          hostName: string;
          maxPlayers: number;
          betAmount: number;
          fillWithBots?: boolean;
          isDemo: boolean;
          accessMode?: RoomAccessMode;
        };
      };
      if (data.ok && data.room) {
        handleJoinRoom({
          code: data.room.code,
          title: data.room.title,
          hostName: data.room.hostName,
          maxPlayers: data.room.maxPlayers,
          betAmount: data.room.betAmount,
          isDemo: data.room.isDemo,
          accessMode: data.room.accessMode || 'random',
          fillWithBots: data.room.fillWithBots ?? true,
          viaInvite: true,
          viaRandomMatch: true,
        });
      } else {
        setRoomNotice(t.lobby.noRandomRoomNotice);
      }
    } catch {
      setRoomNotice(t.lobby.noRandomRoomNotice);
    }
  };

  const handleCompleteInviteOnboarding = useCallback(
    ({ name, avatarId }: { name: string; avatarId: string }) => {
      const cleanName = name.trim() || 'REI ZERO';
      const item = getLocalizedAvatar(avatarId, lang);

      setPlayerName(cleanName);
      setSelectedAvatarId(avatarId);
      setUnlockedAvatars((prev) => (prev.includes(avatarId) ? prev : [...prev, avatarId]));

      if (typeof window !== 'undefined') {
        localStorage.setItem('rei_zero_player_name', cleanName);
        localStorage.setItem('rei_zero_profile_ready', 'true');
        const url = new URL(window.location.href);
        url.searchParams.delete('new');
        url.searchParams.delete('onboard');
        window.history.replaceState({}, '', url.toString());
      }

      if (isDemo) {
        setDemoBalance((prev) => Math.max(prev, Math.max(100_000, roomConfig.betAmount)));
      }

      setCompetitors((prev) =>
        prev.map((c) =>
          c.isPlayer
            ? {
                ...c,
                avatar: item.avatar,
                avatarId: item.id,
                color: item.color,
                name: `${cleanName} ${t.youTag}`,
                profileReady: true,
              }
            : c
        )
      );

      viaInviteRef.current = true;
      setNeedsInviteOnboarding(false);
      setLobbyOpen(true);

      const ws = roomWsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'room:profile-ready',
            roomCode: roomConfig.code,
            player: {
              id: getSessionPlayerId(),
              name: cleanName,
              avatar: item.avatar,
              avatarId: item.id,
              color: item.color,
            },
          })
        );
      }
    },
    [isDemo, lang, roomConfig.betAmount, roomConfig.code, t.youTag]
  );

  // Refs atualizados para o socket WebSocket permanente /ws/room (sem reconectar a cada clique)
  const roomConfigRef = useRef(roomConfig);
  roomConfigRef.current = roomConfig;
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  const selectedAvatarIdRef = useRef(selectedAvatarId);
  selectedAvatarIdRef.current = selectedAvatarId;
  const isDemoRef = useRef(isDemo);
  isDemoRef.current = isDemo;
  const betAmountRef = useRef(betAmount);
  betAmountRef.current = betAmount;
  const needsInviteOnboardingRef = useRef(needsInviteOnboarding);
  needsInviteOnboardingRef.current = needsInviteOnboarding;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const applyCompletedRaceOutcomeRef = useRef(applyCompletedRaceOutcome);
  applyCompletedRaceOutcomeRef.current = applyCompletedRaceOutcome;

  // Conexão WebSocket em tempo real (/ws/room): sincronização de sala, apostas, início simultâneo, telemetria e pódio
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (wsRoomSessionKey.startsWith('SOLO_IDLE_')) {
      setServerRoomConnected(false);
      setRoomRttMs(null);
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setServerRoomConnected(false);
      setRoomRttMs(null);
      return;
    }

    const myId = getSessionPlayerId();
    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    const burstTimers: Array<ReturnType<typeof setTimeout>> = [];
    bestRttRef.current = Number.POSITIVE_INFINITY;
    setRoomRttMs(null);
    hasCalibratedClockRef.current = false;

    type ServerRoomParticipantPayload = {
      id: string;
      name: string;
      avatar: string;
      avatarId: string;
      color: string;
      isHost: boolean;
      lane?: number;
      targetLane?: number;
      laneX?: number;
      progressDistance?: number;
      action?: string;
      jumpY?: number;
      stumbling?: boolean;
      finished?: boolean;
      profileReady?: boolean;
      selectingProfile?: boolean;
      connected?: boolean;
      betAmount?: number;
      sessionStatus?: 'normal' | 'investigating';
      isSpectating?: boolean;
    };

    type ServerRoomPayload = {
      code: string;
      title: string;
      hostName: string;
      hostId?: string;
      creatorId?: string;
      maxPlayers?: number;
      betAmount: number;
      fillWithBots?: boolean;
      isDemo?: boolean;
      accessMode?: RoomAccessMode;
      pendingStart?: boolean;
      raceStatus?: 'idle' | 'starting' | 'running' | 'completed';
      raceRound?: number;
      raceSeed?: number;
      raceStartAt?: number | null;
      syncedRaceStartAt?: number | null;
      participants: ServerRoomParticipantPayload[];
    };

    const applyRoomStateFromServer = (room: ServerRoomPayload, forceCompetitorSync = false) => {
      if (!room || !Array.isArray(room.participants)) return;

      latestServerRoomRef.current = room;
      const nextServerRaceStatus: ServerRaceStatus = room.raceStatus || 'idle';
      serverRaceStatusRef.current = nextServerRaceStatus;
      setServerRaceStatus(nextServerRaceStatus);
      if (typeof room.raceRound === 'number') {
        serverRaceRoundRef.current = room.raceRound;
      }
      if (typeof room.raceSeed === 'number') {
        serverRaceSeedRef.current = room.raceSeed;
      }
      const nextServerStart = room.syncedRaceStartAt ?? room.raceStartAt;
      if (typeof nextServerStart === 'number') {
        serverRaceStartAtRef.current = nextServerStart;
      }

      if (nextServerRaceStatus === 'running' || nextServerRaceStatus === 'starting') {
        const nowSyncMs = Date.now();
        room.participants.forEach((p) => {
          if (p.id === myId || p.isSpectating || p.connected === false) return;
          const existing = remotePlayersRef.current.get(p.id);
          const serverDist = Number(p.progressDistance || 0);
          if (
            !existing ||
            nowSyncMs - existing.updatedAt > 900 ||
            serverDist > existing.progressDistance
          ) {
            const pLane = (typeof p.lane === 'number'
              ? Math.max(0, Math.min(4, p.lane))
              : existing?.lane ?? 1) as Lane;
            const pTarget = (typeof p.targetLane === 'number'
              ? Math.max(0, Math.min(4, p.targetLane))
              : existing?.targetLane ?? pLane) as Lane;
            remotePlayersRef.current.set(p.id, {
              playerId: p.id,
              progressDistance: Math.max(existing?.progressDistance ?? 0, serverDist),
              lane: pLane,
              targetLane: pTarget,
              laneX: typeof p.laneX === 'number' ? p.laneX : existing?.laneX ?? LANE_CENTERS[pTarget],
              action:
                (p.action as RemoteRunnerSnapshot['action']) || existing?.action || 'running',
              jumpY: typeof p.jumpY === 'number' ? p.jumpY : existing?.jumpY ?? 0,
              stumbling: typeof p.stumbling === 'boolean' ? p.stumbling : Boolean(existing?.stumbling),
              finished: typeof p.finished === 'boolean' ? p.finished : Boolean(existing?.finished),
              updatedAt: nowSyncMs,
            });
          }
        });
      }

      if (isSpectatingRef.current && nextServerRaceStatus === 'idle') {
        isSpectatingRef.current = false;
        setIsSpectating(false);
        setSpectatedRunnerId(null);
        statusRef.current = 'idle';
        setStatus('idle');
        setElapsedSeconds(0);
      }

      const activeServerHumans = room.participants.filter((p) => p.connected !== false);
      const meOnServer =
        activeServerHumans.find((p) => p.id === myId) ||
        room.participants.find((p) => p.id === myId);
      if (room.creatorId && room.creatorId === myId) {
        isRoomCreatorRef.current = true;
        viaInviteRef.current = false;
        markCreatedRoomSession(room.code || roomConfigRef.current.code, myId);
      }
      const localIsHost = room.creatorId
        ? room.creatorId === myId
        : meOnServer
        ? Boolean(meOnServer.isHost)
        : room.hostId
        ? room.hostId === myId
        : isRoomCreatorRef.current && !viaInviteRef.current;
      setIsLocalRoomHost(localIsHost);
      serverHumansCountRef.current = activeServerHumans.filter((p) => p.isSpectating !== true).length;

      const unreadyOthers = activeServerHumans
        .filter((p) => p.id !== myId && (p.selectingProfile || p.profileReady === false))
        .map((p) => p.name);

      if (room.pendingStart && unreadyOthers.length > 0) {
        setWaitingForOpponent(true);
        setWaitingOpponentNames(unreadyOthers);
      } else {
        setWaitingForOpponent(false);
        setWaitingOpponentNames([]);
      }

      const cfg = roomConfigRef.current;
      const serverMax = clampRoomMax(room.maxPlayers, cfg.maxPlayers);
      const serverAccess = room.accessMode;
      const serverFillBots =
        typeof room.fillWithBots === 'boolean' ? room.fillWithBots : cfg.fillWithBots;
      const serverCode = room.code ? room.code.toUpperCase() : cfg.code;
      const serverTitle = room.title || cfg.title;
      const serverHostName = room.hostName || cfg.hostName;
      const serverBet =
        typeof room.betAmount === 'number' ? clampBetKz(room.betAmount) : cfg.betAmount;
      const recentlyEditedLocally = Date.now() - lastLocalBetChangeAtRef.current < 1200;
      const shouldAdoptServerBet =
        (!localIsHost || !recentlyEditedLocally) && serverBet !== cfg.betAmount;

      if (
        serverCode !== cfg.code ||
        serverTitle !== cfg.title ||
        serverHostName !== cfg.hostName ||
        serverMax !== cfg.maxPlayers ||
        serverFillBots !== cfg.fillWithBots ||
        (serverAccess && serverAccess !== cfg.accessMode) ||
        shouldAdoptServerBet
      ) {
        setRoomConfig((prev) => ({
          ...prev,
          code: serverCode,
          title: serverTitle,
          hostName: serverHostName,
          maxPlayers: serverMax,
          fillWithBots: serverFillBots,
          betAmount: shouldAdoptServerBet ? serverBet : prev.betAmount,
          accessMode: serverAccess || prev.accessMode,
          isPrivate: (serverAccess || prev.accessMode) === 'invite-only',
        }));
        if (shouldAdoptServerBet) {
          setBetAmount(serverBet);
          const url = new URL(window.location.href);
          if (url.searchParams.has('room') || url.searchParams.has('sala')) {
            url.searchParams.set('bet', serverBet.toString());
            window.history.replaceState(window.history.state, '', url.toString());
          }
        }
      }

      if (!isSpectatingRef.current && (statusRef.current === 'idle' || forceCompetitorSync)) {
        const remoteOthers = activeServerHumans.filter(
          (p) => p.id !== myId && !removedLocalIdsRef.current.has(p.id)
        );
        const myServerLane: Lane =
          typeof meOnServer?.lane === 'number' && meOnServer.lane >= 0 && meOnServer.lane <= 4
            ? (meOnServer.lane as Lane)
            : 2;

        setCompetitors((prev) => {
          const foundPlayer = prev.find((c) => c.isPlayer);
          const myAvatar = getLocalizedAvatar(selectedAvatarIdRef.current, lang);
          const cleanMyName =
            meOnServer?.name?.trim() ||
            (playerNameRef.current && playerNameRef.current !== 'REI ZERO'
              ? playerNameRef.current
              : myAvatar.name);
          const playerEntry: Competitor = foundPlayer || {
            id: myId,
            name: `${cleanMyName} ${t.youTag}`,
            avatar: meOnServer?.avatar || myAvatar.avatar,
            avatarId: meOnServer?.avatarId || myAvatar.id,
            color: meOnServer?.color || myAvatar.color,
            lane: myServerLane,
            targetLane: myServerLane,
            laneX: LANE_CENTERS[myServerLane],
            yOffset: 0,
            progressDistance: 0,
            action: 'running',
            jumpY: 0,
            isBot: false,
            isPlayer: true,
            isHost: localIsHost,
            stumbling: false,
            finished: false,
            betAmount: shouldAdoptServerBet ? serverBet : betAmountRef.current,
          };
          const localSimFriends = prev.filter(
            (c) => !c.isPlayer && !c.isBot && c.id.startsWith('friend-')
          );
          const existingBots = prev.filter((c) => c.isBot);

          const activeInvestigations = telemetryValidatorRef.current.getInvestigations();
          const humanCompetitors: Competitor[] = remoteOthers.map((p, idx) => {
            const rivalLane: Lane =
              typeof p.lane === 'number' && p.lane >= 0 && p.lane <= 4
                ? (p.lane as Lane)
                : (RIVAL_LANE_SLOTS[idx % RIVAL_LANE_SLOTS.length] as Lane);
            return {
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              avatarId: p.avatarId,
              color: p.color,
              lane: rivalLane,
              targetLane: rivalLane,
              laneX: LANE_CENTERS[rivalLane],
              yOffset: 0,
              progressDistance: 0,
              action: 'running',
              jumpY: 0,
              isBot: false,
              isPlayer: false,
              isHost: p.isHost,
              isRemoteHuman: true,
              profileReady: p.profileReady !== false && !p.selectingProfile,
              betAmount: typeof p.betAmount === 'number' ? clampBetKz(p.betAmount) : serverBet,
              sessionStatus:
                activeInvestigations[p.id]?.sessionStatus ?? p.sessionStatus ?? 'normal',
              isSpectating: Boolean(p.isSpectating),
              stumbling: false,
              finished: false,
            };
          });

          const combined: Competitor[] = [];
          combined.push({
            ...playerEntry,
            lane: myServerLane,
            targetLane: myServerLane,
            laneX: LANE_CENTERS[myServerLane],
            isPlayer: true,
            isHost: localIsHost,
            isRemoteHuman: false,
            profileReady: !needsInviteOnboardingRef.current,
            betAmount: shouldAdoptServerBet ? serverBet : betAmountRef.current,
            isSpectating: Boolean(meOnServer?.isSpectating),
          });
          for (const remoteFriend of humanCompetitors) {
            if (combined.length >= serverMax) break;
            combined.push(remoteFriend);
          }
          for (const simFriend of localSimFriends) {
            if (combined.length >= serverMax) break;
            combined.push({
              ...simFriend,
              betAmount: serverBet,
            });
          }
          const shouldIncludeBots =
            room.fillWithBots ?? (cfg.fillWithBots || (serverAccess || cfg.accessMode) === 'random');
          if (shouldIncludeBots) {
            const codeHash = Array.from(serverCode).reduce(
              (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
              17
            );
            const roomBotSeed =
              ((typeof room.raceSeed === 'number' ? room.raceSeed : 0) +
                (room.raceRound || 1) * 7919 +
                codeHash) >>>
              0;
            const shouldRefreshDeterministicBots =
              forceCompetitorSync || existingBots.length === 0;
            if (!shouldRefreshDeterministicBots) {
              for (const bot of existingBots) {
                if (combined.length >= serverMax) break;
                if (!combined.some((c) => c.id === bot.id)) {
                  combined.push({
                    ...bot,
                    betAmount: serverBet,
                  });
                }
              }
            }
            const missingSlots = Math.max(0, serverMax - combined.length);
            if (missingSlots > 0) {
              const extraBots = pickRotatedPublicBots(
                missingSlots,
                [],
                combined.map((c) => c.id),
                roomBotSeed
              );
              for (const b of extraBots) {
                if (combined.length >= serverMax) break;
                const localized = getLocalizedBot(b.id, lang);
                const botLane = (RIVAL_LANE_SLOTS[combined.length % RIVAL_LANE_SLOTS.length] ?? 0) as Lane;
                combined.push({
                  id: b.id,
                  name: localized.name || b.name,
                  avatar: b.avatar,
                  avatarId: b.avatarId,
                  color: b.color,
                  lane: botLane,
                  targetLane: botLane,
                  laneX: LANE_CENTERS[botLane],
                  yOffset: 0,
                  progressDistance: 0,
                  action: 'running',
                  jumpY: 0,
                  isBot: true,
                  isPlayer: false,
                  stumbling: false,
                  finished: false,
                  betAmount: serverBet,
                });
              }
            }
          }
          return assignDistinctLanes(combined.slice(0, serverMax), forceCompetitorSync);
        });
      }
    };

    applyServerRoomStateRef.current = (forceCompetitorSync = false) => {
      if (latestServerRoomRef.current) {
        applyRoomStateFromServer(latestServerRoomRef.current as ServerRoomPayload, forceCompetitorSync);
      }
    };

    const beginSynchronizedCountdown = (payload: {
      room: ServerRoomPayload;
      raceRound: number;
      raceSeed: number;
      raceStartAt: number;
      betAmount: number;
      serverTime?: number;
    }) => {
      const roundRoomCode = (payload.room.code || roomConfigRef.current.code || 'ARENA').toUpperCase();
      const roundTrackKey = `${roundRoomCode}:${payload.raceRound}`;
      if (
        payload.raceRound < activeRaceRoundRef.current ||
        (payload.raceRound === activeRaceRoundRef.current &&
          activeRaceSeedRef.current !== null &&
          payload.raceSeed !== activeRaceSeedRef.current)
      ) {
        startedRoundSetRef.current.clear();
        finalizedRoundSetRef.current.clear();
      }
      if (startedRoundSetRef.current.has(roundTrackKey)) return;
      startedRoundSetRef.current.add(roundTrackKey);
      publicRoundCompletedRef.current = false;

      if (typeof payload.serverTime === 'number' && !hasCalibratedClockRef.current) {
        serverClockOffsetRef.current = payload.serverTime - Date.now();
      }
      const localRaceStartAt = payload.raceStartAt - serverClockOffsetRef.current;
      const effectiveBet = clampBetKz(payload.betAmount ?? roomConfigRef.current.betAmount);

      isSpectatingRef.current = false;
      setIsSpectating(false);
      setSpectatedRunnerId(null);
      setWasSpectatorOutcome(false);

      activeRaceRoundRef.current = payload.raceRound;
      activeRaceSeedRef.current = payload.raceSeed;
      setActiveRaceRound(payload.raceRound);
      activeBetForRoundRef.current = effectiveBet;
      remotePlayersRef.current.clear();
      telemetryValidatorRef.current.setSessionContext({
        roomCode: payload.room.code || roomConfigRef.current.code,
        raceRound: payload.raceRound,
        reporterId: myId,
      });
      telemetryValidatorRef.current.resetKinematicsForNewRound();

      if (isDemoRef.current && balanceRef.current < effectiveBet) {
        setDemoBalance((prev) => Math.max(prev, effectiveBet) - effectiveBet);
      } else {
        setBalance((prev) => Math.max(0, prev - effectiveBet));
      }

      setBetAmount(effectiveBet);
      setRoomConfig((prev) => ({ ...prev, betAmount: effectiveBet }));
      applyRoomStateFromServer(payload.room, true);

      if (typeof window !== 'undefined') {
        localStorage.setItem('rei_zero_profile_ready', 'true');
      }
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      clearCountdownTimers();
      if (finishFallbackTimerRef.current) {
        clearTimeout(finishFallbackTimerRef.current);
        finishFallbackTimerRef.current = null;
      }

      startedFromRoomRef.current = true;
      statusRef.current = 'starting';
      setStatus('starting');
      setLobbyOpen(false);
      setShowPodium(false);
      setShowTrackQr(false);
      setRulesOpen(false);
      setHowToPlayTutorialOpen(false);
      setShopOpen(false);
      setNeedsInviteOnboarding(false);
      setAuthoritativeRankings(null);
      setPendingSyncPodium(false);
      setWaitingForOpponent(false);
      setWaitingOpponentNames([]);
      setRaceSeed(payload.raceSeed);
      setSyncedRaceStartAt(localRaceStartAt);
      setLastPayout(null);
      setElapsedSeconds(0);
      setCoinsCollected(0);
      setLastPerformance(null);
      setRoundNonce((n) => n + 1);

      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => alignTrackToTop('smooth'));
        countdownTimersRef.current.push(setTimeout(() => alignTrackToTop('auto'), 420));
      }

      const runAt = localRaceStartAt;
      const s2At = runAt - 2350;
      const s1At = runAt - 1400;
      const s0At = runAt - 450;
      const firedSync = { s3: false, s2: false, s1: false, s0: false, run: false };

      const triggerSyncStep = (step: 's3' | 's2' | 's1' | 's0' | 'run') => {
        if (firedSync[step]) return;
        firedSync[step] = true;
        if (step === 's3') {
          setCountdownValue(3);
          sounds.playCountdownTick();
        } else if (step === 's2') {
          setCountdownValue(2);
          sounds.playCountdownTick();
        } else if (step === 's1') {
          setCountdownValue(1);
          sounds.playCountdownTick();
        } else if (step === 's0') {
          setCountdownValue(0);
          sounds.playCountdownGo();
        } else {
          forceSynchronizedRunRef.current = null;
          if (countdownRafRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(countdownRafRef.current);
            countdownRafRef.current = null;
          }
          setCountdownValue(null);
          alignTrackToTop('auto', true);
          statusRef.current = 'running';
          setStatus('running');
        }
      };

      forceSynchronizedRunRef.current = () => {
        if (!firedSync.s0) triggerSyncStep('s0');
        triggerSyncStep('run');
      };

      const nowWall = Date.now();
      if (nowWall >= runAt) {
        firedSync.s3 = true;
        firedSync.s2 = true;
        firedSync.s1 = true;
        triggerSyncStep('s0');
        triggerSyncStep('run');
        return;
      }
      if (nowWall >= s0At) {
        firedSync.s3 = true;
        firedSync.s2 = true;
        firedSync.s1 = true;
        triggerSyncStep('s0');
      } else if (nowWall >= s1At) {
        firedSync.s3 = true;
        firedSync.s2 = true;
        triggerSyncStep('s1');
      } else if (nowWall >= s2At) {
        firedSync.s3 = true;
        triggerSyncStep('s2');
      } else {
        triggerSyncStep('s3');
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        const monitorSyncCountdown = () => {
          const tNow = Date.now();
          if (tNow >= s2At && !firedSync.s2) triggerSyncStep('s2');
          if (tNow >= s1At && !firedSync.s1) triggerSyncStep('s1');
          if (tNow >= s0At && !firedSync.s0) triggerSyncStep('s0');
          if (tNow >= runAt && !firedSync.run) {
            triggerSyncStep('run');
            return;
          }
          if (!firedSync.run) {
            countdownRafRef.current = requestAnimationFrame(monitorSyncCountdown);
          }
        };
        countdownRafRef.current = requestAnimationFrame(monitorSyncCountdown);
      }

      if (!firedSync.s2) {
        countdownTimersRef.current.push(
          setTimeout(() => triggerSyncStep('s2'), Math.max(0, s2At - nowWall))
        );
      }
      if (!firedSync.s1) {
        countdownTimersRef.current.push(
          setTimeout(() => triggerSyncStep('s1'), Math.max(0, s1At - nowWall))
        );
      }
      if (!firedSync.s0) {
        countdownTimersRef.current.push(
          setTimeout(() => triggerSyncStep('s0'), Math.max(0, s0At - nowWall))
        );
      }
      countdownTimersRef.current.push(
        setTimeout(() => triggerSyncStep('run'), Math.max(0, runAt - nowWall))
      );
    };

    beginSynchronizedCountdownRef.current = beginSynchronizedCountdown;

    const sendClockPing = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room:ping', clientTime: Date.now() }));
      }
    };

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/ws/room`;
    const ws = new WebSocket(wsUrl);
    roomWsRef.current = ws;

    ws.onopen = () => {
      if (closedByCleanup) {
        ws.close();
        return;
      }
      setServerRoomConnected(true);
      sendClockPing();
      burstTimers.push(setTimeout(sendClockPing, 150), setTimeout(sendClockPing, 350));
      pingTimer = setInterval(sendClockPing, 15_000);

      const cfg = roomConfigRef.current;
      const myAvatar = AVATARS.find((a) => a.id === selectedAvatarIdRef.current) || AVATARS[0];
      const selectingProfile = needsInviteOnboardingRef.current;
      ws.send(
        JSON.stringify({
          type: 'room:join',
          roomCode: cfg.code,
          title: cfg.title,
          hostName: cfg.hostName,
          creatorId: isRoomCreatorRef.current ? myId : undefined,
          isRoomCreator: isRoomCreatorRef.current,
          maxPlayers: cfg.maxPlayers,
          betAmount: cfg.betAmount,
          fillWithBots: cfg.fillWithBots,
          isDemo: isDemoRef.current,
          accessMode: isAutoMatchRef.current ? 'random' : cfg.accessMode || 'invite-only',
          viaInvite: viaInviteRef.current,
          autoMatch: isAutoMatchRef.current,
          player: {
            id: myId,
            name: playerNameRef.current,
            avatar: myAvatar.avatar,
            avatarId: myAvatar.id,
            color: myAvatar.color,
            profileReady: !selectingProfile,
            selectingProfile,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      if (closedByCleanup) return;
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          clientTime?: number;
          serverTime?: number;
          room?: ServerRoomPayload;
          rotatedPublicMatch?: boolean;
          startAfterJoin?: boolean;
          waitingNames?: string[];
          raceRound?: number;
          raceSeed?: number;
          raceStartAt?: number;
          syncedRaceStartAt?: number;
          betAmount?: number;
          playerId?: string;
          progressDistance?: number;
          lane?: number;
          targetLane?: number;
          laneX?: number;
          action?: PlayerAction;
          jumpY?: number;
          stumbling?: boolean;
          finished?: boolean;
          rankings?: RoomStandingEntry[];
          code?: string;
          targetId?: string;
          roomCode?: string;
          chatMessages?: RoomChatMessage[];
          message?: RoomChatMessage;
        };

        if (msg.type === 'room:pong' && typeof msg.serverTime === 'number') {
          const nowMs = Date.now();
          const sentAt = typeof msg.clientTime === 'number' ? msg.clientTime : nowMs;
          const rtt = Math.max(0, nowMs - sentAt);
          if (rtt <= bestRttRef.current + 12 || !hasCalibratedClockRef.current) {
            bestRttRef.current = Math.min(bestRttRef.current, rtt);
            serverClockOffsetRef.current = msg.serverTime - (sentAt + rtt * 0.5);
            hasCalibratedClockRef.current = true;
          }
          const nextRttMs = Number.isFinite(bestRttRef.current)
            ? Math.round(bestRttRef.current)
            : Math.round(rtt);
          setRoomRttMs((prev) => (prev === nextRttMs ? prev : nextRttMs));
          return;
        }

        if (typeof msg.serverTime === 'number' && !hasCalibratedClockRef.current) {
          serverClockOffsetRef.current = msg.serverTime - Date.now();
        }

        if (msg.type === 'room:chat-message' && msg.message) {
          const targetCode = (msg.roomCode || msg.message.roomCode || '').toUpperCase();
          const currentCode = (roomConfigRef.current.code || '').toUpperCase();
          if (targetCode && currentCode && targetCode !== currentCode) {
            return;
          }
          const incomingMsg = msg.message;
          setRoomChatMessages((prev) =>
            prev.some((m) => m.id === incomingMsg.id)
              ? prev
              : [...prev.slice(-59), incomingMsg]
          );
          return;
        }

        if ((msg.type === 'room:joined' || msg.type === 'room:state') && msg.room) {
          if (msg.type === 'room:joined') {
            setRoomChatMessages(
              Array.isArray(msg.chatMessages) ? msg.chatMessages.slice(-60) : []
            );
          }
          if (msg.type === 'room:joined' && msg.rotatedPublicMatch) {
            startedRoundSetRef.current.clear();
            finalizedRoundSetRef.current.clear();
            remotePlayersRef.current.clear();
            publicRoundCompletedRef.current = false;
            lastLocalBetChangeAtRef.current = 0;
            applyRoomStateFromServer(msg.room, true);
            rotatePublicBotsInCompetitorsRef.current?.(msg.room.betAmount, true);
            if (msg.startAfterJoin) {
              const meInNext = msg.room.participants.find((p) => p.id === myId);
              if (meInNext?.isHost) {
                ws.send(JSON.stringify({ type: 'room:start-request', roomCode: msg.room.code }));
              } else {
                setShowPodium(false);
                statusRef.current = 'idle';
                setStatus('idle');
                setLobbyOpen(true);
              }
            }
            return;
          }
          applyRoomStateFromServer(msg.room, false);
          const meInState = msg.room.participants.find((p) => p.id === myId);
          const catchUpStartAt = msg.room.syncedRaceStartAt ?? msg.room.raceStartAt;
          const stateRoundKey = `${(msg.room.code || roomConfigRef.current.code || 'ARENA').toUpperCase()}:${msg.room.raceRound}`;
          if (
            (msg.room.raceStatus === 'starting' ||
              (msg.room.raceStatus === 'running' &&
                meInState &&
                meInState.isSpectating !== true)) &&
            typeof catchUpStartAt === 'number' &&
            typeof msg.room.raceRound === 'number' &&
            typeof msg.room.raceSeed === 'number' &&
            (statusRef.current === 'idle' || statusRef.current === 'completed') &&
            !isSpectatingRef.current &&
            !startedRoundSetRef.current.has(stateRoundKey)
          ) {
            beginSynchronizedCountdown({
              room: msg.room,
              raceRound: msg.room.raceRound,
              raceSeed: msg.room.raceSeed,
              raceStartAt: catchUpStartAt,
              betAmount: msg.room.betAmount,
              serverTime: msg.serverTime,
            });
          }
          return;
        }

        if (msg.type === 'room:waiting-opponent' && msg.room) {
          applyRoomStateFromServer(msg.room, false);
          setWaitingForOpponent(true);
          setWaitingOpponentNames(Array.isArray(msg.waitingNames) ? msg.waitingNames : []);
          return;
        }

        const startTimestamp = msg.syncedRaceStartAt ?? msg.raceStartAt;
        if (
          msg.type === 'room:race-start' &&
          msg.room &&
          typeof msg.raceRound === 'number' &&
          typeof msg.raceSeed === 'number' &&
          typeof startTimestamp === 'number'
        ) {
          beginSynchronizedCountdown({
            room: msg.room,
            raceRound: msg.raceRound,
            raceSeed: msg.raceSeed,
            raceStartAt: startTimestamp,
            betAmount: msg.betAmount ?? msg.room.betAmount,
            serverTime: msg.serverTime,
          });
          return;
        }

        if (msg.type === 'room:race-go' && typeof msg.raceRound === 'number') {
          const goRoundKey = `${(msg.room?.code || roomConfigRef.current.code || 'ARENA').toUpperCase()}:${msg.raceRound}`;
          if (statusRef.current === 'starting' && activeRaceRoundRef.current === msg.raceRound) {
            forceSynchronizedRunRef.current?.();
          } else if (
            (statusRef.current === 'idle' || statusRef.current === 'completed') &&
            !isSpectatingRef.current &&
            msg.room &&
            !startedRoundSetRef.current.has(goRoundKey) &&
            typeof msg.room.raceSeed === 'number'
          ) {
            const meInRoom = msg.room.participants.find((p) => p.id === myId);
            if (!meInRoom || meInRoom.isSpectating !== true) {
              beginSynchronizedCountdown({
                room: msg.room,
                raceRound: msg.raceRound,
                raceSeed: msg.room.raceSeed,
                raceStartAt: msg.syncedRaceStartAt ?? Date.now(),
                betAmount: msg.room.betAmount,
                serverTime: msg.serverTime,
              });
            }
          }
          return;
        }

        if (msg.type === 'room:race-sync' && msg.playerId && msg.playerId !== myId) {
          const expectedRound =
            activeRaceRoundRef.current > 0
              ? activeRaceRoundRef.current
              : isSpectatingRef.current
              ? serverRaceRoundRef.current
              : 0;
          if (
            typeof msg.raceRound === 'number' &&
            expectedRound > 0 &&
            msg.raceRound !== expectedRound
          ) {
            return;
          }
          const existing = remotePlayersRef.current.get(msg.playerId);
          const resolvedLane = (
            typeof msg.lane === 'number'
              ? Math.max(0, Math.min(4, msg.lane))
              : existing?.lane ?? 1
          ) as Lane;
          const resolvedTargetLane = (
            typeof msg.targetLane === 'number'
              ? Math.max(0, Math.min(4, msg.targetLane))
              : existing?.targetLane ?? resolvedLane
          ) as Lane;
          const nextSnapshot: RemoteRunnerSnapshot = {
            playerId: msg.playerId,
            progressDistance:
              typeof msg.progressDistance === 'number'
                ? msg.progressDistance
                : existing?.progressDistance ?? 0,
            lane: resolvedLane,
            targetLane: resolvedTargetLane,
            laneX:
              typeof msg.laneX === 'number'
                ? msg.laneX
                : existing?.laneX ?? LANE_CENTERS[resolvedTargetLane],
            action: msg.action || existing?.action || 'running',
            jumpY: typeof msg.jumpY === 'number' ? msg.jumpY : existing?.jumpY ?? 0,
            stumbling: Boolean(msg.stumbling),
            finished: Boolean(msg.finished),
            updatedAt: Date.now(),
          };
          remotePlayersRef.current.set(msg.playerId, nextSnapshot);

          const matchedComp = competitorsRef.current.find((c) => c.id === msg.playerId);
          const validation = telemetryValidatorRef.current.inspectTelemetry(
            msg.playerId,
            matchedComp?.name || msg.playerId.slice(0, 10),
            nextSnapshot,
            nextSnapshot.updatedAt
          );
          if (validation.newlyFlagged) {
            setInvestigatingCompetitors(telemetryValidatorRef.current.getInvestigations());
            const flaggedId = msg.playerId;
            setCompetitors((prev) =>
              prev.map((c) =>
                c.id === flaggedId ? { ...c, sessionStatus: 'investigating' } : c
              )
            );
          }
          return;
        }

        if (msg.type === 'room:race-finished' && Array.isArray(msg.rankings)) {
          serverRaceStatusRef.current = 'completed';
          setServerRaceStatus('completed');
          const finishedRoundKey = `${(msg.room?.code || roomConfigRef.current.code || 'ARENA').toUpperCase()}:${msg.raceRound || -1}`;
          if (
            !isSpectatingRef.current &&
            statusRef.current === 'idle' &&
            !startedRoundSetRef.current.has(finishedRoundKey)
          ) {
            return;
          }
          const finishedAsSpectator = isSpectatingRef.current;
          if (typeof msg.raceRound === 'number') {
            activeRaceRoundRef.current = msg.raceRound;
            setActiveRaceRound(msg.raceRound);
          }
          void telemetryValidatorRef.current.flushBatch();
          const finalCompetitorsList = msg.rankings.map((r) => ({
            id: r.id,
            name: !finishedAsSpectator && r.id === myId ? `${r.name} ${t.youTag}` : r.name,
            avatar: r.avatar,
            avatarId: r.avatarId,
            color: r.color,
            lane: (Math.max(0, Math.min(4, r.lane)) as Lane),
            targetLane: (Math.max(0, Math.min(4, r.lane)) as Lane),
            laneX: LANE_CENTERS[Math.max(0, Math.min(4, r.lane)) as Lane],
            yOffset: 0,
            progressDistance: r.progressDistance,
            action: 'running' as const,
            jumpY: 0,
            isBot: r.isBot,
            isPlayer: !finishedAsSpectator && r.id === myId,
            stumbling: false,
            finished: true,
          }));
          applyCompletedRaceOutcomeRef.current(
            finalCompetitorsList,
            msg.betAmount ?? activeBetForRoundRef.current,
            undefined,
            msg.rankings,
            finishedAsSpectator
          );
          return;
        }

        if (msg.type === 'room:kicked' && (!msg.targetId || msg.targetId === myId)) {
          enterSoloLobbyStateRef.current(t.lobby.kickedNotice);
          return;
        }

        if (msg.type === 'room:deleted') {
          enterSoloLobbyStateRef.current(t.app.roomDeletedNotice);
          return;
        }

        if (msg.type === 'room:not-host') {
          setRoomNotice(mpStrings.onlyHostCanStart);
          return;
        }

        if (msg.type === 'room:error') {
          if (msg.code === 'INVITE_ONLY') {
            setServerRoomConnected(false);
            setRoomNotice(t.lobby.inviteOnlyNotice);
          } else if (msg.code === 'ROOM_FULL') {
            setRoomNotice(t.lobby.roomFullNotice);
          }
        }
      } catch {
        // Ignore malformed WS frames
      }
    };

    ws.onclose = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      burstTimers.forEach((tId) => clearTimeout(tId));
      burstTimers.length = 0;
      if (roomWsRef.current === ws) {
        roomWsRef.current = null;
      }
      setServerRoomConnected(false);
      setRoomRttMs(null);
      if (!closedByCleanup) {
        reconnectTimer = setTimeout(() => {
          setWsReconnectNonce((n) => n + 1);
        }, 1800);
      }
    };

    ws.onerror = () => {
      setServerRoomConnected(false);
      setRoomRttMs(null);
    };

    return () => {
      closedByCleanup = true;
      beginSynchronizedCountdownRef.current = null;
      applyServerRoomStateRef.current = null;
      forceSynchronizedRunRef.current = null;
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      burstTimers.forEach((tId) => clearTimeout(tId));
      burstTimers.length = 0;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (roomWsRef.current === ws) {
        roomWsRef.current = null;
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [
    wsRoomSessionKey,
    wsReconnectNonce,
    assignDistinctLanes,
    clearCountdownTimers,
    alignTrackToTop,
    setBalance,
    t.lobby.kickedNotice,
    t.lobby.inviteOnlyNotice,
    t.lobby.roomFullNotice,
    t.app.roomDeletedNotice,
    t.youTag,
    mpStrings.onlyHostCanStart,
  ]);

  // Fallback HTTP de segurança: força verificação via fetch a cada 1 segundo quando o WebSocket
  // perde a conexão (ou ao retomar o separador), sincronizando a largada mesmo com latência
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (wsRoomSessionKey.startsWith('SOLO_IDLE_')) return;
    if (status === 'starting' || status === 'running') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    let cancelled = false;
    let inFlight = false;
    const myId = getSessionPlayerId();

    const pollRoomSync = async () => {
      if (cancelled || inFlight) return;
      if (statusRef.current === 'starting' || statusRef.current === 'running') return;
      const targetCode = (roomConfigRef.current.code || '').trim().toUpperCase();
      if (!targetCode || targetCode === 'ARENA-AO-VIVO') return;

      inFlight = true;
      const reqSentAt = Date.now();
      try {
        const resp = await fetch(`/api/rooms/${encodeURIComponent(targetCode)}`, {
          cache: 'no-store',
        });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          serverTime?: number;
          room?: Parameters<NonNullable<typeof beginSynchronizedCountdownRef.current>>[0]['room'];
        };
        if (!data.ok || !data.room || cancelled) return;

        if (typeof data.serverTime === 'number') {
          const rtt = Math.max(0, Date.now() - reqSentAt);
          if (!hasCalibratedClockRef.current || rtt < bestRttRef.current) {
            bestRttRef.current = Math.min(bestRttRef.current, rtt);
            serverClockOffsetRef.current = data.serverTime - (reqSentAt + rtt * 0.5);
            hasCalibratedClockRef.current = true;
          }
        }

        latestServerRoomRef.current = data.room;
        applyServerRoomStateRef.current?.(false);

        const meInRoom = data.room.participants.find((p) => p.id === myId);
        const startAt = data.room.syncedRaceStartAt ?? data.room.raceStartAt;
        const roundNum = data.room.raceRound;
        const seedVal = data.room.raceSeed;
        const roundKey = `${(data.room.code || targetCode).toUpperCase()}:${roundNum}`;
        if (
          (data.room.raceStatus === 'starting' ||
            (data.room.raceStatus === 'running' && meInRoom && meInRoom.isSpectating !== true)) &&
          typeof startAt === 'number' &&
          typeof roundNum === 'number' &&
          typeof seedVal === 'number' &&
          (statusRef.current === 'idle' || statusRef.current === 'completed') &&
          !isSpectatingRef.current &&
          (!startedRoundSetRef.current.has(roundKey) ||
            roundNum < activeRaceRoundRef.current ||
            (roundNum === activeRaceRoundRef.current &&
              activeRaceSeedRef.current !== null &&
              seedVal !== activeRaceSeedRef.current))
        ) {
          beginSynchronizedCountdownRef.current?.({
            room: data.room,
            raceRound: roundNum,
            raceSeed: seedVal,
            raceStartAt: startAt,
            betAmount: data.room.betAmount,
            serverTime: data.serverTime,
          });
        }
      } catch {
        // Ignora erro transitório de rede no polling de fallback
      } finally {
        inFlight = false;
      }
    };

    const wsDisconnected =
      !serverRoomConnected || roomWsRef.current?.readyState !== WebSocket.OPEN;
    if (wsDisconnected) {
      void pollRoomSync();
    }

    const handleResumeSync = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        void pollRoomSync();
      }
    };
    window.addEventListener('focus', handleResumeSync);
    document.addEventListener('visibilitychange', handleResumeSync);

    const intervalMs = wsDisconnected ? 1000 : 2500;
    const timer = setInterval(() => {
      void pollRoomSync();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', handleResumeSync);
      document.removeEventListener('visibilitychange', handleResumeSync);
    };
  }, [wsRoomSessionKey, status, serverRoomConnected]);

  const handleRemoveCompetitor = (id: string) => {
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
      setRoomNotice(mpStrings.onlyLeaderControlsRoom);
      return;
    }
    const target = competitors.find((c) => c.id === id);
    if (!target || target.isPlayer) return;

    removedLocalIdsRef.current.add(id);
    setCompetitors((prev) => prev.filter((c) => c.id !== id));

    if (!target.isBot && !id.startsWith('friend-') && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch(`/api/rooms/${encodeURIComponent(roomConfig.code)}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: getSessionPlayerId(),
          targetId: id,
        }),
      }).catch(() => {});
    }
  };

  const handleToggleFillBots = () => {
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
      setRoomNotice(mpStrings.onlyLeaderControlsRoom);
      return;
    }
    const nextFill = !roomConfig.fillWithBots;
    setRoomConfig((prev) => ({ ...prev, fillWithBots: nextFill }));
    setCompetitors((prev) => fitCompetitorsToCapacity(prev, roomConfig.maxPlayers, nextFill));
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room') || url.searchParams.has('sala')) {
        url.searchParams.set('bots', nextFill ? 'true' : 'false');
        window.history.replaceState(window.history.state, '', url.toString());
      }
    }
    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:update-config',
          roomCode: roomConfig.code,
          fillWithBots: nextFill,
        })
      );
    }
    if (
      !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomConfig.code,
          requesterId: getSessionPlayerId(),
          fillWithBots: nextFill,
        }),
      }).catch(() => {});
    }
  };

  const handleRegenerateRoomCode = () => {
    if (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost) {
      setRoomNotice(mpStrings.onlyLeaderControlsRoom);
      return;
    }
    const newCode = `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;
    const myId = getSessionPlayerId();
    markCreatedRoomSession(newCode, myId);
    isAutoMatchRef.current = false;
    viaInviteRef.current = false;
    isRoomCreatorRef.current = true;
    setIsLocalRoomHost(true);
    setWsRoomSessionKey(`EXPLICIT_${newCode}_${Date.now()}`);
    const updatedCfg: RoomConfig = { ...roomConfig, code: newCode };
    setRoomConfig(updatedCfg);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', newCode);
      window.history.replaceState(
        { reiCreatorRoom: newCode.toUpperCase(), reiCreatorId: myId },
        '',
        url.toString()
      );
    }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const myAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedCfg,
          creatorId: myId,
          requesterId: myId,
          player: {
            id: myId,
            name: playerName,
            avatar: myAvatar.avatar,
            avatarId: myAvatar.id,
            color: myAvatar.color,
          },
        }),
      }).catch(() => {});
    }
  };

  // Seleção e Compra de Avatares
  const handleSelectAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    const item = getLocalizedAvatar(avatarId, lang);
    const displayName = playerName && playerName !== 'REI ZERO' ? playerName : item.name;
    setCompetitors((prev) =>
      prev.map((c) =>
        c.isPlayer
          ? {
              ...c,
              avatar: item.avatar,
              avatarId: item.id,
              color: item.color,
              name: `${displayName} ${t.youTag}`,
            }
          : c
      )
    );
    const ws = roomWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && !needsInviteOnboarding) {
      ws.send(
        JSON.stringify({
          type: 'room:profile-ready',
          roomCode: roomConfig.code,
          player: {
            id: getSessionPlayerId(),
            name: displayName,
            avatar: item.avatar,
            avatarId: item.id,
            color: item.color,
          },
        })
      );
    }
  };

  // Atualiza dinamicamente nomes de bots e avatar do jogador ao trocar de idioma
  useEffect(() => {
    const localizedPlayerAvatar = getLocalizedAvatar(selectedAvatarId, lang);
    setCompetitors((prev) =>
      prev.map((c) => {
        if (c.isPlayer) {
          const baseName =
            playerName && playerName !== 'REI ZERO' ? playerName : localizedPlayerAvatar.name;
          return { ...c, name: `${baseName} ${t.youTag}` };
        }
        if (c.isBot) {
          const localizedBot = getLocalizedBot(c.id, lang);
          return { ...c, name: localizedBot.name };
        }
        return c;
      })
    );
  }, [lang, selectedAvatarId, playerName, t.youTag]);

  const handleBuyAvatar = (item: AvatarItem) => {
    if (balance < item.priceKz) return;
    setBalance((prev) => prev - item.priceKz);
    setUnlockedAvatars((prev) => [...prev, item.id]);
    handleSelectAvatar(item.id);
  };

  const handleBuyPasseDoRei = () => {
    if (balance < PASSE_DO_REI_MONTHLY_KZ) return;
    setBalance((prev) => prev - PASSE_DO_REI_MONTHLY_KZ);
    setHasPasseDoRei(true);
  };

  const currentAvatar = getLocalizedAvatar(selectedAvatarId, lang);
  const activePoolBet = showPodium ? activeBetForRoundRef.current || betAmount : betAmount;
  const activePoolPlayers =
    competitors.filter((c) => !c.isSpectating).length || competitors.length;
  const torneirasPool = calculateThreeTorneiras(activePoolBet, activePoolPlayers);

  // Rota Administrativa /admin-rei-zero
  if (isAdminRoute) {
    return (
      <AdminPanel
        onBackToGame={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
          }
          setIsAdminRoute(false);
        }}
      />
    );
  }

  const hasInviteParam =
    typeof window !== 'undefined' &&
    Boolean(
      new URLSearchParams(window.location.search).get('room') ||
        new URLSearchParams(window.location.search).get('sala')
    );

  return (
    <VoiceChatProvider
      roomCode={roomConfig.code}
      playerName={playerName}
      playerAvatar={currentAvatar.avatar}
      hasInviteLink={hasInviteParam}
      raceRound={activeRaceRound > 0 ? activeRaceRound : roundNonce}
      raceStatus={status}
      investigatingCompetitors={investigatingCompetitors}
    >
      <div
        style={
          {
            '--op-primary': currentOperator.primaryColor,
            '--op-accent': currentOperator.accentColor,
          } as React.CSSProperties
        }
        className={`min-h-screen flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950 transition-colors duration-500 ${
          timeMode === 'night' ? 'arena-stage-night text-zinc-100' : 'arena-stage-day text-zinc-100'
        }`}
      >
      {/* 0. Barra B2B de Operadora Parceira (BetAngola, Elephant Bet, BantuBet, etc.) */}
      <OperatorSelector
        currentOperator={currentOperator}
        onSelectOperator={setCurrentOperator}
        onOpenProvablyFair={() => setIsProvablyFairOpen(true)}
      />

      {/* 1. Cabeçalho com controles e identidade oficial */}
      <GameHeader
        status={status}
        elapsedSeconds={elapsedSeconds}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        onOpenProvablyFair={() => setIsProvablyFairOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        coinsCollected={coinsCollected}
        onResetBalance={() => setDemoBalance((prev) => prev + 1_000_000)}
        isDemo={isDemo}
        onToggleDemo={() => {
          setIsDemo((prev) => {
            const next = !prev;
            if (isAutoMatchRef.current) {
              setWsRoomSessionKey(`AUTO_PUBLIC_${next ? 'DEMO' : 'REAL'}_${Date.now()}`);
            }
            return next;
          });
        }}
        onOpenLobby={() => setLobbyOpen(true)}
        onOpenRanking={() => setRankingOpen(true)}
        onOpenShop={() => setShopOpen(true)}
        onOpenAdmin={() => setIsAdminRoute(true)}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((prev) => (prev === '2d' ? '3d' : '2d'))}
        timeMode={timeMode}
        onToggleTimeMode={() => setTimeMode((prev) => (prev === 'day' ? 'night' : 'day'))}
        rttMs={roomRttMs}
        serverConnected={serverRoomConnected}
        canSpectate={
          status === 'idle' &&
          !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
          (serverRaceStatus === 'running' || serverRaceStatus === 'starting')
        }
        isSpectating={isSpectating}
        onSpectate={handleEnterSpectatorMode}
        onOpenSpectatorOverview={() => setSpectatorOverviewOpen(true)}
      />

      {/* 2. Área Central de Corrida */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Pista de 5 Faixas (Modo 2D ou 3D Three.js) */}
        <section
          id="race-track-section"
          className={`w-full lg:w-[520px] shrink-0 flex flex-col items-center scroll-mt-4 gap-2 rounded-2xl transition-[transform,box-shadow] duration-300 ease-out will-change-transform ${
            status === 'starting' || countdownValue !== null
              ? 'hover:scale-[1.015] hover:shadow-[0_16px_40px_rgba(245,158,11,0.22)]'
              : 'hover:scale-[1.01] hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]'
          }`}
        >
          {/* Barra Permanente de Controlo da Sala (Layout responsivo em 2 linhas no telemóvel + QR Code) */}
          <div className="w-full game-panel rounded-2xl px-3 py-2.5 flex flex-col gap-2">
            {/* Linha 1: Info da Sala + Botão Lobby */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl game-subplate flex items-center justify-center shrink-0">
                  <span className="text-base">🏟️</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-400">
                      {t.app.roomBarTitle}
                    </span>
                    <span className="text-[11px] font-mono font-black text-amber-300 truncate max-w-[120px]">
                      {roomConfig.code}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                      ({competitors.length}/{roomConfig.maxPlayers})
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 block leading-tight truncate">
                    {(roomConfig.accessMode || 'invite-only') === 'random'
                      ? t.app.accessRandomBadge
                      : t.app.accessInviteBadge}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={status === 'running' || status === 'starting'}
                onClick={() => setLobbyOpen(true)}
                className="px-2.5 py-1.5 rounded-xl game-btn-secondary text-zinc-200 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Users size={12} className="text-amber-400" />
                <span>{t.app.openLobbyBtn}</span>
              </button>
            </div>

            {/* Linha 2 (Grid 2x2 no mobile / 4 colunas em ecrãs maiores): Access Mode, Share Room, QR Code e Delete Room */}
            <motion.div
              variants={roomControlGridVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full"
            >
              <motion.button
                variants={roomControlItemVariants}
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={
                  status === 'running' ||
                  status === 'starting' ||
                  (!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost)
                }
                onClick={() => handleToggleAccessMode()}
                className={`w-full px-2 py-2 sm:py-1.5 rounded-xl border text-[10px] font-mono font-black flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  (roomConfig.accessMode || 'invite-only') === 'random'
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/60 text-emerald-300'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-300'
                }`}
              >
                {(roomConfig.accessMode || 'invite-only') === 'random' ? (
                  <Shuffle size={12} className="shrink-0" />
                ) : (
                  <Lock size={12} className="shrink-0" />
                )}
                <span className="truncate">
                  {(roomConfig.accessMode || 'invite-only') === 'random'
                    ? t.app.accessRandomBtn
                    : t.app.accessInviteBtn}
                </span>
              </motion.button>

              <motion.button
                variants={roomControlItemVariants}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={handleShareRoomUrl}
                className={`w-full px-2 py-2 sm:py-1.5 rounded-xl border text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  roomUrlCopied
                    ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-300'
                    : 'game-btn-secondary border-zinc-700 text-zinc-200 hover:text-amber-300'
                }`}
              >
                {roomUrlCopied ? (
                  <Check size={12} className="text-emerald-400 shrink-0" />
                ) : (
                  <Share2 size={12} className="text-amber-400 shrink-0" />
                )}
                <span className="truncate">{roomUrlCopied ? t.lobby.copiedBtn : 'Share Room'}</span>
              </motion.button>

              <motion.button
                variants={roomControlItemVariants}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => {
                  if (!showTrackQr) {
                    ensureShareableCreatorRoom();
                  }
                  setShowTrackQr((prev) => !prev);
                }}
                className={`w-full px-2 py-2 sm:py-1.5 rounded-xl border text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  showTrackQr
                    ? 'bg-amber-500 text-zinc-950 border-amber-300 font-black'
                    : 'game-btn-secondary border-zinc-700 text-zinc-200 hover:text-amber-300'
                }`}
              >
                <QrCode size={12} className={showTrackQr ? 'text-zinc-950 shrink-0' : 'text-amber-400 shrink-0'} />
                <span className="truncate">QR Code</span>
              </motion.button>

              <motion.div variants={roomControlItemVariants} className="w-full">
                {!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    disabled={status === 'running' || status === 'starting'}
                    onClick={handleLeaveRoom}
                    className="w-full px-2 py-2 sm:py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <LogOut size={12} className="shrink-0" />
                    <span className="truncate">{mpStrings.leaveRoomBtn}</span>
                  </motion.button>
                ) : confirmDeleteMain ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-2 gap-1 w-full"
                  >
                    <button
                      type="button"
                      onClick={handleDeleteRoom}
                      className="w-full px-1.5 py-2 sm:py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-black cursor-pointer truncate"
                    >
                      {t.app.deleteRoomConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteMain(false)}
                      className="w-full px-1.5 py-2 sm:py-1.5 rounded-xl game-btn-secondary text-zinc-300 text-[10px] font-mono font-bold cursor-pointer truncate"
                    >
                      {t.app.deleteRoomCancel}
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    disabled={status === 'running' || status === 'starting'}
                    onClick={() => setConfirmDeleteMain(true)}
                    className="w-full px-2 py-2 sm:py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} className="shrink-0" />
                    <span className="truncate">{t.app.deleteRoomBtn}</span>
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
          </div>

          {roomNotice && (
            <div className="w-full px-3 py-2 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-[11px] font-mono font-bold flex items-center justify-between gap-2">
              <span>{roomNotice}</span>
              <button
                type="button"
                onClick={() => setRoomNotice(null)}
                className="text-amber-300 hover:text-white font-black cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {waitingForOpponent && status === 'idle' && (
            <div className="w-full px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/60 text-amber-200 text-xs font-mono font-bold flex items-center gap-2 animate-pulse">
              <span className="text-base">⏳</span>
              <span>
                {waitingOpponentNames.length > 0
                  ? `${mpStrings.waitingOpponentSelecting} (${mpStrings.waitingOpponentNamesPrefix} ${waitingOpponentNames.join(', ')})`
                  : mpStrings.waitingOpponentSelecting}
              </span>
            </div>
          )}

          {status === 'idle' &&
            !isSpectating &&
            !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
            (serverRaceStatus === 'running' || serverRaceStatus === 'starting') && (
              <div
                data-testid="inactive-spectator-banner"
                className="w-full px-3 py-2.5 rounded-2xl bg-sky-950/75 border border-sky-400/55 text-sky-100 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-lg"
              >
                <span className="font-semibold flex items-center gap-1.5 min-w-0">
                  <span>👻</span>
                  <span className="truncate">{mpStrings.raceInProgressBanner}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="main-spectator-overview-btn"
                    onClick={() => setSpectatorOverviewOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/25 hover:bg-sky-500/40 border border-sky-300/60 text-sky-100 font-black text-[11px] uppercase cursor-pointer transition-colors whitespace-nowrap"
                  >
                    📊 {mpStrings.spectatorOverviewBtn}
                  </button>
                  <button
                    type="button"
                    onClick={handleEnterSpectatorMode}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-cyan-200 text-zinc-950 font-black text-[11px] uppercase cursor-pointer transition-colors whitespace-nowrap"
                  >
                    👻 {mpStrings.watchLiveRaceBtn}
                  </button>
                </div>
              </div>
            )}

          {pendingSyncPodium && status === 'completed' && !showPodium && (
            <div className="w-full px-3 py-2 rounded-xl bg-emerald-950/70 border border-emerald-400/50 text-emerald-200 text-xs font-mono font-bold flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              <span>{mpStrings.syncingPodiumNote}</span>
            </div>
          )}

          <VoiceSpeakerOverlay status={status} lobbyOpen={lobbyOpen} />
          <VoiceChatPanel variant="compact" roomCode={roomConfig.code} />
          <GameCanvas
            status={status}
            countdownValue={countdownValue}
            elapsedSeconds={elapsedSeconds}
            competitors={competitors}
            viewMode={viewMode}
            timeMode={timeMode}
            onFinish={handleRaceFinish}
            onCoinCollected={handleCoinCollected}
            onTimeUpdate={(sec) => setElapsedSeconds(sec)}
            onCompetitorsProgress={isSpectating ? setLiveCanvasRunners : undefined}
            onRankUpdate={(rank) => setUserRank(rank)}
            onRestart={handleReturnToLobby}
            roundNonce={roundNonce}
            pause3d={showPodium || lobbyOpen || showTrackQr || spectatorOverviewOpen}
            isDemo={isDemo}
            betAmountKz={betAmount}
            raceSeed={raceSeed}
            syncedRaceStartAt={syncedRaceStartAt}
            remotePlayersRef={remotePlayersRef}
            onLocalRaceTelemetry={handleLocalRaceTelemetry}
            isSpectating={isSpectating}
            spectatedRunnerId={spectatedRunnerId}
            onSelectSpectatedRunner={setSpectatedRunnerId}
            onExitSpectator={handleExitSpectatorMode}
            onOpenSpectatorOverview={() => setSpectatorOverviewOpen(true)}
          />
        </section>

        {/* Painel Lateral: Corredor Atual e Apostas com as 3 Torneiras */}
        <section
          id="betting-panel-section"
          className="w-full flex-1 flex flex-col gap-4 max-w-md scroll-mt-4"
        >
          {/* Card do Corredor Selecionado + Hot Streak Badge */}
          <div className="game-panel-gold rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-14 h-14 rounded-2xl game-subplate border border-amber-400/40 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(245,158,11,0.22)]">
                <AvatarDoll
                  avatarId={currentAvatar.id}
                  name={currentAvatar.name}
                  color={currentAvatar.color}
                  size={50}
                  variant="full"
                  className="filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.65)]"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider font-mono">
                    {t.app.yourAvatarLane3}
                  </span>
                  {top3Streak > 0 && (
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/50">
                      🔥 {top3Streak}x Top 3
                    </span>
                  )}
                </div>
                <span className="text-base font-black text-zinc-100 block truncate">
                  {currentAvatar.name}
                </span>
                <span className="text-[11px] text-zinc-400 block leading-tight truncate">
                  {currentAvatar.title}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShopOpen(true)}
              className="px-3.5 py-2 rounded-xl game-btn-secondary text-xs text-amber-300 font-bold cursor-pointer shrink-0"
            >
              {t.app.changeSkinBtn}
            </button>
          </div>

          {/* Painel de Apostas Oficial com as 3 Torneiras */}
          <BettingPanel
            status={status}
            balanceKz={balance}
            betAmountKz={betAmount}
            elapsedSeconds={elapsedSeconds}
            playerRank={userRank}
            onBetChange={handleMainBetChange}
            onStartRound={() => handleStartRound(false)}
            lastPayoutKz={lastPayout}
            lastRank={userRank}
            isDemo={isDemo}
            playerAvatar={currentAvatar}
            competitors={competitors}
            maxPlayers={roomConfig.maxPlayers}
            isMultiplayerGuest={!wsRoomSessionKey.startsWith('SOLO_IDLE_') && !isLocalRoomHost}
            hostName={roomConfig.hostName}
            waitingForOpponent={waitingForOpponent}
            waitingOpponentNames={waitingOpponentNames}
            connectedHumansCount={connectedHumansCount}
            onRechargeDemo={() => setDemoBalance((prev) => prev + 1_000_000)}
            onEditingStateChange={setIsEditingRoomOrProfile}
          />

          {/* Resumo Animado de Análise de Desempenho da Última Corrida */}
          {lastPerformance && status === 'idle' && (
            <PerformanceAnalysisWidget
              performance={lastPerformance}
              userRank={userRank}
              compact
            />
          )}

          {/* Coach IA Tático com Gemini (disponível no lobby e pós-corrida) */}
          {status === 'idle' && (
            <AiCoachPanel
              playerName={playerName}
              avatarName={currentAvatar.name}
              performance={lastPerformance}
              userRank={userRank}
              mode={lastPerformance ? 'post-race' : 'tactical'}
            />
          )}

          {/* Widget de Missões Diárias */}
          <DailyMissionsWidget
            state={dailyMissionsState}
            onClaimReward={handleClaimDailyMission}
            onClaimAllRewards={handleClaimAllDailyMissions}
            isDemo={isDemo}
          />

          {/* Histórico Verificado de Partidas & Prémios */}
          <MatchHistoryCard history={history} />
        </section>
      </main>

      {/* 3. Rodapé Legal e Identidade Oficial */}
      <footer className="mt-auto game-panel border-x-0 border-b-0 border-t border-amber-500/20 py-3.5 px-6 text-xs text-zinc-400 font-mono">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <span>👑</span>
              <span>REI RUN</span>
            </span>
            <span>|</span>
            <span className="text-zinc-300">HAMILTON DAVID NIHEFE MUENDA - O ZERO</span>
            <span>|</span>
            <span>{t.app.footerMeta}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-zinc-500">
              {t.app.footerPhraseLabel} &quot;{t.officialPhrase}&quot;
            </span>
            <span>|</span>
            <button
              type="button"
              onClick={() => setIsAdminRoute(true)}
              className="text-amber-400 hover:text-amber-300 underline cursor-pointer font-bold"
              title="/admin-rei-zero"
            >
              /admin-rei-zero
            </button>
          </div>
        </div>
      </footer>

      {/* Modais */}
      <AnimatePresence>
        {!isLoadingScreen && needsInviteOnboarding && (
          <InviteOnboardingModal
            roomConfig={roomConfig}
            isDemo={isDemo}
            initialAvatarId={selectedAvatarId}
            hostWaitingForStart={waitingForOpponent}
            onComplete={handleCompleteInviteOnboarding}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lobbyOpen && !needsInviteOnboarding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <LobbyRoom
              roomConfig={roomConfig}
              competitors={competitors}
              onStartRace={() => handleStartRound(true)}
              onToggleFillBots={handleToggleFillBots}
              onAddFriendSimulation={handleAddFriendSimulation}
              onRemoveCompetitor={handleRemoveCompetitor}
              onRegenerateRoomCode={handleRegenerateRoomCode}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onUpdateMaxPlayers={handleUpdateMaxPlayers}
              onToggleAccessMode={handleToggleAccessMode}
              onUpdateBet={handleMainBetChange}
              onDeleteRoom={handleDeleteRoom}
              onLeaveRoom={handleLeaveRoom}
              onFindRandomRoom={handleFindRandomRoom}
              onEnsureShareableRoom={ensureShareableCreatorRoom}
              onEditingStateChange={setIsEditingRoomOrProfile}
              roomNotice={roomNotice}
              playerName={playerName}
              onChangePlayerName={handleChangePlayerName}
              serverConnected={serverRoomConnected}
              isDemo={isDemo}
              onCloseLobby={() => setLobbyOpen(false)}
              streak={top3Streak}
              isRoomHost={wsRoomSessionKey.startsWith('SOLO_IDLE_') || isLocalRoomHost}
              waitingForOpponent={waitingForOpponent}
              waitingOpponentNames={waitingOpponentNames}
              connectedHumansCount={connectedHumansCount}
              serverRaceStatus={serverRaceStatus}
              canSpectate={
                status === 'idle' &&
                !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
                (serverRaceStatus === 'running' || serverRaceStatus === 'starting')
              }
              onEnterSpectatorMode={handleEnterSpectatorMode}
              onOpenSpectatorOverview={() => {
                setLobbyOpen(false);
                setSpectatorOverviewOpen(true);
              }}
              chatMessages={roomChatMessages}
              onSendChatMessage={handleSendRoomChatMessage}
              localPlayerId={getSessionPlayerId()}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPodium && (
          <PodiumErrorBoundary onRecover={handleReturnToLobby}>
            <ResultsPodium
              showPodium={showPodium}
              competitors={competitors}
              userWonPayout={lastPayout || 0}
              userRank={userRank}
              betAmountKz={activeBetForRoundRef.current || betAmount}
              threeTorneiras={torneirasPool}
              authoritativeRankings={authoritativeRankings}
              streak={top3Streak}
              performance={lastPerformance}
              returnTarget={startedFromRoomRef.current || wasSpectatorOutcome ? 'room' : 'lobby'}
              onPlayAgain={() => handleStartRound(startedFromRoomRef.current)}
              onBackToLobby={handleReturnToLobby}
              isDemo={isDemo}
              isSpectator={wasSpectatorOutcome}
              canPlayAgain={
                !wasSpectatorOutcome &&
                balance >= betAmount &&
                (wsRoomSessionKey.startsWith('SOLO_IDLE_') || isLocalRoomHost)
              }
            />
          </PodiumErrorBoundary>
        )}
      </AnimatePresence>

      <Top3StreakCelebrationOverlay
        celebration={top3Celebration}
        onDismiss={handleDismissTop3Celebration}
      />

      <RankingModal isOpen={rankingOpen} onClose={() => setRankingOpen(false)} />

      <ShopModal
        isOpen={shopOpen}
        onClose={() => setShopOpen(false)}
        userBalanceKz={balance}
        selectedAvatarId={selectedAvatarId}
        unlockedAvatars={unlockedAvatars}
        hasPasseDoRei={hasPasseDoRei}
        onSelectAvatar={handleSelectAvatar}
        onBuyAvatar={handleBuyAvatar}
        onBuyPasseDoRei={handleBuyPasseDoRei}
      />

      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />

      <HowToPlayTutorialModal
        isOpen={howToPlayTutorialOpen}
        onClose={() => {
          setHowToPlayTutorialOpen(false);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('rei_zero_how_to_play_seen_v1', 'true');
            } catch {
              // Ignore storage errors
            }
          }
        }}
      />

      <SpectatorOverviewModal
        isOpen={spectatorOverviewOpen}
        onClose={() => setSpectatorOverviewOpen(false)}
        runners={overviewRunners}
        isSpectating={isSpectating}
        canSpectate={
          status === 'idle' &&
          !wsRoomSessionKey.startsWith('SOLO_IDLE_') &&
          (serverRaceStatus === 'running' || serverRaceStatus === 'starting')
        }
        spectatedRunnerId={spectatedRunnerId}
        onSelectSpectatedRunner={setSpectatedRunnerId}
        onEnterSpectatorMode={handleEnterSpectatorWithFocus}
        roomCode={roomConfig.code}
        raceRound={activeRaceRound || serverRaceRoundRef.current || 1}
        raceStatus={isSpectating ? status : serverRaceStatus}
        elapsedSeconds={overviewElapsedSeconds}
        betAmountKz={roomConfig.betAmount}
        serverConnected={serverRoomConnected}
      />

      {/* 3.1 Modal de Verificação Provably Fair iGaming */}
      <ProvablyFairModal
        isOpen={isProvablyFairOpen}
        onClose={() => setIsProvablyFairOpen(false)}
      />

      {/* 3.2 Modal de QR Code da Sala (#race-track-section) */}
      <AnimatePresence>
        {showTrackQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTrackQr(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-3xl game-panel-gold p-5 shadow-[0_0_60px_rgba(245,158,11,0.38)] flex flex-col items-center text-center gap-3.5"
            >
              <button
                type="button"
                onClick={() => setShowTrackQr(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label={t.rules.closeBtn}
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 pr-6">
                <span className="text-2xl">👑</span>
                <div className="text-left">
                  <h4 className="text-base font-black uppercase text-amber-400 tracking-wide">
                    {t.lobby.qrModalTitle}
                  </h4>
                  <span className="text-[11px] font-mono text-zinc-400 block">
                    {roomConfig.title} · <strong className="text-amber-300">{roomConfig.code}</strong>
                  </span>
                </div>
              </div>

              <div className="w-full p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
                {trackQrCameraActive ? t.lobby.scanSub : t.lobby.qrModalHint}
              </div>

              <div className="relative w-60 h-60 flex items-center justify-center">
                <AnimatePresence initial={false}>
                  {trackQrCameraActive ? (
                    <motion.div
                      key="track-qr-camera"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.24, ease: 'easeInOut' }}
                      className="absolute inset-0 w-60 h-60 rounded-2xl overflow-hidden border-4 border-amber-400/90 shadow-[0_0_28px_rgba(245,158,11,0.35)] bg-black"
                    >
                      <video
                        ref={trackQrVideoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Visual Alignment Mask & Viewfinder Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {/* Cutout with dimmed surround */}
                        <div className="relative w-40 h-40 rounded-2xl border border-amber-300/35 shadow-[0_0_0_9999px_rgba(0,0,0,0.52)] overflow-hidden">
                          {/* 4 Corner Alignment Brackets */}
                          <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl drop-shadow-[0_0_8px_rgba(245,158,11,0.85)]" />
                          <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl drop-shadow-[0_0_8px_rgba(245,158,11,0.85)]" />
                          <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl drop-shadow-[0_0_8px_rgba(245,158,11,0.85)]" />
                          <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl drop-shadow-[0_0_8px_rgba(245,158,11,0.85)]" />

                          {/* Center Target Crosshair */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-5 h-5 opacity-75">
                              <span className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-amber-300" />
                              <span className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-amber-300" />
                            </div>
                          </div>

                          {/* Animated Scan Sweep Line */}
                          <motion.div
                            initial={{ y: 8 }}
                            animate={{ y: 148 }}
                            transition={{
                              duration: 1.7,
                              repeat: Infinity,
                              repeatType: 'reverse',
                              ease: 'easeInOut',
                            }}
                            className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_rgba(251,191,36,0.95)]"
                          />
                        </div>

                        {/* Top Live Scanner Tag */}
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-zinc-950/85 border border-amber-400/40 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[9px] font-mono font-black uppercase tracking-widest text-amber-300">
                            QR SCAN
                          </span>
                        </div>

                        {/* Bottom Alignment Instruction */}
                        <div className="absolute bottom-2 inset-x-2.5 px-2 py-1 rounded-lg bg-zinc-950/85 border border-white/10 text-[10px] font-mono text-zinc-200 leading-tight truncate">
                          {t.lobby.cameraHint}
                        </div>
                      </div>

                      <canvas ref={trackQrCanvasRef} className="hidden" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="track-qr-static"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.24, ease: 'easeInOut' }}
                      className="absolute inset-0 p-2 bg-white rounded-2xl shadow-xl border-4 border-amber-500/60 flex items-center justify-center"
                    >
                      {trackQrDataUrl ? (
                        <img
                          src={trackQrDataUrl}
                          alt={`QR ${roomConfig.code}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-600 font-mono text-xs">
                          QR...
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {trackQrCameraError && (
                <div className="w-full p-2 rounded-xl bg-rose-950/75 border border-rose-700 text-rose-300 text-[11px] font-mono">
                  {trackQrCameraError}
                </div>
              )}

              <div className="w-full grid grid-cols-3 gap-2 text-[11px] font-mono text-zinc-300 game-subplate p-2.5 rounded-xl">
                <div>
                  <span className="text-zinc-500 block text-[9px] uppercase">{t.lobby.hostLabel}</span>
                  <span className="font-bold text-amber-400 truncate block">{roomConfig.hostName}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px] uppercase">{t.lobby.betLabel}</span>
                  <span className="font-bold text-emerald-400 block">
                    {formatMoney(roomConfig.betAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px] uppercase">{t.lobby.tabArena}</span>
                  <span className="font-bold text-zinc-100 block">
                    {competitors.length}/{roomConfig.maxPlayers}
                  </span>
                </div>
              </div>

              <div className="w-full flex flex-col gap-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyQrInviteUrl}
                    className="py-2.5 px-3 rounded-xl game-btn-gold text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {qrInviteCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="truncate">{qrInviteCopied ? t.lobby.copiedBtn : t.lobby.copyBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (trackQrCameraActive) stopTrackQrCamera();
                      else startTrackQrScanner();
                    }}
                    className={`py-2.5 px-3 rounded-xl border font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
                      trackQrCameraActive
                        ? 'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-zinc-950'
                    }`}
                  >
                    <Camera size={14} className="shrink-0" />
                    <span className="truncate">
                      {trackQrCameraActive ? t.lobby.stopCamera : t.lobby.tabScan}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadTrackQr}
                    disabled={!trackQrDataUrl}
                    className="py-2 px-3 rounded-xl game-btn-secondary text-zinc-200 font-bold text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Download size={13} />
                    <span>{t.lobby.downloadQr}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTrackQr(false)}
                    className="py-2 px-3 rounded-xl game-btn-secondary text-zinc-300 font-bold text-xs font-mono cursor-pointer"
                  >
                    {t.rules.closeBtn}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Tela Oficial de Carregamento (Loading Splash Screen) */}
      <AnimatePresence>
        {isLoadingScreen && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 arena-stage-night flex flex-col items-center justify-center p-6 text-center select-none"
          >
            {/* Ambient Gold Glow */}
            <div className="absolute w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.8, type: 'tween', ease: 'easeOut' }}
              className="relative z-10 flex flex-col items-center max-w-md w-full game-panel-gold rounded-3xl p-7"
            >
              <div className="relative mb-4">
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-b from-amber-400/25 to-amber-600/10 border border-amber-400/40 flex items-center justify-center shadow-[0_0_32px_rgba(245,158,11,0.45)]">
                  <motion.div
                    aria-hidden="true"
                    data-testid="splash-loading-ring"
                    animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                    transition={
                      shouldReduceMotion
                        ? undefined
                        : { duration: 2.6, repeat: Infinity, ease: 'linear' }
                    }
                    style={{ willChange: 'transform' }}
                    className="absolute -inset-1 rounded-full border-2 border-transparent border-t-amber-300 border-r-amber-400/70 pointer-events-none"
                  />
                  <motion.span
                    data-testid="splash-loading-icon"
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : { rotate: [-6, 6, -6], scale: [1, 1.05, 1] }
                    }
                    transition={
                      shouldReduceMotion
                        ? undefined
                        : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                    }
                    style={{ willChange: 'transform' }}
                    className="inline-block text-6xl filter drop-shadow-[0_0_18px_rgba(245,158,11,0.9)]"
                  >
                    👑
                  </motion.span>
                </div>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 font-black px-2.5 py-0.5 rounded-full border border-amber-200 shadow-md whitespace-nowrap">
                  REI ZERO
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-amber-400 font-display mb-1 drop-shadow-[0_2px_12px_rgba(245,158,11,0.4)]">
                REI RUN
              </h1>
              <span className="text-xs font-mono font-bold text-amber-300/90 tracking-widest uppercase mb-1">
                {t.loading.officialGame}
              </span>
              <p className="text-xs font-mono text-zinc-400 mb-4">
                {t.loading.createdBy}{' '}
                <strong className="text-zinc-100">HAMILTON DAVID NIHEFE MUENDA - O ZERO</strong>
              </p>

              {/* Frase Oficial */}
              <div className="p-3 game-subplate border border-amber-500/35 rounded-xl mb-5 w-full">
                <span className="text-xs sm:text-sm font-mono font-black text-amber-300">
                  &quot;{t.officialPhrase}&quot;
                </span>
              </div>

              {/* Barra de Progresso de Carregamento */}
              <div className="w-full game-subplate rounded-full h-3 overflow-hidden mb-3 p-0.5">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.2, ease: 'easeInOut' }}
                  className="bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-400 h-full rounded-full shadow-[0_0_12px_rgba(250,204,21,0.65)]"
                />
              </div>

              <div className="flex items-center justify-between w-full text-[10px] font-mono text-zinc-400 mb-6 gap-2">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <motion.span
                    aria-hidden="true"
                    animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                    transition={
                      shouldReduceMotion
                        ? undefined
                        : { duration: 1.4, repeat: Infinity, ease: 'linear' }
                    }
                    className="inline-flex shrink-0"
                  >
                    <Loader2 className="w-3.5 h-3.5 text-amber-400" />
                  </motion.span>
                  <span className="truncate">{t.loading.statsLine}</span>
                </span>
                <span className="text-amber-400 font-bold shrink-0">{t.loading.skill100}</span>
              </div>

              <button
                type="button"
                onClick={() => setIsLoadingScreen(false)}
                className="w-full px-6 py-3.5 min-h-[46px] rounded-xl game-btn-gold font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                {t.loading.enterGameBtn}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Global de Idioma, Deteção de País e Conversão de Moeda */}
      <LanguageGeoModal />

      {/* Indicador de Status Offline e Sincronização Local com Servidor */}
      <OfflineIndicator />
      </div>
    </VoiceChatProvider>
  );
}
