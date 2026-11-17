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
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Competitor, RoomAccessMode, RoomConfig } from '../types/game';
import {
  calculateThreeTorneiras,
  getCrossBorderStakeParity,
  getQuickBetChipsKz,
} from '../data/currency';
import { useI18n } from '../contexts/I18nContext';
import { VoiceChatPanel } from './VoiceChatPanel';
import { AvatarDoll } from './AvatarDoll';

interface JoinRoomPayload {
  code: string;
  title?: string;
  hostName?: string;
  maxPlayers?: number;
  betAmount?: number;
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
  onDeleteRoom?: () => void;
  onFindRandomRoom?: () => Promise<void> | void;
  roomNotice?: string | null;
  playerName?: string;
  onChangePlayerName?: (name: string) => void;
  serverConnected?: boolean;
  isDemo: boolean;
  onCloseLobby: () => void;
  streak?: number;
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
  onDeleteRoom,
  onFindRandomRoom,
  roomNotice = null,
  playerName = 'REI ZERO',
  onChangePlayerName,
  serverConnected = false,
  isDemo,
  onCloseLobby,
  streak = 0,
}) => {
  const { currency, t, rates, formatMoney } = useI18n();

  const maxPlayers = Math.max(2, Math.min(5, roomConfig.maxPlayers || 5)) as 2 | 3 | 4 | 5;
  const currentAccessMode: RoomAccessMode = roomConfig.accessMode || 'invite-only';
  const [activeTab, setActiveTab] = useState<'arena' | 'create' | 'scan'>('arena');
  const [copied, setCopied] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [, setCountdownToAutoBot] = useState<number>(10);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<boolean>(false);
  const [findingRandom, setFindingRandom] = useState<boolean>(false);

  const [manualJoinInput, setManualJoinInput] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [localNameInput, setLocalNameInput] = useState<string>(playerName);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [newTitle, setNewTitle] = useState<string>(roomConfig.title || 'Arena do Hamilton');
  const [newHost, setNewHost] = useState<string>(roomConfig.hostName || 'Hamilton O Zero');
  const [newBet, setNewBet] = useState<number>(roomConfig.betAmount || 500);
  const [newMaxPlayers, setNewMaxPlayers] = useState<2 | 3 | 4 | 5>(maxPlayers);
  const [newAccessMode, setNewAccessMode] = useState<RoomAccessMode>(currentAccessMode);
  const [fillBotsOption, setFillBotsOption] = useState<boolean>(roomConfig.fillWithBots);

  useEffect(() => {
    setNewMaxPlayers(maxPlayers);
  }, [maxPlayers]);

  const presetChips = useMemo(
    () => getQuickBetChipsKz(currency, rates).slice(0, 4),
    [currency, rates]
  );

  const parityPreview = useMemo(
    () => getCrossBorderStakeParity(roomConfig.betAmount, rates, ['AOA', 'USD', 'EUR', 'BRL', 'COP', 'MXN', 'CNY', 'EGP']),
    [roomConfig.betAmount, rates]
  );

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
              betAmount: isNaN(betNum) ? undefined : betNum,
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

  useEffect(() => {
    if (competitors.length >= maxPlayers || !roomConfig.fillWithBots) return;
    const interval = setInterval(() => {
      setCountdownToAutoBot((prev) => {
        if (prev <= 1) {
          onAddFriendSimulation();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [competitors.length, maxPlayers, roomConfig.fillWithBots, onAddFriendSimulation]);

  const torneiras = calculateThreeTorneiras(roomConfig.betAmount, Math.max(2, competitors.length));

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
          roomConfig.code
        )}&host=${encodeURIComponent(roomConfig.hostName)}&title=${encodeURIComponent(
          roomConfig.title
        )}&bet=${roomConfig.betAmount}&max=${maxPlayers}&mode=${isDemo ? 'demo' : 'real'}&access=${currentAccessMode}`
      : `https://rei-run.app/?room=${roomConfig.code}&max=${maxPlayers}&access=${currentAccessMode}`;

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
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
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
    const text = `👑 REI RUN · ${roomConfig.title} (${roomConfig.code})\n👤 ${t.lobby.hostLabel} ${roomConfig.hostName}\n💰 ${t.lobby.betLabel} ${formatMoney(roomConfig.betAmount)}\n🏁 ${t.lobby.sameMatchNote}\n👉 ${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    openExternalShare(url);
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    openExternalShare(url);
  };

  const handleShareInstagramOrNative = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `REI RUN — ${roomConfig.title}`,
          text: `👑 ${roomConfig.title} (${roomConfig.code}) · ${formatMoney(roomConfig.betAmount)} · ${t.officialPhrase}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback below
      }
    }
    await handleCopyLink();
  };

  const handleSaveNewRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim() || 'Arena do Hamilton';
    const cleanHost = newHost.trim() || 'Hamilton O Zero';
    const cleanCode = `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;

    const newConfig: RoomConfig = {
      code: cleanCode,
      title: cleanTitle,
      hostName: cleanHost,
      maxPlayers: newMaxPlayers,
      minPlayers: 2,
      betAmount: newBet,
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
            onChange={(e) => setLocalNameInput(e.target.value)}
            onBlur={() => {
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
              {onToggleAccessMode ? (
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
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shrink-0">
                  {t.lobby.privateBadge}
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
                onClick={() => setShowQrModal(true)}
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
              onClick={() => setShowQrModal(true)}
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

                <button
                  type="button"
                  onClick={onAddFriendSimulation}
                  disabled={competitors.length >= maxPlayers}
                  className="text-[11px] font-mono font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer disabled:opacity-30 disabled:no-underline"
                >
                  {t.lobby.simulateFriend}
                </button>
              </div>
            </div>

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
                  return (
                    <div
                      key={comp.id}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center justify-between text-center relative ${
                        comp.isPlayer
                          ? 'bg-gradient-to-b from-amber-500/20 to-amber-950/35 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.28)]'
                          : 'game-subplate'
                      }`}
                    >
                      <div className="flex flex-col items-center w-full">
                        <div className="mb-1">
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
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded mt-0.5 ${
                            comp.isPlayer
                              ? 'bg-amber-500 text-zinc-950 font-black'
                              : comp.isBot
                              ? 'bg-sky-950 text-sky-400 border border-sky-800/60'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {comp.isPlayer
                            ? t.lobby.youBadge
                            : comp.isBot
                            ? t.lobby.botBadge
                            : t.lobby.friendBadge}
                        </span>
                      </div>

                      {!comp.isPlayer && (
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

                return (
                  <button
                    key={`empty-${idx}`}
                    type="button"
                    onClick={onAddFriendSimulation}
                    className="p-2.5 min-h-[104px] rounded-2xl border border-dashed border-zinc-700 hover:border-amber-500/60 game-subplate flex flex-col items-center justify-center text-center text-zinc-500 hover:text-amber-300 cursor-pointer transition-colors"
                  >
                    <span className="text-xl mb-1">👤</span>
                    <span className="text-[10px] font-mono font-bold">{t.lobby.inviteSlot}</span>
                  </button>
                );
              })}
            </div>

            {competitors.length < 2 && (
              <div className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-3 py-2 text-center">
                {t.lobby.waitingFriendsHint}
              </div>
            )}
          </div>

          <div className="p-3 game-subplate rounded-2xl border border-amber-500/35 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-zinc-500 block text-[10px]">{t.lobby.arenaPot}</span>
              <span className="font-black text-amber-400 text-sm">
                {formatMoney(torneiras.totalPotKz)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 block text-[10px]">{t.lobby.championPrize}</span>
              <span className="font-black text-emerald-400 text-sm">
                {formatMoney(torneiras.firstPrizeKz)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={competitors.length < 2}
            onClick={onStartRace}
            className="w-full py-4 rounded-2xl game-btn-gold text-zinc-950 font-black text-base uppercase tracking-wider cursor-pointer disabled:opacity-40 active:scale-[0.99]"
          >
            {t.lobby.startArenaBtn} ({competitors.length}/{maxPlayers})
          </button>
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300">
              {t.lobby.betPerRunnerLabel} ({currency})
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetChips.map((chip) => {
                const isSelected = Math.abs(newBet - chip.kz) <= Math.max(2, chip.kz * 0.01);
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setNewBet(chip.kz)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 border-amber-300 font-black shadow'
                        : 'game-subplate text-zinc-400 hover:text-white'
                    }`}
                  >
                    {formatMoney(chip.kz)}
                  </button>
                );
              })}
            </div>
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
