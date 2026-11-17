import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
} from './types/game';
import { Trash2, Shuffle, Lock, Users } from 'lucide-react';
import { TOTAL_GAME_TIME_SECONDS, LANE_CENTERS, RIVAL_LANE_SLOTS } from './game/constants';
import { ANGOLAN_BOTS } from './data/bots';
import { AVATARS, AvatarItem } from './data/avatars';
import { getLocalizedAvatar, getLocalizedBot } from './data/translations';
import { useI18n } from './contexts/I18nContext';
import { LanguageGeoModal } from './components/LanguageGeoModal';
import { calculateThreeTorneiras, PASSE_DO_REI_MONTHLY_KZ } from './data/currency';
import { sounds } from './audio/soundEffects';
import { GameHeader } from './components/GameHeader';
import { GameCanvas } from './components/GameCanvas';
import { BettingPanel } from './components/BettingPanel';
import { RulesModal } from './components/RulesModal';
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
import {
  DAILY_MISSIONS,
  DailyMissionsState,
  createFreshDailyMissionsState,
  getLocalDateKey,
  getMissionProgress,
  loadDailyMissionsState,
  saveDailyMissionsState,
} from './data/missions';
import { saveRaceRecord, getDeviceId } from './utils/offlineSync';
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
  const { lang, t } = useI18n();

  // 4. Modo Demo (Treino) vs Modo Real (KZ)
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') !== 'real';
    }
    return true;
  });

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

  // 6. Estado da Corrida e Aposta
  const [betAmount, setBetAmount] = useState<number>(500); // 500 KZ por partida padrão
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

  useEffect(() => {
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
          betAmount: isNaN(betParam) ? 500 : betParam,
          fillWithBots: params.get('bots') !== 'false',
          isDemo: params.get('mode') !== 'real',
          isPrivate: accessMode === 'invite-only',
          accessMode,
        };
      }
    }
    return {
      code: 'HAMILTON-REI',
      title: 'Arena Privada do Hamilton (Oficial)',
      hostName: 'Hamilton O Zero',
      maxPlayers: 5,
      minPlayers: 2,
      betAmount: 500,
      fillWithBots: true,
      isDemo: true,
      isPrivate: true,
      accessMode: 'invite-only',
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
  const [needsInviteOnboarding, setNeedsInviteOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const hasRoom = Boolean(params.get('room') || params.get('sala'));
    if (!hasRoom) return false;
    const forceOnboard = params.get('new') === '1' || params.get('onboard') === '1';
    const profileReady = localStorage.getItem('rei_zero_profile_ready') === 'true';
    return forceOnboard || !profileReady;
  });
  const removedLocalIdsRef = useRef<Set<string>>(new Set());
  const startedFromRoomRef = useRef<boolean>(false);
  const viaInviteRef = useRef<boolean>(
    typeof window !== 'undefined' &&
      Boolean(
        new URLSearchParams(window.location.search).get('room') ||
          new URLSearchParams(window.location.search).get('sala')
      )
  );

  const handleChangePlayerName = (newName: string) => {
    const clean = newName.trim() || 'REI ZERO';
    setPlayerName(clean);
    localStorage.setItem('rei_zero_player_name', clean);
    localStorage.setItem('rei_zero_profile_ready', 'true');
    setCompetitors((prev) =>
      prev.map((c) => (c.isPlayer ? { ...c, name: `${clean} ${t.youTag}` } : c))
    );
  };

  // Auto-abrir Lobby da Arena apenas quando o jogador convidado já escolheu seu avatar e nome
  useEffect(() => {
    if (typeof window !== 'undefined' && !needsInviteOnboarding) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') || params.get('sala')) {
        const timer = setTimeout(() => {
          setLobbyOpen(true);
        }, 1400);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [needsInviteOnboarding]);

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
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (status === 'running' && soundEnabled) {
      sounds.playRaceBgm();
    } else {
      sounds.stopRaceBgm();
    }
  }, [status, soundEnabled]);

  // Garante faixas exclusivas: jogador sempre na faixa central (2) e rivais em [1, 3, 0, 4]
  const assignDistinctLanes = useCallback((list: Competitor[], resetProgress = false): Competitor[] => {
    let rivalIdx = 0;
    return list.map((c) => {
      const lane: Lane = c.isPlayer
        ? 2
        : (RIVAL_LANE_SLOTS[rivalIdx++ % RIVAL_LANE_SLOTS.length] as Lane);
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

  // Reset de competidores alinhados rigorosamente da mesma linha em faixas distintas (Jogador no centro)
  const resetCompetitors = () => {
    setCompetitors((prev) => assignDistinctLanes(prev, true));
  };

  // Gestão segura dos timers de contagem regressiva
  const countdownTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearCountdownTimers = useCallback(() => {
    countdownTimersRef.current.forEach((id) => clearTimeout(id));
    countdownTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearCountdownTimers();
  }, [clearCountdownTimers]);

  // Retorno limpo ao lobby ou sala após o fim da corrida (permite ajustar aposta ou iniciar nova corrida sem colar)
  const handleReturnToLobby = useCallback(() => {
    clearCountdownTimers();
    setShowPodium(false);
    setCountdownValue(null);
    statusRef.current = 'idle';
    setStatus('idle');
    setElapsedSeconds(0);
    setCoinsCollected(0);
    resetCompetitors();
    setRoundNonce((n) => n + 1);

    if (startedFromRoomRef.current) {
      setLobbyOpen(true);
    } else if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        const betEl = document.getElementById('betting-panel-section');
        if (betEl) {
          betEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, [clearCountdownTimers]);

  // Início da corrida de 40 segundos (idêntico entre partida normal e partida de sala)
  const handleStartRound = (fromRoom = false) => {
    const effectiveBet = fromRoom ? roomConfig.betAmount : betAmount;
    if (balance < effectiveBet || status === 'running' || status === 'starting') return;

    if (fromRoom && betAmount !== roomConfig.betAmount) {
      setBetAmount(roomConfig.betAmount);
    }

    startedFromRoomRef.current = fromRoom;
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
    resetCompetitors();
    setRoundNonce((n) => n + 1);
    setLobbyOpen(false);
    setShowPodium(false);
    setStatus('starting');
    setLastPayout(null);
    setCountdownValue(3);
    sounds.playCountdownTick();

    // Leva a tela diretamente para a pista (topo do ecrã) após clicar e após o painel recolher
    const alignTrackToTop = (behavior: ScrollBehavior, onlyIfOffscreen = false) => {
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
    };

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => alignTrackToTop('smooth'));
      countdownTimersRef.current.push(
        setTimeout(() => alignTrackToTop('auto'), 420)
      );
    }

    countdownTimersRef.current.push(
      setTimeout(() => {
        setCountdownValue(2);
        sounds.playCountdownTick();
      }, 650)
    );

    countdownTimersRef.current.push(
      setTimeout(() => {
        setCountdownValue(1);
        sounds.playCountdownTick();
      }, 1300)
    );

    countdownTimersRef.current.push(
      setTimeout(() => {
        setCountdownValue(0);
        sounds.playCountdownGo();
      }, 1950)
    );

    countdownTimersRef.current.push(
      setTimeout(() => {
        setCountdownValue(null);
        alignTrackToTop('auto', true);
        setStatus('running');
      }, 2450)
    );
  };

  // Fim da corrida após os 40 segundos exatos
  const handleRaceFinish = useCallback(
    (finalCompetitors: Competitor[], performance?: RacePerformanceMetrics) => {
      sounds.stopRaceBgm();
      statusRef.current = 'completed';
      setStatus('completed');
      setCompetitors(finalCompetitors);
      setLastPerformance(performance ?? null);

      const torneiras = calculateThreeTorneiras(betAmount, finalCompetitors.length);

      // Ordena por maior distância percorrida até a meta
      const sorted = [...finalCompetitors].sort((a, b) => b.progressDistance - a.progressDistance);
      const rank = sorted.findIndex((c) => c.isPlayer) + 1;
      setUserRank(rank);

      let payout = 0;
      if (rank === 1) payout = torneiras.firstPrizeKz;
      else if (rank === 2) payout = torneiras.secondPrizeKz;

      setLastPayout(payout);
      if (payout > 0) {
        setBalance((prev) => prev + payout);
      }

      // Atualiza o contador de vitórias consecutivas no Top 3 (Hot Streak)
      if (rank <= 3) {
        setTop3Streak((prev) => {
          const newStreak = prev + 1;
          localStorage.setItem('rei_zero_top3_streak', newStreak.toString());
          return newStreak;
        });
      } else {
        setTop3Streak(0);
        localStorage.setItem('rei_zero_top3_streak', '0');
      }

      setShowPodium(true);

      const entry: RoundHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        betAmount,
        timeSeconds: TOTAL_GAME_TIME_SECONDS,
        won: payout > 0,
        payout,
        playerRank: rank,
        totalPlayers: finalCompetitors.length,
        currency: 'KZ',
      };
      setHistory((prev) => {
        const updated = [entry, ...prev.slice(0, 19)];
        localStorage.setItem('rei_zero_history', JSON.stringify(updated));
        return updated;
      });

      // Salva a corrida no histórico persistente do telemóvel e fila de sincronização com o servidor
      saveRaceRecord({
        roomCode: roomConfig.code,
        roomTitle: roomConfig.title,
        betAmount,
        playerRank: rank,
        distanceMeters: Math.floor(finalCompetitors.find((c) => c.isPlayer)?.progressDistance || 0),
        coinsCollected,
        prizeKz: payout,
        streak: rank <= 3 ? top3Streak + 1 : 0,
      });

      // Atualiza progresso das Missões Diárias (corridas, pódios e vitórias)
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
    [betAmount, setBalance, roomConfig.code, roomConfig.title, coinsCollected, top3Streak]
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
    const normalizedConfig: RoomConfig = {
      ...newConfig,
      maxPlayers: cap,
      accessMode,
      isPrivate: accessMode === 'invite-only',
    };
    removedLocalIdsRef.current.clear();
    viaInviteRef.current = true;
    setRoomNotice(null);
    setConfirmDeleteMain(false);
    setRoomConfig(normalizedConfig);
    setBetAmount(normalizedConfig.betAmount);
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
      url.searchParams.set('access', accessMode);
      window.history.replaceState({}, '', url.toString());
    }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const myAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...normalizedConfig,
          player: {
            id: getDeviceId(),
            name: playerName,
            avatar: myAvatar.avatar,
            avatarId: myAvatar.id,
            color: myAvatar.color,
          },
        }),
      })
        .then((r) => r.ok && setServerRoomConnected(true))
        .catch(() => setServerRoomConnected(false));
    }
  };

  const handleUpdateMaxPlayers = (newMax: 2 | 3 | 4 | 5) => {
    const cap = clampRoomMax(newMax, 5);
    setRoomConfig((prev) => ({ ...prev, maxPlayers: cap }));
    setCompetitors((prev) => fitCompetitorsToCapacity(prev, cap, roomConfig.fillWithBots));
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('max', String(cap));
      window.history.replaceState({}, '', url.toString());
    }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomConfig.code,
          maxPlayers: cap,
        }),
      }).catch(() => {});
    }
  };

  const handleToggleAccessMode = (explicitMode?: RoomAccessMode) => {
    const current: RoomAccessMode = roomConfig.accessMode || 'invite-only';
    const nextMode: RoomAccessMode = explicitMode ?? (current === 'random' ? 'invite-only' : 'random');
    setRoomConfig((prev) => ({
      ...prev,
      accessMode: nextMode,
      isPrivate: nextMode === 'invite-only',
    }));
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('access', nextMode);
      window.history.replaceState({}, '', url.toString());
    }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const myAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomConfig.code,
          title: roomConfig.title,
          hostName: roomConfig.hostName,
          maxPlayers: roomConfig.maxPlayers,
          betAmount: roomConfig.betAmount,
          fillWithBots: roomConfig.fillWithBots,
          isDemo,
          accessMode: nextMode,
          player: {
            id: getDeviceId(),
            name: playerName,
            avatar: myAvatar.avatar,
            avatarId: myAvatar.id,
            color: myAvatar.color,
          },
        }),
      }).catch(() => {});
    }
  };

  const handleDeleteRoom = async () => {
    const codeToDelete = roomConfig.code;
    setConfirmDeleteMain(false);
    startedFromRoomRef.current = false;
    viaInviteRef.current = false;
    removedLocalIdsRef.current.clear();
    setServerRoomConnected(false);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await fetch(`/api/rooms/${encodeURIComponent(codeToDelete)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: getDeviceId() }),
      }).catch(() => {});
    }

    const freshCode = `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;
    setRoomConfig({
      code: freshCode,
      title: `Arena de ${playerName}`,
      hostName: playerName,
      maxPlayers: 5,
      minPlayers: 2,
      betAmount: 500,
      fillWithBots: true,
      isDemo,
      isPrivate: true,
      accessMode: 'invite-only',
    });
    setBetAmount(500);
    setCompetitors((prev) => {
      const playerOnly = prev.filter((c) => c.isPlayer);
      return fitCompetitorsToCapacity(playerOnly.length > 0 ? playerOnly : prev, 5, true);
    });

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      ['room', 'sala', 'host', 'title', 'max', 'bet', 'access', 'new', 'onboard'].forEach((k) =>
        url.searchParams.delete(k)
      );
      window.history.replaceState({}, '', url.toString());
    }

    setRoomNotice(t.app.roomDeletedNotice);
    setTimeout(() => setRoomNotice(null), 4500);
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
  }) => {
    const cleanCode = payload.code.trim().toUpperCase();
    const cap = clampRoomMax(payload.maxPlayers ?? roomConfig.maxPlayers, 5);
    const accessMode: RoomAccessMode = payload.accessMode || roomConfig.accessMode || 'invite-only';
    viaInviteRef.current = payload.viaInvite ?? true;
    removedLocalIdsRef.current.clear();
    setRoomNotice(null);
    const updatedConfig: RoomConfig = {
      code: cleanCode,
      title: payload.title || `Arena ${cleanCode}`,
      hostName: payload.hostName || roomConfig.hostName,
      maxPlayers: cap,
      minPlayers: 2,
      betAmount: payload.betAmount || betAmount,
      fillWithBots: roomConfig.fillWithBots,
      isDemo: payload.isDemo ?? isDemo,
      isPrivate: accessMode === 'invite-only',
      accessMode,
    };
    setRoomConfig(updatedConfig);
    setBetAmount(updatedConfig.betAmount);
    setCompetitors((prev) => fitCompetitorsToCapacity(prev, cap, updatedConfig.fillWithBots));
    if (typeof payload.isDemo === 'boolean') {
      setIsDemo(payload.isDemo);
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleanCode);
      if (payload.hostName) url.searchParams.set('host', payload.hostName);
      if (payload.title) url.searchParams.set('title', payload.title);
      url.searchParams.set('max', String(cap));
      url.searchParams.set('bet', updatedConfig.betAmount.toString());
      url.searchParams.set('access', accessMode);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleFindRandomRoom = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setRoomNotice(t.lobby.noRandomRoomNotice);
      return;
    }
    try {
      const resp = await fetch(`/api/rooms/open/random?playerId=${encodeURIComponent(getDeviceId())}`);
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
          viaInvite: true,
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
              }
            : c
        )
      );

      viaInviteRef.current = true;
      setNeedsInviteOnboarding(false);
      setLobbyOpen(true);
    },
    [isDemo, lang, roomConfig.betAmount, t.youTag]
  );

  // Sincronização em tempo real com a sala no servidor quando o jogador está online
  useEffect(() => {
    if (needsInviteOnboarding) return;
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      setServerRoomConnected(false);
      return;
    }

    const myId = getDeviceId();
    const myAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];
    let cancelled = false;

    const syncRoom = async () => {
      if (cancelled || statusRef.current !== 'idle') return;
      try {
        const resp = await fetch(`/api/rooms/${encodeURIComponent(roomConfig.code)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: roomConfig.title,
            hostName: roomConfig.hostName,
            maxPlayers: roomConfig.maxPlayers,
            betAmount: roomConfig.betAmount,
            fillWithBots: roomConfig.fillWithBots,
            isDemo,
            accessMode: roomConfig.accessMode || 'invite-only',
            viaInvite: viaInviteRef.current,
            player: {
              id: myId,
              name: playerName,
              avatar: myAvatar.avatar,
              avatarId: myAvatar.id,
              color: myAvatar.color,
            },
          }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          kicked?: boolean;
          roomFull?: boolean;
          inviteOnly?: boolean;
          room?: {
            title: string;
            hostName: string;
            maxPlayers?: number;
            betAmount: number;
            accessMode?: RoomAccessMode;
            participants: Array<{
              id: string;
              name: string;
              avatar: string;
              avatarId: string;
              color: string;
              isHost: boolean;
            }>;
          };
        };

        if (cancelled) return;

        if (resp.status === 403 && data.kicked) {
          setServerRoomConnected(false);
          setRoomNotice(t.lobby.kickedNotice);
          const freshCode = `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;
          setRoomConfig((prev) => ({ ...prev, code: freshCode }));
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('room', freshCode);
            window.history.replaceState({}, '', url.toString());
          }
          return;
        }

        if (resp.status === 403 && data.inviteOnly) {
          setServerRoomConnected(false);
          setRoomNotice(t.lobby.inviteOnlyNotice);
          return;
        }

        if (resp.status === 409 && data.roomFull) {
          setRoomNotice(t.lobby.roomFullNotice);
          return;
        }

        if (!resp.ok || !data.ok || !data.room) return;

        if (cancelled || statusRef.current !== 'idle') return;

        setServerRoomConnected(true);
        const serverMax = clampRoomMax(data.room.maxPlayers, roomConfig.maxPlayers);
        const serverAccess = data.room.accessMode;
        if (serverMax !== roomConfig.maxPlayers || (serverAccess && serverAccess !== roomConfig.accessMode)) {
          setRoomConfig((prev) => ({
            ...prev,
            maxPlayers: serverMax,
            accessMode: serverAccess || prev.accessMode,
            isPrivate: (serverAccess || prev.accessMode) === 'invite-only',
          }));
        }

        const remoteOthers = data.room.participants.filter(
          (p) => p.id !== myId && !removedLocalIdsRef.current.has(p.id)
        );
        if (statusRef.current === 'idle') {
          setCompetitors((prev) => {
            const playerEntry = prev.find((c) => c.isPlayer) || prev[0];
            const localSimFriends = prev.filter(
              (c) => !c.isPlayer && !c.isBot && c.id.startsWith('friend-')
            );
            const existingBots = prev.filter((c) => c.isBot);
            const humanCompetitors: Competitor[] = remoteOthers.map((p, idx) => {
              const rivalLane = RIVAL_LANE_SLOTS[idx % RIVAL_LANE_SLOTS.length] as Lane;
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
                stumbling: false,
                finished: false,
              };
            });

            const combined: Competitor[] = [];
            if (playerEntry) {
              combined.push({
                ...playerEntry,
                lane: 2 as Lane,
                targetLane: 2 as Lane,
                laneX: LANE_CENTERS[2],
              });
            }
            for (const remoteFriend of humanCompetitors) {
              if (combined.length >= serverMax) break;
              combined.push(remoteFriend);
            }
            for (const simFriend of localSimFriends) {
              if (combined.length >= serverMax) break;
              combined.push(simFriend);
            }
            if (roomConfig.fillWithBots) {
              for (const bot of existingBots) {
                if (combined.length >= serverMax) break;
                if (!combined.some((c) => c.id === bot.id)) {
                  combined.push(bot);
                }
              }
            }
            return assignDistinctLanes(combined.slice(0, serverMax));
          });
        }
      } catch {
        if (!cancelled) setServerRoomConnected(false);
      }
    };

    if (status === 'idle') {
      syncRoom();
    }
    const interval = lobbyOpen && status === 'idle' ? setInterval(syncRoom, 2500) : null;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [
    needsInviteOnboarding,
    roomConfig.code,
    roomConfig.title,
    roomConfig.hostName,
    roomConfig.maxPlayers,
    roomConfig.betAmount,
    roomConfig.fillWithBots,
    roomConfig.accessMode,
    isDemo,
    playerName,
    selectedAvatarId,
    lobbyOpen,
    status,
    assignDistinctLanes,
    t.lobby.kickedNotice,
    t.lobby.roomFullNotice,
    t.lobby.inviteOnlyNotice,
  ]);

  const handleRemoveCompetitor = (id: string) => {
    const target = competitors.find((c) => c.id === id);
    if (!target || target.isPlayer) return;

    removedLocalIdsRef.current.add(id);
    setCompetitors((prev) => prev.filter((c) => c.id !== id));

    if (!target.isBot && !id.startsWith('friend-') && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch(`/api/rooms/${encodeURIComponent(roomConfig.code)}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: getDeviceId(),
          targetId: id,
        }),
      }).catch(() => {});
    }
  };

  const handleToggleFillBots = () => {
    setRoomConfig((prev) => ({ ...prev, fillWithBots: !prev.fillWithBots }));
  };

  const handleRegenerateRoomCode = () => {
    const newCode = `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;
    setRoomConfig((prev) => {
      const updated = { ...prev, code: newCode };
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('room', newCode);
        window.history.replaceState({}, '', url.toString());
      }
      return updated;
    });
  };

  // Seleção e Compra de Avatares
  const handleSelectAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    const item = getLocalizedAvatar(avatarId, lang);
    setCompetitors((prev) =>
      prev.map((c) =>
        c.isPlayer
          ? {
              ...c,
              avatar: item.avatar,
              avatarId: item.id,
              color: item.color,
              name: `${playerName && playerName !== 'REI ZERO' ? playerName : item.name} ${t.youTag}`,
            }
          : c
      )
    );
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
  const torneirasPool = calculateThreeTorneiras(betAmount, competitors.length);

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
        onResetBalance={() => setDemoBalance((prev) => prev + 50_000)}
        isDemo={isDemo}
        onToggleDemo={() => setIsDemo((prev) => !prev)}
        onOpenLobby={() => setLobbyOpen(true)}
        onOpenRanking={() => setRankingOpen(true)}
        onOpenShop={() => setShopOpen(true)}
        onOpenAdmin={() => setIsAdminRoute(true)}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((prev) => (prev === '2d' ? '3d' : '2d'))}
        timeMode={timeMode}
        onToggleTimeMode={() => setTimeMode((prev) => (prev === 'day' ? 'night' : 'day'))}
      />

      {/* 2. Área Central de Corrida */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Pista de 5 Faixas (Modo 2D ou 3D Three.js) */}
        <section
          id="race-track-section"
          className="w-full lg:w-[520px] shrink-0 flex flex-col items-center scroll-mt-4 gap-2"
        >
          {/* Barra Permanente de Controlo da Sala (Aleatórios vs Convidados + Eliminar Sala) */}
          <div className="w-full game-panel rounded-2xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl game-subplate flex items-center justify-center shrink-0">
                <span className="text-base">🏟️</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-mono font-bold text-zinc-400">
                    {t.app.roomBarTitle}
                  </span>
                  <span className="text-[11px] font-mono font-black text-amber-300 truncate max-w-[110px]">
                    {roomConfig.code}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    ({competitors.length}/{roomConfig.maxPlayers})
                  </span>
                </div>
                <span className="text-[9px] font-mono text-zinc-500 block leading-tight">
                  {(roomConfig.accessMode || 'invite-only') === 'random'
                    ? t.app.accessRandomBadge
                    : t.app.accessInviteBadge}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={status === 'running' || status === 'starting'}
                onClick={() => handleToggleAccessMode()}
                className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-black flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 ${
                  (roomConfig.accessMode || 'invite-only') === 'random'
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/60 text-emerald-300'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-300'
                }`}
              >
                {(roomConfig.accessMode || 'invite-only') === 'random' ? (
                  <Shuffle size={12} />
                ) : (
                  <Lock size={12} />
                )}
                <span>
                  {(roomConfig.accessMode || 'invite-only') === 'random'
                    ? t.app.accessRandomBtn
                    : t.app.accessInviteBtn}
                </span>
              </button>

              <button
                type="button"
                disabled={status === 'running' || status === 'starting'}
                onClick={() => setLobbyOpen(true)}
                className="px-2.5 py-1.5 rounded-xl game-btn-secondary text-zinc-200 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Users size={12} className="text-amber-400" />
                <span>{t.app.openLobbyBtn}</span>
              </button>

              {confirmDeleteMain ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDeleteRoom}
                    className="px-2 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-black cursor-pointer"
                  >
                    {t.app.deleteRoomConfirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteMain(false)}
                    className="px-2 py-1.5 rounded-xl game-btn-secondary text-zinc-300 text-[10px] font-mono font-bold cursor-pointer"
                  >
                    {t.app.deleteRoomCancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={status === 'running' || status === 'starting'}
                  onClick={() => setConfirmDeleteMain(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  <span>{t.app.deleteRoomBtn}</span>
                </button>
              )}
            </div>
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
            onRankUpdate={(rank) => setUserRank(rank)}
            onRestart={handleReturnToLobby}
            roundNonce={roundNonce}
            pause3d={showPodium || lobbyOpen}
            isDemo={isDemo}
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
            onBetChange={(amt) => setBetAmount(amt)}
            onStartRound={() => handleStartRound(false)}
            lastPayoutKz={lastPayout}
            lastRank={userRank}
            isDemo={isDemo}
            playerAvatar={currentAvatar}
            competitors={competitors}
            maxPlayers={roomConfig.maxPlayers}
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
              onDeleteRoom={handleDeleteRoom}
              onFindRandomRoom={handleFindRandomRoom}
              roomNotice={roomNotice}
              playerName={playerName}
              onChangePlayerName={handleChangePlayerName}
              serverConnected={serverRoomConnected}
              isDemo={isDemo}
              onCloseLobby={() => setLobbyOpen(false)}
              streak={top3Streak}
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
              threeTorneiras={torneirasPool}
              streak={top3Streak}
              performance={lastPerformance}
              returnTarget={startedFromRoomRef.current ? 'room' : 'lobby'}
              onPlayAgain={() => handleStartRound(startedFromRoomRef.current)}
              onBackToLobby={handleReturnToLobby}
              isDemo={isDemo}
              canPlayAgain={balance >= betAmount}
            />
          </PodiumErrorBoundary>
        )}
      </AnimatePresence>

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

      {/* 3.1 Modal de Verificação Provably Fair iGaming */}
      <ProvablyFairModal
        isOpen={isProvablyFairOpen}
        onClose={() => setIsProvablyFairOpen(false)}
      />

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
                <div className="w-24 h-24 rounded-full bg-gradient-to-b from-amber-400/25 to-amber-600/10 border-2 border-amber-400/60 flex items-center justify-center shadow-[0_0_32px_rgba(245,158,11,0.45)]">
                  <span className="text-6xl filter drop-shadow-[0_0_18px_rgba(245,158,11,0.9)]">
                    👑
                  </span>
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

              <div className="flex items-center justify-between w-full text-[10px] font-mono text-zinc-400 mb-6">
                <span>{t.loading.statsLine}</span>
                <span className="text-amber-400 font-bold">{t.loading.skill100}</span>
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
