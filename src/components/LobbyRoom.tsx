import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Check,
  Copy,
  Users,
  PlusCircle,
  MessageCircle,
  Globe,
  Smartphone,
  QrCode,
  Download,
  X,
  Camera,
  LogIn,
  UserMinus,
  Trash2,
  Shuffle,
  Lock,
  Mic,
  MicOff,
  Volume2,
  Send,
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Competitor, RoomAccessMode, RoomChatMessage, RoomConfig, ServerRaceStatus } from '../types/game';
import {
  MIN_BET_KZ,
  MAX_BET_KZ,
  clampBetKz,
  calculateThreeTorneiras,
  convertCurrencyToKz,
  convertKzToCurrency,
  getCrossBorderStakeParity,
  getQuickBetChipsKz,
} from '../data/currency';
import { useI18n } from '../contexts/I18nContext';
import { useVoiceChat } from '../contexts/VoiceChatContext';
import { VoiceChatPanel } from './VoiceChatPanel';
import { AvatarDoll } from './AvatarDoll';
import { getMultiplayerStrings } from '../utils/multiplayerStrings';

interface JoinRoomPayload {
  code: string;
  title?: string;
  hostName?: string;
  maxPlayers?: number;
  betAmount?: number;
  fillWithBots?: boolean;
  isDemo?: boolean;
  accessMode?: RoomAccessMode;
  viaInvite?: boolean;
}

interface LobbyRoomProps {
  roomConfig: RoomConfig;
  competitors: Competitor[];
  onStartRace: () => void;
  onToggleFillBots: () => void;
  onAddFriendSimulation: () => void;
  onRemoveCompetitor: (id: string) => void;
  onRegenerateRoomCode: () => void;
  onCreateRoom?: (newConfig: RoomConfig) => void;
  onJoinRoom?: (payload: JoinRoomPayload) => void;
  onUpdateMaxPlayers?: (maxPlayers: 2 | 3 | 4 | 5) => void;
  onToggleAccessMode?: (mode?: RoomAccessMode) => void;
  onUpdateBet?: (amount: number) => void;
  onDeleteRoom?: () => void;
  onLeaveRoom?: () => void;
  onFindRandomRoom?: () => Promise<void> | void;
  onEnsureShareableRoom?: () => string;
  onEditingStateChange?: (isEditing: boolean) => void;
  roomNotice?: string | null;
  playerName?: string;
  onChangePlayerName?: (name: string) => void;
  serverConnected?: boolean;
  isDemo: boolean;
  onCloseLobby: () => void;
  streak?: number;
  isRoomHost?: boolean;
  waitingForOpponent?: boolean;
  waitingOpponentNames?: string[];
  connectedHumansCount?: number;
  serverRaceStatus?: ServerRaceStatus;
  canSpectate?: boolean;
  onEnterSpectatorMode?: () => void;
  onOpenSpectatorOverview?: () => void;
  chatMessages?: RoomChatMessage[];
  onSendChatMessage?: (text: string) => void;
  localPlayerId?: string;
}

function formatEditableRoomBet(kz: number, decimals: number, rate: number): string {
  const localVal = kz / (rate || 1);
  if (decimals === 0) {
    return String(Math.round(localVal));
  }
  return Number(localVal.toFixed(decimals)).toString();
}

export const LobbyRoom: React.FC<LobbyRoomProps> = ({
  roomConfig,
  competitors,
  onStartRace,
  onToggleFillBots: _onToggleFillBots,
  onAddFriendSimulation,
  onRemoveCompetitor,
  onRegenerateRoomCode,
  onCreateRoom,
  onJoinRoom,
  onUpdateMaxPlayers,
  onToggleAccessMode,
  onUpdateBet,
  onDeleteRoom,
  onLeaveRoom,
  onFindRandomRoom,
  onEnsureShareableRoom,
  onEditingStateChange,
  roomNotice = null,
  playerName = 'REI ZERO',
  onChangePlayerName,
  serverConnected = false,
  isDemo,
  onCloseLobby,
  streak = 0,
  isRoomHost = true,
  waitingForOpponent = false,
  waitingOpponentNames = [],
  connectedHumansCount: _connectedHumansCount = 1,
  serverRaceStatus = 'idle',
  canSpectate = false,
  onEnterSpectatorMode,
  onOpenSpectatorOverview,
  chatMessages = [],
  onSendChatMessage,
  localPlayerId = '',
}) => {
  const { lang, currency, currencyMeta, t, rates, formatMoney } = useI18n();
  const mpStrings = useMemo(() => getMultiplayerStrings(lang), [lang]);
  const {
    isJoined: isVoiceActive,
    peers: voicePeers,
    isMicMuted,
    isLocalSpeaking,
    mutedPeerIds,
  } = useVoiceChat();

  const canControlRoom = isRoomHost;
  const maxPlayers = Math.max(2, Math.min(5, roomConfig.maxPlayers || 5)) as 2 | 3 | 4 | 5;
  const currentAccessMode: RoomAccessMode = roomConfig.accessMode || 'invite-only';
  const [activeTab, setActiveTab] = useState<'arena' | 'create' | 'scan'>('arena');
  const [copied, setCopied] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<boolean>(false);
  const [findingRandom, setFindingRandom] = useState<boolean>(false);
  const [isEditingField, setIsEditingField] = useState<boolean>(false);

  const [manualJoinInput, setManualJoinInput] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [localNameInput, setLocalNameInput] = useState<string>(playerName);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const rateForCurrency = rates[currency] || currencyMeta.defaultKzPerUnit || 1;
  const [arenaBetInput, setArenaBetInput] = useState<string>('');
  const [arenaBetError, setArenaBetError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const [newTitle, setNewTitle] = useState<string>(roomConfig.title || 'Arena do Hamilton');
  const [newHost, setNewHost] = useState<string>(roomConfig.hostName || 'Hamilton O Zero');
  const [newBet, setNewBet] = useState<number | null>(null);
  const [newBetInput, setNewBetInput] = useState<string>('');
  const [isEditingNewBet, setIsEditingNewBet] = useState<boolean>(false);
  const [newBetError, setNewBetError] = useState<string | null>(null);
  const [newMaxPlayers, setNewMaxPlayers] = useState<2 | 3 | 4 | 5>(maxPlayers);
  const [newAccessMode, setNewAccessMode] = useState<RoomAccessMode>(currentAccessMode);
  const [fillBotsOption, setFillBotsOption] = useState<boolean>(false);

  useEffect(() => {
    setNewMaxPlayers(maxPlayers);
  }, [maxPlayers]);

  useEffect(() => {
    onEditingStateChange?.(isEditingField || activeTab === 'create' || activeTab === 'scan');
  }, [isEditingField, activeTab, onEditingStateChange]);

  useEffect(() => {
    return () => {
      onEditingStateChange?.(false);
    };
  }, [onEditingStateChange]);

  useEffect(() => {
    if (newBet !== null && !isEditingNewBet && newBetInput !== '') {
      setNewBetInput(formatEditableRoomBet(newBet, currencyMeta.decimals, rateForCurrency));
    }
  }, [newBet, currency, currencyMeta.decimals, rateForCurrency, isEditingNewBet, newBetInput]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, activeTab]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverConnected || !onSendChatMessage) return;
    const cleaned = chatInput.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 240);
    if (!cleaned) return;
    onSendChatMessage(cleaned);
    setChatInput('');
  };

  const formatChatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const minLocalBet = useMemo(
    () => convertKzToCurrency(MIN_BET_KZ, currency, rates),
    [currency, rates]
  );
  const maxLocalBet = useMemo(
    () => convertKzToCurrency(MAX_BET_KZ, currency, rates),
    [currency, rates]
  );

  const presetChips = useMemo(
    () => getQuickBetChipsKz(currency, rates),
    [currency, rates]
  );

  const parityPreview = useMemo(
    () => getCrossBorderStakeParity(roomConfig.betAmount, rates, ['AOA', 'USD', 'EUR', 'BRL', 'COP', 'MXN', 'CNY', 'EGP']),
    [roomConfig.betAmount, rates]
  );

  const activeSpeakerNames = useMemo(() => {
    if (!isVoiceActive) return [];
    const names: string[] = [];
    if (isLocalSpeaking && !isMicMuted) {
      const localPlayer = competitors.find((c) => c.isPlayer);
      names.push(localPlayer?.name || playerName || t.lobby.youBadge);
    }
    for (const peer of voicePeers) {
      if (peer.speaking && !peer.muted && !mutedPeerIds.includes(peer.peerId)) {
        names.push(peer.name);
      }
    }
    return names;
  }, [
    isVoiceActive,
    isLocalSpeaking,
    isMicMuted,
    competitors,
    playerName,
    t.lobby.youBadge,
    voicePeers,
    mutedPeerIds,
  ]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (activeTab !== 'scan') {
      stopCamera();
    }
  }, [activeTab, stopCamera]);

  const parseAndJoinInput = useCallback(
    (rawValue: string) => {
      const cleaned = rawValue.trim();
      if (!cleaned) return;

      let parsedPayload: JoinRoomPayload | null = null;
      try {
        if (cleaned.includes('http') || cleaned.includes('?')) {
          const url = new URL(cleaned.startsWith('http') ? cleaned : `https://rei-run.app/${cleaned}`);
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
              fillWithBots: url.searchParams.has('bots') ? url.searchParams.get('bots') === 'true' : undefined,
              isDemo: url.searchParams.get('mode') ? url.searchParams.get('mode') !== 'real' : undefined,
              accessMode: accessParam === 'random' ? 'random' : 'invite-only',
              viaInvite: true,
            };
          }
        }
      } catch {
        // Fallback to direct room code
      }

      if (!parsedPayload) {
        parsedPayload = {
          code: cleaned.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
          viaInvite: true,
        };
      }

      if (parsedPayload.code && onJoinRoom) {
        stopCamera();
        onJoinRoom(parsedPayload);
        setActiveTab('arena');
        setManualJoinInput('');
        setFeedbackMsg(`${parsedPayload.code} ✓`);
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    },
    [onJoinRoom, stopCamera]
  );

  const startCameraScanner = async () => {
    setCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(t.lobby.cameraHint);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError(t.lobby.manualCodeLabel);
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (!cameraActive) return;
    let rafId = 0;
    let active = true;

    const scanFrame = () => {
      if (!active) return;
      const video = videoRef.current;
      const canvas = scanCanvasRef.current;
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
          if (decoded && decoded.data) {
            parseAndJoinInput(decoded.data);
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
  }, [cameraActive, parseAndJoinInput]);

  const torneiras = calculateThreeTorneiras(roomConfig.betAmount, Math.max(2, competitors.length));

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
          roomConfig.code
        )}&host=${encodeURIComponent(roomConfig.hostName)}&title=${encodeURIComponent(
          roomConfig.title
        )}&bet=${roomConfig.betAmount}&max=${maxPlayers}&bots=${
          roomConfig.fillWithBots ? 'true' : 'false'
        }&mode=${isDemo ? 'demo' : 'real'}&access=${currentAccessMode}`
      : `https://rei-run.app/?room=${roomConfig.code}&max=${maxPlayers}&bots=${
          roomConfig.fillWithBots ? 'true' : 'false'
        }&access=${currentAccessMode}`;

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 380,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Erro gerando QR Code:', err));
  }, [shareUrl]);

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `REI-RUN-${roomConfig.code}-QR.png`;
    a.click();
    setFeedbackMsg(`${t.lobby.downloadQr} ✓`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleCopyLink = async () => {
    const targetUrl = onEnsureShareableRoom ? onEnsureShareableRoom() : shareUrl;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(targetUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = targetUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setFeedbackMsg(`${t.lobby.copiedBtn} 🔗`);
      setTimeout(() => {
        setCopied(false);
        setFeedbackMsg(null);
      }, 3000);
    } catch {
      setCopied(true);
      setFeedbackMsg(`${t.lobby.copiedBtn} 🔗`);
      setTimeout(() => {
        setCopied(false);
        setFeedbackMsg(null);
      }, 3000);
    }
  };

  const openExternalShare = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareWhatsApp = () => {
    const targetUrl = onEnsureShareableRoom ? onEnsureShareableRoom() : shareUrl;
    const text = `👑 REI RUN · ${roomConfig.title} (${roomConfig.code})\n👤 ${t.lobby.hostLabel} ${roomConfig.hostName}\n💰 ${t.lobby.betLabel} ${formatMoney(roomConfig.betAmount)}\n🏁 ${t.lobby.sameMatchNote}\n👉 ${targetUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    openExternalShare(url);
  };

  const handleShareFacebook = () => {
    const targetUrl = onEnsureShareableRoom ? onEnsureShareableRoom() : shareUrl;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`;
    openExternalShare(url);
  };

  const handleShareInstagramOrNative = async () => {
    const targetUrl = onEnsureShareableRoom ? onEnsureShareableRoom() : shareUrl;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `REI RUN — ${roomConfig.title}`,
          text: `👑 ${roomConfig.title} (${roomConfig.code}) · ${formatMoney(roomConfig.betAmount)} · ${t.officialPhrase}`,
          url: targetUrl,
        });
        return;
      } catch {
        // Fallback below
      }
    }
    await handleCopyLink();
  };

  const rangeLabel = `${mpStrings.betRangeHint} ${formatMoney(MIN_BET_KZ)} – ${formatMoney(MAX_BET_KZ)}`;

  const handleArenaBetInputChange = (raw: string) => {
    setArenaBetInput(raw);
    const normalized = raw.replace(',', '.').trim();
    if (!normalized) {
      setArenaBetError(null);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setArenaBetError(rangeLabel);
      return;
    }
    const rawKz = convertCurrencyToKz(parsed, currency, rates);
    if (rawKz < MIN_BET_KZ || rawKz > MAX_BET_KZ) {
      setArenaBetError(rangeLabel);
      return;
    }
    setArenaBetError(null);
    onUpdateBet?.(clampBetKz(rawKz));
  };

  const handleManualRoomBetChange = (raw: string) => {
    setNewBetInput(raw);
    const normalized = raw.replace(',', '.').trim();
    if (!normalized) {
      setNewBet(null);
      setNewBetError(rangeLabel);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setNewBet(null);
      setNewBetError(rangeLabel);
      return;
    }
    const rawKz = convertCurrencyToKz(parsed, currency, rates);
    if (rawKz < MIN_BET_KZ || rawKz > MAX_BET_KZ) {
      setNewBet(null);
      setNewBetError(rangeLabel);
      return;
    }
    setNewBetError(null);
    setNewBet(clampBetKz(rawKz));
  };

  const handleManualRoomBetBlur = () => {
    setIsEditingNewBet(false);
    setIsEditingField(false);
    const normalized = newBetInput.replace(',', '.').trim();
    if (!normalized) return;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      const rawKz = convertCurrencyToKz(parsed, currency, rates);
      if (rawKz < MIN_BET_KZ || rawKz > MAX_BET_KZ) {
        setNewBet(null);
        setNewBetError(rangeLabel);
        return;
      }
      const clampedKz = clampBetKz(rawKz);
      setNewBet(clampedKz);
      setNewBetInput(formatEditableRoomBet(clampedKz, currencyMeta.decimals, rateForCurrency));
      setNewBetError(null);
    }
  };

  const applyQuickRoomBetKz = (targetKz: number) => {
    const clamped = clampBetKz(targetKz);
    setIsEditingNewBet(false);
    setNewBetError(null);
    setNewBet(clamped);
    setNewBetInput(formatEditableRoomBet(clamped, currencyMeta.decimals, rateForCurrency));
  };

  const handleSaveNewRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = newBetInput.replace(',', '.').trim();
    const parsed = Number(normalized);
    const parsedKz =
      normalized && Number.isFinite(parsed) && parsed > 0
        ? convertCurrencyToKz(parsed, currency, rates)
        : newBet ?? NaN;

    if (!Number.isFinite(parsedKz) || parsedKz < MIN_BET_KZ || parsedKz > MAX_BET_KZ) {
      setNewBetError(rangeLabel);
      return;
    }

    const validatedBet = clampBetKz(parsedKz);
    setNewBetError(null);
    setNewBet(validatedBet);

    const cleanTitle = newTitle.trim() || 'Arena do Hamilton';
    const cleanHost = newHost.trim() || playerName || 'Hamilton O Zero';
    const cleanCode = `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;

    const newConfig: RoomConfig = {
      code: cleanCode,
      title: cleanTitle,
      hostName: cleanHost,
      maxPlayers: newMaxPlayers,
      minPlayers: 2,
      betAmount: validatedBet,
      fillWithBots: fillBotsOption,
      isDemo: roomConfig.isDemo,
      isPrivate: newAccessMode === 'invite-only',
      accessMode: newAccessMode,
    };

    if (onCreateRoom) {
      onCreateRoom(newConfig);
    }
    setActiveTab('arena');
    setFeedbackMsg(`${cleanTitle} (${cleanCode}) ✓`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="relative game-panel-gold rounded-3xl p-5 sm:p-6 shadow-[0_0_70px_rgba(245,158,11,0.34)] flex flex-col gap-4 text-zinc-100 max-w-xl w-full mx-auto backdrop-blur-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl game-subplate border border-amber-400/40 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.2)]">
            <span className="text-2xl filter drop-shadow">🏟️</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black uppercase text-amber-400">
                {t.lobby.title}
              </h3>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                {t.lobby.badge}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">{t.lobby.subtitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-1 rounded-xl border font-mono text-[10px] font-bold flex items-center gap-1.5 ${
              serverConnected
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'game-subplate text-zinc-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                serverConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                  : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]'
              }`}
            />
            <span>{serverConnected ? t.lobby.live : t.lobby.local}</span>
          </div>
          <div className="px-3 py-1 rounded-xl game-subplate border border-amber-500/50 font-mono text-xs font-bold text-amber-300">
            {roomConfig.code}
          </div>
          <button
            type="button"
            onClick={onCloseLobby}
            className="w-8 h-8 rounded-xl game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
            title={t.rules.closeBtn}
          >
            ✕
          </button>
        </div>
      </div>

      {onChangePlayerName && (
        <div className="flex items-center gap-2 game-subplate rounded-2xl px-3 py-2">
          <span className="text-[11px] font-mono text-zinc-400 shrink-0">{t.lobby.yourName}</span>
          <input
            type="text"
            value={localNameInput}
            onFocus={() => setIsEditingField(true)}
            onChange={(e) => setLocalNameInput(e.target.value)}
            onBlur={() => {
              setIsEditingField(false);
              const trimmed = localNameInput.trim();
              if (trimmed) onChangePlayerName(trimmed);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const trimmed = localNameInput.trim();
                if (trimmed) onChangePlayerName(trimmed);
              }
            }}
            maxLength={22}
            className="flex-1 bg-transparent text-xs font-bold text-amber-300 focus:outline-none font-mono"
            placeholder={t.lobby.namePlaceholder}
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = localNameInput.trim();
              if (trimmed) {
                onChangePlayerName(trimmed);
                setFeedbackMsg(`${trimmed} ✓`);
                setTimeout(() => setFeedbackMsg(null), 2500);
              }
            }}
            className="px-2.5 py-1 rounded-lg game-btn-secondary text-[10px] font-mono font-bold text-zinc-200 cursor-pointer"
          >
            {t.lobby.saveName}
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1.5 game-subplate p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('arena')}
          className={`py-2 px-2 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'arena'
              ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users size={13} />
          <span>
            {t.lobby.tabArena} ({competitors.length}/{maxPlayers})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`py-2 px-2 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'create'
              ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <PlusCircle size={13} />
          <span>{t.lobby.tabCreate}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scan')}
          className={`py-2 px-2 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'scan'
              ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Camera size={13} />
          <span>{t.lobby.tabScan}</span>
        </button>
      </div>

      {roomNotice && (
        <div className="p-2.5 rounded-xl bg-rose-950/85 border border-rose-500/60 text-rose-200 text-xs font-mono font-bold text-center shadow">
          {roomNotice}
        </div>
      )}

      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg"
          >
            <Check size={15} className="text-emerald-400" />
            <span>{feedbackMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'arena' && (
        <div className="flex flex-col gap-3.5">
          <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 rounded-2xl border border-amber-500/50 flex flex-col gap-2 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">👑</span>
                <div>
                  <span className="text-xs font-black uppercase text-amber-300 block">
                    {roomConfig.title}
                  </span>
                  <span className="text-[11px] text-zinc-300 font-mono">
                    {t.lobby.hostLabel}{' '}
                    <strong className="text-amber-400">{roomConfig.hostName}</strong> ·{' '}
                    {t.lobby.betLabel} <strong>{formatMoney(roomConfig.betAmount)}</strong>
                  </span>
                </div>
              </div>
              {onToggleAccessMode && canControlRoom ? (
                <button
                  type="button"
                  onClick={() => onToggleAccessMode()}
                  className={`text-[10px] font-mono font-black px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                    currentAccessMode === 'random'
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/50'
                  }`}
                  title={
                    currentAccessMode === 'random'
                      ? t.app.accessRandomBadge
                      : t.app.accessInviteBadge
                  }
                >
                  {currentAccessMode === 'random' ? <Shuffle size={12} /> : <Lock size={12} />}
                  <span>
                    {currentAccessMode === 'random'
                      ? t.app.accessRandomBtn
                      : t.app.accessInviteBtn}
                  </span>
                </button>
              ) : (
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-zinc-900/90 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1">
                  {currentAccessMode === 'random' ? <Shuffle size={11} /> : <Lock size={11} />}
                  <span>
                    {currentAccessMode === 'random'
                      ? t.app.accessRandomBtn
                      : t.app.accessInviteBtn}
                  </span>
                </span>
              )}
            </div>

            <div className="text-[11px] text-zinc-300 font-mono flex items-center gap-2 border-t border-amber-500/20 pt-1.5 mt-0.5">
              <span>🌐</span>
              <span>{t.lobby.sameMatchNote}</span>
            </div>

            {/* Equivalência cross-border instantânea para amigos de qualquer país */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {parityPreview.map((p) => (
                <div
                  key={p.currency}
                  className="px-1.5 py-0.5 rounded bg-zinc-950/70 border border-zinc-800 text-[9px] font-mono text-zinc-300 flex items-center justify-between gap-1"
                >
                  <span>{p.flag}</span>
                  <span className="truncate tabular-nums">{p.formatted}</span>
                </div>
              ))}
            </div>
          </div>

          {streak > 0 && (
            <div className="p-2.5 rounded-xl border border-orange-500/50 bg-gradient-to-r from-orange-950/70 to-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <span className="text-xs font-black uppercase text-orange-400 font-mono">
                  {t.lobby.hotStreakLabel} {streak}x
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">{t.lobby.defendCrown}</span>
            </div>
          )}

          <div className="p-3.5 game-subplate rounded-2xl border border-zinc-800/90 flex flex-col gap-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Share2 size={14} />
                <span>{t.lobby.sendLinkTitle}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">{t.lobby.oneTap}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <MessageCircle size={15} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleShareFacebook}
                className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <Globe size={15} />
                <span>Facebook</span>
              </button>

              <button
                type="button"
                onClick={handleShareInstagramOrNative}
                className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <Smartphone size={15} />
                <span>Instagram</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onEnsureShareableRoom?.();
                  setShowQrModal(true);
                }}
                className="py-2.5 px-2 rounded-xl game-btn-gold text-zinc-950 font-black text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <QrCode size={15} />
                <span>QR Code</span>
              </button>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 game-panel rounded-xl px-3 py-2 text-xs text-zinc-300 font-mono select-all truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl game-btn-gold text-zinc-950 text-xs font-black uppercase tracking-wide cursor-pointer flex items-center gap-1 shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? t.lobby.copiedBtn : t.lobby.copyBtn}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onEnsureShareableRoom?.();
                setShowQrModal(true);
              }}
              className="mt-1 p-2.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 hover:border-amber-500/60 rounded-xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-10 h-10 rounded-lg border border-amber-400/50 bg-white p-0.5 object-contain shrink-0 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                    <QrCode size={20} className="text-amber-400" />
                  </div>
                )}
                <div>
                  <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                    <span>{t.lobby.scanQrCardTitle}</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                      {t.lobby.instantBadge}
                    </span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono block">
                    {t.lobby.scanQrCardSub}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                {t.lobby.viewQrLink}
              </span>
            </button>
          </div>

          {/* Voz em Tempo Real (Sala do Link/QR prioritária + Partida Aleatória) */}
          <VoiceChatPanel variant="lobby" roomCode={roomConfig.code} />

          {/* Grid Dinâmico dos Corredores (2, 3, 4 ou 5 Jogadores) + Botão de Remover */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} />
                <span>
                  {t.lobby.playersInArena} ({competitors.length}/{maxPlayers})
                </span>
              </span>

              {canControlRoom ? (
                <div className="flex items-center gap-2">
                  {onUpdateMaxPlayers && (
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 font-mono text-[10px]">
                      {([2, 3, 4, 5] as const).map((cap) => (
                        <button
                          key={cap}
                          type="button"
                          onClick={() => onUpdateMaxPlayers(cap)}
                          className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors ${
                            maxPlayers === cap
                              ? 'bg-amber-500 text-zinc-950 font-black'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                          title={`${cap} ${t.lobby.playersSuffix}`}
                        >
                          {cap}P
                        </button>
                      ))}
                    </div>
                  )}

                  {!serverConnected && (
                    <button
                      type="button"
                      onClick={onAddFriendSimulation}
                      disabled={competitors.length >= maxPlayers}
                      className="text-[11px] font-mono font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer disabled:opacity-30 disabled:no-underline"
                    >
                      {t.lobby.simulateFriend}
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] font-mono text-amber-300/85">
                  👑 {mpStrings.onlyLeaderControlsRoom}
                </span>
              )}
            </div>

            {isVoiceActive && (
              <div
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono flex items-center justify-between gap-2 transition-colors ${
                  activeSpeakerNames.length > 0
                    ? 'bg-emerald-950/65 border-emerald-400/70 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                    : 'bg-zinc-950/75 border-emerald-500/25 text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {activeSpeakerNames.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 shrink-0">
                      <Mic size={13} className="animate-pulse" />
                      <span className="flex items-end gap-0.5 h-3" aria-hidden="true">
                        <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce" />
                        <span className="w-0.5 h-3 bg-emerald-300 rounded-full animate-pulse" />
                        <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                      </span>
                    </span>
                  ) : (
                    <Volume2 size={13} className="text-emerald-400/75 shrink-0" />
                  )}
                  <span className="truncate font-bold">
                    {activeSpeakerNames.length > 0
                      ? activeSpeakerNames.join(', ')
                      : t.voice.lobbyTitle}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-300/90 shrink-0 tabular-nums">
                  {activeSpeakerNames.length > 0 ? t.voice.micOn : `${1 + voicePeers.length}/5`}
                </span>
              </div>
            )}

            <div
              className={`grid gap-2 ${
                maxPlayers === 2
                  ? 'grid-cols-2'
                  : maxPlayers === 3
                  ? 'grid-cols-3'
                  : maxPlayers === 4
                  ? 'grid-cols-4'
                  : 'grid-cols-2 sm:grid-cols-5'
              }`}
            >
              {Array.from({ length: maxPlayers }).map((_, idx) => {
                const comp = competitors[idx];
                if (comp) {
                  const matchedVoicePeer =
                    isVoiceActive && !comp.isPlayer && !comp.isBot
                      ? voicePeers.find(
                          (p) =>
                            p.peerId === comp.id ||
                            p.name.trim().toLowerCase() === comp.name.trim().toLowerCase()
                        )
                      : undefined;

                  const isPlayerInVoice =
                    isVoiceActive && (comp.isPlayer || Boolean(matchedVoicePeer));
                  const isVoiceMuted = comp.isPlayer
                    ? isMicMuted
                    : Boolean(
                        matchedVoicePeer &&
                          (matchedVoicePeer.muted ||
                            mutedPeerIds.includes(matchedVoicePeer.peerId))
                      );
                  const isTalkingNow = comp.isPlayer
                    ? isVoiceActive && isLocalSpeaking && !isMicMuted
                    : Boolean(matchedVoicePeer && matchedVoicePeer.speaking && !isVoiceMuted);

                  return (
                    <div
                      key={comp.id}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center justify-between text-center relative transition-all ${
                        isTalkingNow
                          ? 'bg-gradient-to-b from-emerald-500/25 to-emerald-950/50 border-emerald-400 shadow-[0_0_22px_rgba(16,185,129,0.45)] ring-2 ring-emerald-400/50'
                          : comp.isPlayer
                          ? 'bg-gradient-to-b from-amber-500/20 to-amber-950/35 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.28)]'
                          : 'game-subplate'
                      }`}
                    >
                      {isPlayerInVoice && (
                        <div
                          className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full border flex items-center gap-1 text-[9px] font-mono font-bold z-10 ${
                            isTalkingNow
                              ? 'bg-emerald-500 text-zinc-950 border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                              : isVoiceMuted
                              ? 'bg-zinc-900/90 text-rose-300 border-rose-500/40'
                              : 'bg-zinc-900/90 text-emerald-300 border-emerald-500/35'
                          }`}
                          title={
                            isTalkingNow
                              ? t.voice.youSpeaking
                              : isVoiceMuted
                              ? t.voice.micOff
                              : t.voice.micOn
                          }
                        >
                          {isTalkingNow ? (
                            <>
                              <Mic size={9} className="animate-pulse" />
                              <span className="flex items-end gap-0.5 h-2" aria-hidden="true">
                                <span className="w-0.5 h-1.5 bg-zinc-950 rounded-full animate-bounce" />
                                <span className="w-0.5 h-2 bg-zinc-950 rounded-full animate-pulse" />
                              </span>
                            </>
                          ) : isVoiceMuted ? (
                            <MicOff size={9} />
                          ) : (
                            <Volume2 size={9} />
                          )}
                        </div>
                      )}

                      <div className="flex flex-col items-center w-full">
                        <div
                          className={`mb-1 rounded-full p-0.5 transition-all ${
                            isTalkingNow
                              ? 'ring-2 ring-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.75)]'
                              : ''
                          }`}
                        >
                          <AvatarDoll
                            avatarId={comp.avatarId}
                            name={comp.name}
                            color={comp.color}
                            size={38}
                            variant="full"
                          />
                        </div>
                        <span className="text-[11px] font-bold text-zinc-200 truncate w-full">
                          {comp.name}
                        </span>
                        <span className="text-[10px] font-mono font-black text-emerald-300 tabular-nums mt-0.5">
                          {formatMoney(comp.betAmount ?? roomConfig.betAmount)}
                        </span>
                        <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                              isTalkingNow
                                ? 'bg-emerald-500 text-zinc-950 font-black'
                                : comp.isPlayer
                                ? 'bg-amber-500 text-zinc-950 font-black'
                                : comp.isBot
                                ? 'bg-sky-950 text-sky-400 border border-sky-800/60'
                                : comp.profileReady === false
                                ? 'bg-amber-950/90 text-amber-300 border border-amber-500/60 animate-pulse'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {comp.profileReady === false
                              ? mpStrings.selectingProfileBadge
                              : comp.isPlayer
                              ? t.lobby.youBadge
                              : comp.isBot
                              ? t.lobby.botBadge
                              : `🟢 ${t.lobby.friendBadge}`}
                          </span>
                          {comp.isHost && !comp.isBot && (
                            <span className="text-[8px] font-mono font-black px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/50">
                              {mpStrings.hostBadge}
                            </span>
                          )}
                          {comp.isSpectating && (
                            <span className="text-[8px] font-mono font-black px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/50">
                              👻
                            </span>
                          )}
                        </div>
                      </div>

                      {!comp.isPlayer && canControlRoom && (
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveCompetitor(comp.id);
                            setFeedbackMsg(t.lobby.removedToast);
                            setTimeout(() => setFeedbackMsg(null), 2800);
                          }}
                          className="mt-2 w-full py-1 px-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-600 border border-rose-500/40 hover:border-rose-400 text-rose-200 hover:text-white text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title={t.lobby.removePlayerBtn}
                        >
                          <UserMinus size={11} />
                          <span>{t.lobby.removePlayerBtn}</span>
                        </button>
                      )}
                    </div>
                  );
                }

                return canControlRoom && !serverConnected ? (
                  <button
                    key={`empty-${idx}`}
                    type="button"
                    onClick={onAddFriendSimulation}
                    className="p-2.5 min-h-[104px] rounded-2xl border border-dashed border-zinc-700 hover:border-amber-500/60 game-subplate flex flex-col items-center justify-center text-center text-zinc-500 hover:text-amber-300 cursor-pointer transition-colors"
                  >
                    <span className="text-xl mb-1">👤</span>
                    <span className="text-[10px] font-mono font-bold">{t.lobby.inviteSlot}</span>
                  </button>
                ) : (
                  <div
                    key={`empty-${idx}`}
                    className="p-2.5 min-h-[104px] rounded-2xl border border-dashed border-zinc-800 game-subplate flex flex-col items-center justify-center text-center text-zinc-600 opacity-75"
                  >
                    <span className="text-xl mb-1">👤</span>
                    <span className="text-[10px] font-mono font-bold">{t.lobby.inviteSlot}</span>
                  </div>
                );
              })}
            </div>

            {competitors.length < 2 && (
              <div className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-3 py-2 text-center">
                {t.lobby.waitingFriendsHint}
              </div>
            )}
          </div>

          {/* Chat de Texto em Tempo Real (WebSocket /ws/room) */}
          <div className="p-3 game-subplate rounded-2xl border border-amber-500/25 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle size={14} />
                <span>{mpStrings.roomChatTitle}</span>
                {chatMessages.length > 0 && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    ({chatMessages.length})
                  </span>
                )}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  serverConnected
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    serverConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                  }`}
                />
                <span>
                  {serverConnected ? mpStrings.roomChatLiveBadge : mpStrings.roomChatOfflineBadge}
                </span>
              </span>
            </div>

            <div
              ref={chatScrollRef}
              className="game-panel rounded-xl border border-zinc-800/90 px-2.5 py-2 h-36 overflow-y-auto flex flex-col gap-1.5"
              aria-live="polite"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-3">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {serverConnected ? mpStrings.roomChatEmpty : mpStrings.roomChatOfflineHint}
                  </span>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isOwn = Boolean(localPlayerId && msg.senderId === localPlayerId);
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${
                        isOwn
                          ? 'bg-amber-500/12 border border-amber-500/25'
                          : 'bg-zinc-900/75 border border-zinc-800/70'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 border border-white/10"
                        style={{ backgroundColor: `${msg.senderColor || '#38bdf8'}26` }}
                        aria-hidden="true"
                      >
                        {msg.senderAvatar || '⚡'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className="font-bold text-[11px] truncate"
                              style={{ color: isOwn ? '#fcd34d' : msg.senderColor || '#e4e4e7' }}
                            >
                              {msg.senderName}
                            </span>
                            {msg.isHost && (
                              <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                👑
                              </span>
                            )}
                            {isOwn && (
                              <span className="text-[9px] font-mono text-amber-300/80 shrink-0">
                                {t.youTag}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-mono text-zinc-500 tabular-nums shrink-0">
                            {formatChatTime(msg.sentAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-200 break-words leading-snug mt-0.5">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                maxLength={240}
                value={chatInput}
                disabled={!serverConnected || !onSendChatMessage}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  serverConnected ? mpStrings.roomChatPlaceholder : mpStrings.roomChatOfflineHint
                }
                aria-label={mpStrings.roomChatTitle}
                className="flex-1 min-w-0 game-panel rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 focus:border-amber-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!serverConnected || !onSendChatMessage || chatInput.trim().length === 0}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send size={13} />
                <span className="hidden sm:inline">{mpStrings.roomChatSendBtn}</span>
              </button>
            </form>
          </div>

          {onUpdateBet && (
            <div className="p-3 game-subplate rounded-2xl border border-amber-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="font-bold text-amber-300 uppercase tracking-wider">
                  💰 {mpStrings.roomBetInlineLabel} ({currencyMeta.flag} {currency})
                </span>
                <span className="font-black text-emerald-300 text-sm tabular-nums">
                  {formatMoney(roomConfig.betAmount)}
                </span>
              </div>
              {canControlRoom ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-amber-400 font-black font-mono">
                        {currencyMeta.symbol}
                      </span>
                      <input
                        type="number"
                        min={Number(minLocalBet.toFixed(currencyMeta.decimals))}
                        max={Number(maxLocalBet.toFixed(currencyMeta.decimals))}
                        step={currencyMeta.decimals === 0 ? 1 : 0.01}
                        value={arenaBetInput}
                        placeholder={`${mpStrings.manualBetPlaceholder} (${formatMoney(MIN_BET_KZ)} – ${formatMoney(MAX_BET_KZ)})`}
                        onFocus={() => setIsEditingField(true)}
                        onBlur={() => setIsEditingField(false)}
                        onChange={(e) => handleArenaBetInputChange(e.target.value)}
                        className={`w-full game-panel rounded-xl pl-12 pr-8 py-2 text-zinc-100 font-mono font-black text-xs focus:outline-none ${
                          arenaBetError ? 'border border-rose-500' : 'border border-zinc-700 focus:border-amber-400'
                        }`}
                      />
                      {arenaBetInput !== '' && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setArenaBetInput('');
                            setArenaBetError(null);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400 hover:text-amber-300 cursor-pointer px-1"
                          aria-label="Clear"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {arenaBetError && (
                    <span className="text-[10px] font-mono font-bold text-rose-400">
                      {arenaBetError}
                    </span>
                  )}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                    {presetChips.map((chip) => {
                      const active = Math.abs(roomConfig.betAmount - chip.kz) <= Math.max(2, chip.kz * 0.01);
                      return (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => {
                            setArenaBetInput(
                              formatEditableRoomBet(chip.kz, currencyMeta.decimals, rateForCurrency)
                            );
                            setArenaBetError(null);
                            onUpdateBet(chip.kz);
                          }}
                          className={`py-1.5 px-0.5 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-colors truncate ${
                            active
                              ? 'bg-amber-500 text-zinc-950 border-amber-300 font-black'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] font-mono text-amber-300/90">
                  👑 {mpStrings.hostControlsBetNote} ({roomConfig.hostName})
                </span>
              )}
            </div>
          )}

          <div className="p-3 game-subplate rounded-2xl border border-amber-500/35 flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-500 block text-[10px]">
                  {t.lobby.arenaPot} (x{torneiras.playerCount ?? Math.max(2, competitors.length)})
                </span>
                <span className="font-black text-amber-400 text-sm">
                  {formatMoney(torneiras.totalPotKz)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-zinc-500 block text-[10px]">
                  🥇 1º ({torneiras.firstPercent ?? 50}%)
                </span>
                <span className="font-black text-emerald-400 text-sm">
                  {formatMoney(torneiras.firstPrizeKz)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 border-t border-white/10 pt-1">
              {torneiras.secondPrizeKz > 0 ? (
                <span>
                  🥈 2º ({torneiras.secondPercent ?? 20}%):{' '}
                  <strong className="text-emerald-300">{formatMoney(torneiras.secondPrizeKz)}</strong>
                </span>
              ) : (
                <span className="text-rose-400/90">🥈 2º: 0 Kz (1v1)</span>
              )}
              {torneiras.thirdKeepsStake ? (
                <span className="text-sky-300">
                  🛡️ 3º: {formatMoney(torneiras.thirdPrizeKz)} (0% perda)
                </span>
              ) : (
                <span className="text-zinc-500">
                  {(torneiras.playerCount ?? 2) === 3 ? '🥉 3º perde' : '🏆 Duelo 1v1'}
                </span>
              )}
            </div>
          </div>

          {waitingForOpponent && (
            <div className="p-3 rounded-2xl bg-amber-500/15 border-2 border-amber-400 text-amber-200 text-xs font-mono font-bold flex flex-col gap-1 animate-pulse shadow-[0_0_24px_rgba(245,158,11,0.3)]">
              <div className="flex items-center gap-2">
                <span className="text-base shrink-0">⏳</span>
                <span>{mpStrings.waitingOpponentSelecting}</span>
              </div>
              {waitingOpponentNames.length > 0 && (
                <span className="text-[11px] text-amber-300 pl-6">
                  {mpStrings.waitingOpponentNamesPrefix} {waitingOpponentNames.join(', ')}
                </span>
              )}
            </div>
          )}

          {canSpectate && onEnterSpectatorMode && (
            <div className="p-3 rounded-2xl bg-sky-950/65 border-2 border-sky-400/70 text-sky-100 text-xs font-mono flex flex-col gap-2 shadow-[0_0_24px_rgba(56,189,248,0.22)]">
              <div className="flex flex-col gap-0.5">
                <span className="font-black text-sky-300 flex items-center gap-1.5">
                  <span>👻</span>
                  <span>{mpStrings.raceInProgressBanner}</span>
                </span>
                <span className="text-[10px] text-sky-200/85">
                  {mpStrings.noBetSpectatorNote}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onEnterSpectatorMode}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                >
                  <span>👻</span>
                  <span>{mpStrings.watchLiveRaceBtn}</span>
                </button>
                {onOpenSpectatorOverview && (
                  <button
                    type="button"
                    data-testid="lobby-spectator-overview-btn"
                    onClick={onOpenSpectatorOverview}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/60 text-sky-100 font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                  >
                    <span>📊</span>
                    <span>{mpStrings.spectatorOverviewBtn}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {canControlRoom ? (
            <button
              type="button"
              disabled={
                competitors.length < 2 ||
                Boolean(arenaBetError) ||
                serverRaceStatus === 'running' ||
                serverRaceStatus === 'starting'
              }
              onClick={onStartRace}
              className="w-full py-4 rounded-2xl game-btn-gold text-zinc-950 font-black text-base uppercase tracking-wider cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {`${t.lobby.startArenaBtn} (${competitors.length}/${maxPlayers})`}
            </button>
          ) : (
            <div
              data-testid="lobby-waiting-host-banner"
              className="w-full py-3.5 px-4 rounded-2xl game-subplate border border-amber-500/40 text-amber-200 flex flex-col items-center justify-center text-center gap-1"
            >
              <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span>⏳</span>
                <span>
                  {mpStrings.waitingHostToStartBtn} ({roomConfig.hostName})
                </span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                👑 {mpStrings.onlyHostCanStart}
              </span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <form onSubmit={handleSaveNewRoom} className="flex flex-col gap-3.5">
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-xs text-amber-300 font-mono">
            <span>{t.lobby.createNote}</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-300">{t.lobby.roomTitleLabel}</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full game-subplate rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs font-mono focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-300">{t.lobby.hostNameLabel}</label>
            <input
              type="text"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              className="w-full game-subplate rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs font-mono focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-zinc-300">
                {t.lobby.betPerRunnerLabel} ({currencyMeta.flag} {currency})
              </label>
              <span className="text-[10px] font-mono text-amber-300/90">
                {formatMoney(MIN_BET_KZ)} – {formatMoney(MAX_BET_KZ)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-amber-400 font-black font-mono">
                  {currencyMeta.symbol}
                </span>
                <input
                  type="number"
                  min={Number(minLocalBet.toFixed(currencyMeta.decimals))}
                  max={Number(maxLocalBet.toFixed(currencyMeta.decimals))}
                  step={currencyMeta.decimals === 0 ? 1 : 0.01}
                  value={newBetInput}
                  placeholder={`${mpStrings.manualBetPlaceholder} (${formatMoney(MIN_BET_KZ)} – ${formatMoney(MAX_BET_KZ)})`}
                  onFocus={() => {
                    setIsEditingNewBet(true);
                    setIsEditingField(true);
                  }}
                  onChange={(e) => handleManualRoomBetChange(e.target.value)}
                  onBlur={handleManualRoomBetBlur}
                  className={`w-full game-subplate rounded-xl pl-12 pr-8 py-2.5 text-zinc-100 font-mono font-black text-sm focus:outline-none ${
                    newBetError ? 'border-rose-500 focus:border-rose-400' : 'focus:border-amber-500'
                  }`}
                  required
                />
                {newBetInput !== '' && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsEditingNewBet(true);
                      setNewBet(null);
                      setNewBetInput('');
                      setNewBetError(rangeLabel);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400 hover:text-amber-300 cursor-pointer px-1"
                    aria-label="Clear"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => applyQuickRoomBetKz(MIN_BET_KZ)}
                className="px-2.5 py-2.5 game-btn-secondary text-zinc-200 font-bold text-[11px] font-mono rounded-xl cursor-pointer shrink-0"
              >
                MIN
              </button>
              <button
                type="button"
                onClick={() => applyQuickRoomBetKz(Math.floor((newBet ?? 500) / 2))}
                className="px-2.5 py-2.5 game-btn-secondary text-zinc-200 font-bold text-xs rounded-xl cursor-pointer shrink-0"
              >
                ½
              </button>
              <button
                type="button"
                onClick={() => applyQuickRoomBetKz((newBet ?? 500) * 2)}
                className="px-2.5 py-2.5 game-btn-secondary text-zinc-200 font-bold text-xs rounded-xl cursor-pointer shrink-0"
              >
                2X
              </button>
              <button
                type="button"
                onClick={() => applyQuickRoomBetKz(MAX_BET_KZ)}
                className="px-2.5 py-2.5 game-btn-secondary text-amber-400 font-bold text-[11px] font-mono rounded-xl cursor-pointer shrink-0"
              >
                {t.betting.maxBtn}
              </button>
            </div>

            {newBetError && (
              <span className="text-[11px] font-mono font-bold text-rose-400">
                {newBetError}
              </span>
            )}

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {presetChips.map((chip) => {
                const isSelected = newBet !== null && !newBetError && Math.abs(newBet - chip.kz) <= Math.max(1, chip.kz * 0.01);
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => applyQuickRoomBetKz(chip.kz)}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-mono font-bold border transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 border-amber-300 font-black shadow'
                        : 'game-subplate text-zinc-400 hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {newBet !== null && (
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {getCrossBorderStakeParity(newBet, rates, ['AOA', 'USD', 'EUR', 'BRL']).map((p) => (
                  <div
                    key={p.currency}
                    className="px-1.5 py-1 rounded bg-zinc-950/70 border border-zinc-800 text-[9px] font-mono text-zinc-300 flex items-center justify-between gap-1"
                  >
                    <span>{p.flag}</span>
                    <span className="truncate tabular-nums">{p.formatted}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300">{t.lobby.maxPlayersLabel}</label>
            <div className="grid grid-cols-4 gap-2">
              {([2, 3, 4, 5] as const).map((cap) => {
                const isSelected = newMaxPlayers === cap;
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setNewMaxPlayers(cap)}
                    className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex flex-col items-center ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 border-amber-300 font-black shadow'
                        : 'game-subplate text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-black">{cap}</span>
                    <span className="text-[10px]">{t.lobby.playersSuffix}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300">{t.lobby.accessModeTitle}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewAccessMode('invite-only')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 ${
                  newAccessMode === 'invite-only'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'game-subplate text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Lock size={14} className="shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="text-xs font-black block">{t.lobby.accessInviteOption}</span>
                  <span className="text-[10px] font-mono text-zinc-400 block leading-tight mt-0.5">
                    {t.lobby.accessInviteSub}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setNewAccessMode('random')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 ${
                  newAccessMode === 'random'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'game-subplate text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Shuffle size={14} className="shrink-0 mt-0.5 text-emerald-400" />
                <div>
                  <span className="text-xs font-black block">{t.lobby.accessRandomOption}</span>
                  <span className="text-[10px] font-mono text-zinc-400 block leading-tight mt-0.5">
                    {t.lobby.accessRandomSub}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="p-3 game-subplate rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-200 block">{t.lobby.fillBotsTitle}</span>
              <span className="text-[10px] text-zinc-400 font-mono">{t.lobby.fillBotsSub}</span>
            </div>
            <button
              type="button"
              onClick={() => setFillBotsOption(!fillBotsOption)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                fillBotsOption ? 'bg-amber-500' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                  fillBotsOption ? 'left-6.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl game-btn-gold text-zinc-950 font-black text-sm uppercase tracking-wider cursor-pointer mt-1"
          >
            {t.lobby.createArenaSubmit}
          </button>
        </form>
      )}

      {activeTab === 'scan' && (
        <div className="flex flex-col gap-3.5 game-subplate p-4 rounded-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <QrCode size={18} className="text-amber-400" />
              <div>
                <h4 className="text-xs font-black uppercase text-amber-400">{t.lobby.scanTitle}</h4>
                <span className="text-[10px] text-zinc-400 font-mono block">{t.lobby.scanSub}</span>
              </div>
            </div>
          </div>

          <div className="relative w-full aspect-video max-h-56 rounded-2xl game-panel border-2 border-dashed border-amber-500/45 overflow-hidden flex flex-col items-center justify-center">
            {cameraActive ? (
              <>
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-36 h-36 border-2 border-amber-400 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse" />
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute bottom-2 right-2 px-3 py-1 rounded-xl bg-black/80 text-rose-300 border border-rose-500/50 text-[11px] font-mono font-bold cursor-pointer"
                >
                  {t.lobby.stopCamera}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2.5 p-4 text-center">
                <Camera size={32} className="text-amber-400" />
                <span className="text-xs text-zinc-300 font-mono">{t.lobby.cameraHint}</span>
                <button
                  type="button"
                  onClick={startCameraScanner}
                  className="px-4 py-2 rounded-xl game-btn-gold text-zinc-950 font-black text-xs uppercase tracking-wide cursor-pointer flex items-center gap-1.5"
                >
                  <Camera size={14} />
                  <span>{t.lobby.openCamera}</span>
                </button>
              </div>
            )}
            <canvas ref={scanCanvasRef} className="hidden" />
          </div>

          {cameraError && (
            <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-mono">
              {cameraError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              parseAndJoinInput(manualJoinInput);
            }}
            className="flex flex-col gap-2 pt-2 border-t border-zinc-800"
          >
            <label className="text-[11px] font-mono font-bold text-zinc-300 uppercase">
              {t.lobby.manualCodeLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualJoinInput}
                onChange={(e) => setManualJoinInput(e.target.value)}
                placeholder={t.lobby.manualPlaceholder}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!manualJoinInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-black text-xs uppercase tracking-wide cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <LogIn size={14} />
                <span>{t.lobby.joinBtn}</span>
              </button>
            </div>
          </form>
          {onFindRandomRoom && (
            <button
              type="button"
              disabled={findingRandom}
              onClick={async () => {
                setFindingRandom(true);
                try {
                  await onFindRandomRoom();
                  setActiveTab('arena');
                } finally {
                  setFindingRandom(false);
                }
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Shuffle size={15} />
              <span>{t.lobby.findRandomRoomBtn}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 font-mono border-t border-zinc-800/80 pt-2.5">
        <span>{t.lobby.footerNote}</span>
        <div className="flex items-center gap-3">
          {canControlRoom ? (
            <>
              {onDeleteRoom && (
                confirmDeleteRoom ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteRoom(false);
                        onDeleteRoom();
                      }}
                      className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                    >
                      {t.lobby.deleteRoomConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRoom(false)}
                      className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold cursor-pointer"
                    >
                      {t.lobby.deleteRoomCancel}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteRoom(true)}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 size={11} />
                    <span>{t.lobby.deleteRoomBtn}</span>
                  </button>
                )
              )}
              <button
                type="button"
                onClick={onRegenerateRoomCode}
                className="text-amber-400/80 hover:text-amber-300 underline cursor-pointer"
              >
                {t.lobby.changeCode} ({roomConfig.code})
              </button>
            </>
          ) : (
            onLeaveRoom && (
              <button
                type="button"
                onClick={onLeaveRoom}
                className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <LogIn size={11} className="rotate-180" />
                <span>{mpStrings.leaveRoomBtn}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Modal QR Code */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl game-panel-gold p-5 shadow-[0_0_60px_rgba(245,158,11,0.38)] flex flex-col items-center text-center gap-3.5"
            >
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <div>
                  <h4 className="text-base font-black uppercase text-amber-400 tracking-wide">
                    {t.lobby.qrModalTitle}
                  </h4>
                  <span className="text-[11px] font-mono text-zinc-400 block">
                    {roomConfig.title} · <strong className="text-amber-300">{roomConfig.code}</strong>
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
                {t.lobby.qrModalHint}
              </div>

              <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-amber-500/60 inline-flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR ${roomConfig.code}`}
                    className="w-56 h-56 object-contain"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-zinc-100 text-zinc-600 font-mono text-xs">
                    QR...
                  </div>
                )}
              </div>

              <div className="w-full grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-300 game-subplate p-2.5 rounded-xl">
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
              </div>

              <div className="w-full flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full py-2.5 rounded-xl game-btn-gold text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? t.lobby.copiedBtn : t.lobby.copyBtn}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="py-2 px-3 rounded-xl game-btn-secondary text-zinc-200 font-bold text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>{t.lobby.downloadQr}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQrModal(false)}
                    className="py-2 px-3 rounded-xl game-btn-secondary text-zinc-300 font-bold text-xs font-mono cursor-pointer"
                  >
                    {t.rules.closeBtn}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
