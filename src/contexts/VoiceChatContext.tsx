import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getSessionPlayerId } from '../utils/offlineSync';
import {
  createVoiceAudioProcessor,
  type VoiceAudioProcessorHandle,
  type VoiceProcessorTelemetry,
} from '../utils/voiceAudioProcessor';
import {
  clearVoiceActivitySessions,
  listVoiceActivitySessions,
  upsertVoiceActivitySession,
  type VoiceActivitySessionLog,
} from '../utils/voiceActivityDb';
import type { GameStatus, TelemetryInvestigationEntry } from '../types/game';

export type { VoiceActivitySessionLog };

const EMPTY_INVESTIGATIONS: Record<string, TelemetryInvestigationEntry> = {};

export type VoiceChannelMode = 'private' | 'public';
export type VoiceNoiseGateMode = 'strict' | 'balanced';

export interface VoiceRemotePeer {
  peerId: string;
  name: string;
  avatar: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

interface VoiceChatContextValue {
  isSupported: boolean;
  isOnline: boolean;
  isJoined: boolean;
  isConnecting: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'offline-local';
  channelMode: VoiceChannelMode;
  activeRoomKey: string;
  peers: VoiceRemotePeer[];
  isMicMuted: boolean;
  isDeafened: boolean;
  isLocalSpeaking: boolean;
  /** Nível em tempo real após filtro High-Pass + Noise Gate (0..1) */
  localMicLevel: number;
  /** Nível captado antes do Noise Gate (para confirmar supressão de ruído ambiente) */
  preGateMicLevel: number;
  /** Verdadeiro quando há som ambiente detetado antes do gate mas suprimido na saída */
  isNoiseSuppressed: boolean;
  /** Web Audio AnalyserNode ligado após High-Pass e Noise Gate */
  analyserNode: AnalyserNode | null;
  mutedPeerIds: string[];
  errorMsg: string | null;
  noiseGateMode: VoiceNoiseGateMode;
  hasHeadset: boolean;
  selectedMicLabel: string | null;
  investigatingCompetitors: Record<string, TelemetryInvestigationEntry>;
  voiceSessionHistory: VoiceActivitySessionLog[];
  currentVoiceActivity: VoiceActivitySessionLog | null;
  setNoiseGateMode: (mode: VoiceNoiseGateMode) => void;
  joinVoice: (opts?: { mode?: VoiceChannelMode; withMic?: boolean }) => Promise<void>;
  leaveVoice: () => void;
  toggleMic: () => Promise<void>;
  muteMicrophone: () => void;
  toggleDeafen: () => void;
  switchChannelMode: (mode: VoiceChannelMode) => void;
  toggleMutePeer: (peerId: string) => void;
  updateIdentity: (roomCode: string, playerName: string, avatar: string) => void;
  refreshVoiceHistory: () => Promise<void>;
  clearVoiceHistory: () => Promise<void>;
}

const VoiceChatContext = createContext<VoiceChatContextValue | null>(null);

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const HEADSET_KEYWORDS = [
  'headset',
  'headphone',
  'earphone',
  'earpiece',
  'earbud',
  'airpod',
  'buds',
  'bluetooth',
  'hands-free',
  'handsfree',
  'auricular',
  'fone',
  'wired mic',
  'usb audio',
];

function isHeadsetDeviceLabel(label: string): boolean {
  const lower = label.toLowerCase();
  return HEADSET_KEYWORDS.some((kw) => lower.includes(kw));
}

const VOICE_ACTIVITY_SAVE_INTERVAL_MS = 5000;

interface ActiveVoiceActivityTracker {
  id: string;
  roomCode: string;
  raceRound: number;
  channelMode: VoiceChannelMode;
  playerName: string;
  startedAt: number;
  activeVoiceConnectedMs: number;
  micUnmutedMs: number;
  speakingDurationMs: number;
  speakingBurstCount: number;
  peakLevel: number;
  levelSum: number;
  levelSamples: number;
  noiseSuppressedEvents: number;
  connectedSinceMs: number | null;
  unmutedSinceMs: number | null;
  speakingSinceMs: number | null;
  wasSuppressed: boolean;
  dirty: boolean;
}

export const VoiceChatProvider: React.FC<{
  children: React.ReactNode;
  roomCode: string;
  playerName: string;
  playerAvatar: string;
  hasInviteLink: boolean;
  raceRound?: number;
  raceStatus?: GameStatus;
  investigatingCompetitors?: Record<string, TelemetryInvestigationEntry>;
}> = ({
  children,
  roomCode,
  playerName,
  playerAvatar,
  raceRound = 0,
  raceStatus = 'idle',
  investigatingCompetitors = EMPTY_INVESTIGATIONS,
}) => {
  const isSupported =
    typeof window !== 'undefined' &&
    typeof WebSocket !== 'undefined' &&
    typeof RTCPeerConnection !== 'undefined';

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [channelMode, setChannelMode] = useState<VoiceChannelMode>('private');
  const [activeRoomKey, setActiveRoomKey] = useState<string>(`PRIVATE:${roomCode}`);
  const [peers, setPeers] = useState<VoiceRemotePeer[]>([]);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(true);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState<boolean>(false);
  const [localMicLevel, setLocalMicLevel] = useState<number>(0);
  const [preGateMicLevel, setPreGateMicLevel] = useState<number>(0);
  const [isNoiseSuppressed, setIsNoiseSuppressed] = useState<boolean>(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [mutedPeerIds, setMutedPeerIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noiseGateMode, setNoiseGateModeState] = useState<VoiceNoiseGateMode>('strict');
  const [hasHeadset, setHasHeadset] = useState<boolean>(false);
  const [selectedMicLabel, setSelectedMicLabel] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    'disconnected' | 'connecting' | 'connected' | 'offline-local'
  >('disconnected');
  const [voiceSessionHistory, setVoiceSessionHistory] = useState<VoiceActivitySessionLog[]>([]);
  const [currentVoiceActivity, setCurrentVoiceActivity] = useState<VoiceActivitySessionLog | null>(
    null
  );

  const peerIdRef = useRef<string>(getSessionPlayerId());
  const wsRef = useRef<WebSocket | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioProcessorRef = useRef<VoiceAudioProcessorHandle | null>(null);
  const lastSpeakingEmitRef = useRef<boolean>(false);
  const lastSpeakEmitTimeRef = useRef<number>(0);
  const lastUiLevelEmitRef = useRef<number>(0);
  const lastUiLevelRef = useRef<number>(0);
  const lastPreLevelRef = useRef<number>(0);
  const lastSuppressedRef = useRef<boolean>(false);

  const identityRef = useRef({ roomCode, playerName, playerAvatar });
  const raceRoundRef = useRef<number>(raceRound);
  const raceStatusRef = useRef<GameStatus>(raceStatus);
  const activityTrackerRef = useRef<ActiveVoiceActivityTracker | null>(null);
  const micMutedRef = useRef(isMicMuted);
  const deafenedRef = useRef(isDeafened);
  const channelModeRef = useRef(channelMode);
  const joinedRef = useRef(isJoined);
  const noiseGateModeRef = useRef<VoiceNoiseGateMode>(noiseGateMode);
  const hasHeadsetRef = useRef<boolean>(hasHeadset);
  const anyRemoteSpeakingRef = useRef<boolean>(false);
  const mutedPeersSetRef = useRef<Set<string>>(new Set());

  const refreshVoiceHistory = useCallback(async () => {
    const rows = await listVoiceActivitySessions(30);
    setVoiceSessionHistory(rows);
  }, []);

  const clearVoiceHistory = useCallback(async () => {
    await clearVoiceActivitySessions();
    setVoiceSessionHistory([]);
  }, []);

  const buildActivitySnapshot = useCallback(
    (tracker: ActiveVoiceActivityTracker, nowMs: number, endedAt: number | null): VoiceActivitySessionLog => {
      const extraConnected =
        tracker.connectedSinceMs !== null ? Math.max(0, nowMs - tracker.connectedSinceMs) : 0;
      const extraUnmuted =
        tracker.unmutedSinceMs !== null ? Math.max(0, nowMs - tracker.unmutedSinceMs) : 0;
      const extraSpeaking =
        tracker.speakingSinceMs !== null ? Math.max(0, nowMs - tracker.speakingSinceMs) : 0;

      return {
        id: tracker.id,
        roomCode: tracker.roomCode,
        raceRound: tracker.raceRound,
        channelMode: tracker.channelMode,
        playerName: tracker.playerName,
        startedAt: tracker.startedAt,
        lastSavedAt: nowMs,
        endedAt,
        activeVoiceConnectedMs: Math.round(tracker.activeVoiceConnectedMs + extraConnected),
        micUnmutedMs: Math.round(tracker.micUnmutedMs + extraUnmuted),
        speakingDurationMs: Math.round(tracker.speakingDurationMs + extraSpeaking),
        speakingBurstCount: tracker.speakingBurstCount,
        peakLevel: Number(tracker.peakLevel.toFixed(3)),
        avgSpeakingLevel:
          tracker.levelSamples > 0
            ? Number((tracker.levelSum / tracker.levelSamples).toFixed(3))
            : 0,
        noiseSuppressedEvents: tracker.noiseSuppressedEvents,
      };
    },
    []
  );

  const settleTrackerClocks = useCallback((tracker: ActiveVoiceActivityTracker, nowMs: number) => {
    if (tracker.connectedSinceMs !== null) {
      tracker.activeVoiceConnectedMs += Math.max(0, nowMs - tracker.connectedSinceMs);
      tracker.connectedSinceMs = nowMs;
      tracker.dirty = true;
    }
    if (tracker.unmutedSinceMs !== null) {
      tracker.micUnmutedMs += Math.max(0, nowMs - tracker.unmutedSinceMs);
      tracker.unmutedSinceMs = nowMs;
      tracker.dirty = true;
    }
    if (tracker.speakingSinceMs !== null) {
      tracker.speakingDurationMs += Math.max(0, nowMs - tracker.speakingSinceMs);
      tracker.speakingSinceMs = nowMs;
      tracker.dirty = true;
    }
  }, []);

  const createFreshTracker = useCallback((nowMs: number): ActiveVoiceActivityTracker => {
    const cleanCode = (identityRef.current.roomCode || 'ARENA').trim().toUpperCase();
    const round = Math.max(0, Math.round(raceRoundRef.current || 0));
    const isSpeakingNow = joinedRef.current && !micMutedRef.current && lastSpeakingEmitRef.current;
    return {
      id: `${cleanCode}:R${round}:${nowMs}`,
      roomCode: cleanCode,
      raceRound: round,
      channelMode: channelModeRef.current,
      playerName: identityRef.current.playerName || 'Corredor',
      startedAt: nowMs,
      activeVoiceConnectedMs: 0,
      micUnmutedMs: 0,
      speakingDurationMs: 0,
      speakingBurstCount: isSpeakingNow ? 1 : 0,
      peakLevel: 0,
      levelSum: 0,
      levelSamples: 0,
      noiseSuppressedEvents: 0,
      connectedSinceMs: joinedRef.current ? nowMs : null,
      unmutedSinceMs: joinedRef.current && !micMutedRef.current ? nowMs : null,
      speakingSinceMs: isSpeakingNow ? nowMs : null,
      wasSuppressed: false,
      dirty: false,
    };
  }, []);

  const flushActivityToDb = useCallback(
    async (finalizeSession = false) => {
      const tracker = activityTrackerRef.current;
      if (!tracker) return;

      const nowMs = Date.now();
      settleTrackerClocks(tracker, nowMs);

      const hasMeaningfulActivity =
        tracker.activeVoiceConnectedMs >= 1000 ||
        tracker.speakingDurationMs > 0 ||
        tracker.speakingBurstCount > 0;

      if (!hasMeaningfulActivity) {
        if (finalizeSession) {
          activityTrackerRef.current = null;
          setCurrentVoiceActivity(null);
        }
        return;
      }

      const snapshot = buildActivitySnapshot(tracker, nowMs, finalizeSession ? nowMs : null);
      if (finalizeSession) {
        activityTrackerRef.current = null;
        setCurrentVoiceActivity(null);
      } else {
        tracker.dirty = false;
        setCurrentVoiceActivity(snapshot);
      }

      const saved = await upsertVoiceActivitySession(snapshot);
      if (saved) {
        await refreshVoiceHistory();
      }
    },
    [buildActivitySnapshot, refreshVoiceHistory, settleTrackerClocks]
  );

  useEffect(() => {
    void refreshVoiceHistory();
  }, [refreshVoiceHistory]);

  const syncProcessorParams = useCallback(() => {
    audioProcessorRef.current?.updateParams({
      micMuted: micMutedRef.current,
      deafened: deafenedRef.current,
      noiseGateMode: noiseGateModeRef.current,
      hasHeadset: hasHeadsetRef.current,
      remoteSpeaking: anyRemoteSpeakingRef.current,
    });
  }, []);

  useEffect(() => {
    identityRef.current = { roomCode, playerName, playerAvatar };
    if (activityTrackerRef.current) {
      activityTrackerRef.current.playerName = playerName || activityTrackerRef.current.playerName;
    }
  }, [roomCode, playerName, playerAvatar]);

  useEffect(() => {
    micMutedRef.current = isMicMuted;
    const tracker = activityTrackerRef.current;
    if (tracker) {
      const nowMs = Date.now();
      settleTrackerClocks(tracker, nowMs);
      if (isMicMuted || !joinedRef.current) {
        tracker.unmutedSinceMs = null;
        tracker.speakingSinceMs = null;
      } else if (tracker.unmutedSinceMs === null) {
        tracker.unmutedSinceMs = nowMs;
      }
      setCurrentVoiceActivity(buildActivitySnapshot(tracker, nowMs, null));
    }
    syncProcessorParams();
  }, [buildActivitySnapshot, isMicMuted, settleTrackerClocks, syncProcessorParams]);

  useEffect(() => {
    deafenedRef.current = isDeafened;
    for (const [pId, audioEl] of remoteAudiosRef.current.entries()) {
      audioEl.muted = isDeafened || mutedPeersSetRef.current.has(pId);
    }
    syncProcessorParams();
  }, [isDeafened, syncProcessorParams]);

  useEffect(() => {
    channelModeRef.current = channelMode;
    if (activityTrackerRef.current) {
      activityTrackerRef.current.channelMode = channelMode;
      activityTrackerRef.current.dirty = true;
    }
  }, [channelMode]);

  useEffect(() => {
    joinedRef.current = isJoined;
    const nowMs = Date.now();
    if (isJoined) {
      if (!activityTrackerRef.current) {
        activityTrackerRef.current = createFreshTracker(nowMs);
      } else {
        settleTrackerClocks(activityTrackerRef.current, nowMs);
        activityTrackerRef.current.connectedSinceMs = nowMs;
        if (!micMutedRef.current) {
          activityTrackerRef.current.unmutedSinceMs = nowMs;
        }
      }
      setCurrentVoiceActivity(buildActivitySnapshot(activityTrackerRef.current, nowMs, null));
    } else if (activityTrackerRef.current) {
      activityTrackerRef.current.connectedSinceMs = null;
      activityTrackerRef.current.unmutedSinceMs = null;
      activityTrackerRef.current.speakingSinceMs = null;
    }
  }, [buildActivitySnapshot, createFreshTracker, isJoined, settleTrackerClocks]);

  useEffect(() => {
    const prevRound = raceRoundRef.current;
    const prevStatus = raceStatusRef.current;
    raceRoundRef.current = raceRound;
    raceStatusRef.current = raceStatus;

    if (!joinedRef.current) return;

    const roundStarted = raceRound > 0 && raceRound !== prevRound;
    const raceCompleted = raceStatus === 'completed' && prevStatus !== 'completed';

    if (roundStarted) {
      void (async () => {
        await flushActivityToDb(true);
        if (joinedRef.current) {
          const fresh = createFreshTracker(Date.now());
          activityTrackerRef.current = fresh;
          setCurrentVoiceActivity(buildActivitySnapshot(fresh, Date.now(), null));
        }
      })();
    } else if (raceCompleted) {
      void flushActivityToDb(true);
    }
  }, [
    buildActivitySnapshot,
    createFreshTracker,
    flushActivityToDb,
    raceRound,
    raceStatus,
  ]);

  useEffect(() => {
    if (!isJoined) return;
    const intervalId = setInterval(() => {
      void flushActivityToDb(false);
    }, VOICE_ACTIVITY_SAVE_INTERVAL_MS);

    const handlePageHide = () => {
      void flushActivityToDb(false);
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushActivityToDb, isJoined]);

  useEffect(() => {
    noiseGateModeRef.current = noiseGateMode;
    syncProcessorParams();
  }, [noiseGateMode, syncProcessorParams]);

  useEffect(() => {
    anyRemoteSpeakingRef.current = peers.some(
      (p) => p.speaking && !p.muted && !mutedPeerIds.includes(p.peerId)
    );
    syncProcessorParams();
  }, [peers, mutedPeerIds, syncProcessorParams]);

  const refreshAudioDevices = useCallback(async (): Promise<{
    preferredInputId?: string;
    detectedHeadset: boolean;
  }> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return { detectedHeadset: false };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
      const headsetInput = audioInputs.find((d) => d.label && isHeadsetDeviceLabel(d.label));
      const headsetOutput = audioOutputs.find((d) => d.label && isHeadsetDeviceLabel(d.label));
      const detected = Boolean(headsetInput || headsetOutput);
      hasHeadsetRef.current = detected;
      setHasHeadset(detected);
      syncProcessorParams();
      if (headsetInput?.label) {
        setSelectedMicLabel(headsetInput.label);
      }
      return {
        preferredInputId: headsetInput?.deviceId || undefined,
        detectedHeadset: detected,
      };
    } catch {
      return { detectedHeadset: false };
    }
  }, [syncProcessorParams]);

  useEffect(() => {
    refreshAudioDevices().catch(() => {});
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      const onDeviceChange = () => {
        refreshAudioDevices().catch(() => {});
      };
      navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      };
    }
    return undefined;
  }, [refreshAudioDevices]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const sendSignal = useCallback((payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const setNoiseGateMode = useCallback(
    (mode: VoiceNoiseGateMode) => {
      noiseGateModeRef.current = mode;
      setNoiseGateModeState(mode);
      syncProcessorParams();
    },
    [syncProcessorParams]
  );

  const stopAudioPipeline = useCallback(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.dispose();
      audioProcessorRef.current = null;
    }
    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach((tr) => tr.stop());
      processedStreamRef.current = null;
    }
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getTracks().forEach((tr) => tr.stop());
      rawMicStreamRef.current = null;
    }
    lastSpeakingEmitRef.current = false;
    lastUiLevelRef.current = 0;
    lastPreLevelRef.current = 0;
    lastSuppressedRef.current = false;
    setLocalMicLevel(0);
    setPreGateMicLevel(0);
    setIsNoiseSuppressed(false);
    setAnalyserNode(null);
    setIsLocalSpeaking(false);
  }, []);

  const buildProcessedVocalPipeline = useCallback(
    async (rawStream: MediaStream): Promise<MediaStream> => {
      stopAudioPipeline();
      rawMicStreamRef.current = rawStream;

      const rawTrack = rawStream.getAudioTracks()[0];
      if (rawTrack?.label) {
        setSelectedMicLabel(rawTrack.label);
        if (isHeadsetDeviceLabel(rawTrack.label)) {
          hasHeadsetRef.current = true;
          setHasHeadset(true);
        }
      }

      const handleTelemetry = ({
        preGateRms,
        postGateRms,
        gateOpen,
      }: VoiceProcessorTelemetry) => {
        const nowPerf = performance.now();
        const muted = micMutedRef.current;

        // Nível final estritamente após High-Pass + Noise Gate (0 quando fechado)
        const postVisualLevel =
          muted || postGateRms < 0.0012
            ? 0
            : Math.min(1, Math.pow(postGateRms * 7.2, 0.72));

        // Nível após High-Pass antes do Noise Gate (para feedback visual de rejeição de ruído)
        const preVisualLevel =
          muted || preGateRms < 0.0015
            ? 0
            : Math.min(1, Math.pow(preGateRms * 6.5, 0.75));

        const suppressedNow = !muted && !gateOpen && preGateRms >= 0.003;

        if (
          nowPerf - lastUiLevelEmitRef.current > 65 &&
          (Math.abs(postVisualLevel - lastUiLevelRef.current) > 0.015 ||
            Math.abs(preVisualLevel - lastPreLevelRef.current) > 0.025 ||
            suppressedNow !== lastSuppressedRef.current)
        ) {
          lastUiLevelEmitRef.current = nowPerf;
          lastUiLevelRef.current = postVisualLevel;
          lastPreLevelRef.current = preVisualLevel;
          lastSuppressedRef.current = suppressedNow;
          setLocalMicLevel(postVisualLevel);
          setPreGateMicLevel(preVisualLevel);
          setIsNoiseSuppressed(suppressedNow);
        }

        const speakingNow = !muted && gateOpen;
        const tracker = activityTrackerRef.current;
        if (tracker && joinedRef.current) {
          if (suppressedNow && !tracker.wasSuppressed) {
            tracker.noiseSuppressedEvents += 1;
            tracker.dirty = true;
          }
          tracker.wasSuppressed = suppressedNow;

          if (speakingNow) {
            tracker.peakLevel = Math.max(tracker.peakLevel, postVisualLevel);
            tracker.levelSum += postVisualLevel;
            tracker.levelSamples += 1;
            tracker.dirty = true;
          }
        }

        if (
          speakingNow !== lastSpeakingEmitRef.current &&
          (!speakingNow ? nowPerf - lastSpeakEmitTimeRef.current > 120 : true)
        ) {
          lastSpeakingEmitRef.current = speakingNow;
          lastSpeakEmitTimeRef.current = nowPerf;
          setIsLocalSpeaking(speakingNow);

          if (tracker && joinedRef.current) {
            const nowWall = Date.now();
            settleTrackerClocks(tracker, nowWall);
            if (speakingNow) {
              if (tracker.speakingSinceMs === null) {
                tracker.speakingBurstCount += 1;
                tracker.speakingSinceMs = nowWall;
              }
            } else {
              tracker.speakingSinceMs = null;
            }
            tracker.dirty = true;
            setCurrentVoiceActivity(buildActivitySnapshot(tracker, nowWall, null));
          }

          sendSignal({
            type: 'voice:state',
            muted,
            deafened: deafenedRef.current,
            speaking: speakingNow,
          });
        }
      };

      const handle = await createVoiceAudioProcessor(
        rawStream,
        {
          micMuted: micMutedRef.current,
          deafened: deafenedRef.current,
          noiseGateMode: noiseGateModeRef.current,
          hasHeadset: hasHeadsetRef.current,
          remoteSpeaking: anyRemoteSpeakingRef.current,
        },
        handleTelemetry
      );

      audioProcessorRef.current = handle;
      processedStreamRef.current = handle.outputStream;
      setAnalyserNode(handle.analyserNode);
      return handle.outputStream;
    },
    [buildActivitySnapshot, sendSignal, settleTrackerClocks, stopAudioPipeline]
  );

  const closePeerConnection = useCallback((remotePeerId: string) => {
    const pc = pcsRef.current.get(remotePeerId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {
        // noop
      }
      pcsRef.current.delete(remotePeerId);
    }
    const audioEl = remoteAudiosRef.current.get(remotePeerId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      remoteAudiosRef.current.delete(remotePeerId);
    }
    if (typeof document !== 'undefined') {
      document
        .querySelectorAll(`audio[data-voice-peer="${remotePeerId}"]`)
        .forEach((el) => el.remove());
    }
  }, []);

  const clearAllPeerConnections = useCallback(() => {
    for (const remoteId of Array.from(pcsRef.current.keys())) {
      closePeerConnection(remoteId);
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio[data-voice-peer]').forEach((el) => {
        const audio = el as HTMLAudioElement;
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      });
    }
    remoteAudiosRef.current.clear();
  }, [closePeerConnection]);

  const cleanupAllConnections = useCallback(() => {
    clearAllPeerConnections();
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'voice:leave' }));
        }
        wsRef.current.close();
      } catch {
        // noop
      }
      wsRef.current = null;
    }
    stopAudioPipeline();
    setPeers([]);
    setIsConnecting(false);
  }, [clearAllPeerConnections, stopAudioPipeline]);

  useEffect(() => {
    return () => {
      void flushActivityToDb(true);
      cleanupAllConnections();
    };
  }, [cleanupAllConnections, flushActivityToDb]);

  const acquireMicStream = useCallback(async (): Promise<MediaStream | null> => {
    if (processedStreamRef.current && rawMicStreamRef.current) {
      const activeRaw = rawMicStreamRef.current.getAudioTracks()[0];
      const activeProcessed = processedStreamRef.current.getAudioTracks()[0];
      if (
        activeRaw &&
        activeRaw.readyState === 'live' &&
        activeProcessed &&
        activeProcessed.readyState === 'live'
      ) {
        return processedStreamRef.current;
      }
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Microfone não suportado neste navegador.');
      return null;
    }
    try {
      const { preferredInputId } = await refreshAudioDevices();
      const audioConstraints: MediaTrackConstraints & { voiceIsolation?: boolean } = {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
        voiceIsolation: true,
      };
      if (preferredInputId) {
        audioConstraints.deviceId = { ideal: preferredInputId };
      }

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });
      const micTrack = rawStream.getAudioTracks()[0];
      if (micTrack?.applyConstraints) {
        micTrack
          .applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          })
          .catch(() => {});
      }
      await refreshAudioDevices();
      const processed = await buildProcessedVocalPipeline(rawStream);
      return processed;
    } catch {
      setErrorMsg('Permissão de microfone recusada. Podes continuar apenas a ouvir!');
      return null;
    }
  }, [buildProcessedVocalPipeline, refreshAudioDevices]);

  const attachLocalTrackToPeer = useCallback(async (pc: RTCPeerConnection) => {
    const stream = processedStreamRef.current || rawMicStreamRef.current;
    const track = stream?.getAudioTracks()[0] || null;
    const audioSenders = pc.getSenders().filter((s) => s.track?.kind === 'audio' || !s.track);
    if (audioSenders.length > 0 && track) {
      await audioSenders[0].replaceTrack(track).catch(() => {});
    } else if (track && stream) {
      pc.addTrack(track, stream);
    } else if (pc.getTransceivers().length === 0) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
  }, []);

  const createPeerConnection = useCallback(
    async (remotePeerId: string, shouldInitiateOffer: boolean) => {
      const existingPc = pcsRef.current.get(remotePeerId);
      if (existingPc && existingPc.signalingState !== 'closed' && existingPc.connectionState !== 'failed') {
        return existingPc;
      }
      if (existingPc) {
        closePeerConnection(remotePeerId);
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcsRef.current.set(remotePeerId, pc);

      await attachLocalTrackToPeer(pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: 'voice:ice',
            targetPeerId: remotePeerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        if (pcsRef.current.get(remotePeerId) !== pc) return;
        const incomingTrack = event.track;
        const remoteStream = event.streams[0] || new MediaStream([incomingTrack]);

        // Garante exatamente 1 elemento <audio> por jogador remoto para evitar eco/voz duplicada
        if (typeof document !== 'undefined') {
          document
            .querySelectorAll(`audio[data-voice-peer="${remotePeerId}"]`)
            .forEach((node) => {
              if (node !== remoteAudiosRef.current.get(remotePeerId)) {
                (node as HTMLAudioElement).pause();
                (node as HTMLAudioElement).srcObject = null;
                node.remove();
              }
            });
        }

        let audioEl = remoteAudiosRef.current.get(remotePeerId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.dataset.voicePeer = remotePeerId;
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          remoteAudiosRef.current.set(remotePeerId, audioEl);
        }

        if (audioEl.srcObject !== remoteStream) {
          audioEl.srcObject = remoteStream;
        }
        audioEl.muted = deafenedRef.current || mutedPeersSetRef.current.has(remotePeerId);
        audioEl.volume = 0.92;
        audioEl.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (pcsRef.current.get(remotePeerId) === pc) {
            closePeerConnection(remotePeerId);
          }
        }
      };

      if (shouldInitiateOffer) {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          sendSignal({
            type: 'voice:offer',
            targetPeerId: remotePeerId,
            sdp: offer,
          });
        } catch (err) {
          console.error('Erro ao criar oferta WebRTC:', err);
        }
      }

      return pc;
    },
    [attachLocalTrackToPeer, closePeerConnection, sendSignal]
  );

  const connectWebSocket = useCallback(
    (mode: VoiceChannelMode) => {
      if (!isSupported) return;
      clearAllPeerConnections();

      if (wsRef.current) {
        try {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onerror = null;
          wsRef.current.onclose = null;
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'voice:leave' }));
          }
          wsRef.current.close();
        } catch {
          // noop
        }
        wsRef.current = null;
      }

      if (!navigator.onLine) {
        setConnectionState('offline-local');
        setIsConnecting(false);
        return;
      }

      setIsConnecting(true);
      setConnectionState('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/voice`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws) {
          ws.close();
          return;
        }
        setIsConnecting(false);
        setConnectionState('connected');
        setErrorMsg(null);
        const id = identityRef.current;
        sendSignal({
          type: 'voice:join',
          peerId: peerIdRef.current,
          name: id.playerName,
          avatar: id.playerAvatar,
          roomCode: id.roomCode,
          mode,
          muted: micMutedRef.current,
          deafened: deafenedRef.current,
        });
      };

      ws.onmessage = async (event) => {
        if (wsRef.current !== ws) return;
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            roomKey?: string;
            peers?: VoiceRemotePeer[];
            peer?: VoiceRemotePeer;
            peerId?: string;
            fromPeerId?: string;
            fromPeer?: VoiceRemotePeer;
            muted?: boolean;
            deafened?: boolean;
            speaking?: boolean;
            sdp?: RTCSessionDescriptionInit;
            candidate?: RTCIceCandidateInit;
          };

          if (!msg.type) return;

          if (msg.type === 'voice:joined') {
            if (msg.roomKey) setActiveRoomKey(msg.roomKey);
            const rawPeers = Array.isArray(msg.peers) ? msg.peers : [];
            const deduped = rawPeers.filter(
              (p, i, arr) => p.peerId !== peerIdRef.current && arr.findIndex((x) => x.peerId === p.peerId) === i
            );
            setPeers(deduped);
            for (const p of deduped) {
              await createPeerConnection(p.peerId, true);
            }
            return;
          }

          if (msg.type === 'voice:peer-joined' && msg.peer) {
            const joinedPeer = msg.peer;
            if (joinedPeer.peerId === peerIdRef.current) return;
            setPeers((prev) => {
              if (prev.some((p) => p.peerId === joinedPeer.peerId)) return prev;
              return [...prev, joinedPeer];
            });
            return;
          }

          if (msg.type === 'voice:peer-left' && msg.peerId) {
            closePeerConnection(msg.peerId);
            setPeers((prev) => prev.filter((p) => p.peerId !== msg.peerId));
            return;
          }

          if (msg.type === 'voice:kicked' || msg.type === 'voice:room-deleted') {
            joinedRef.current = false;
            setIsJoined(false);
            setIsMicMuted(true);
            micMutedRef.current = true;
            setConnectionState('disconnected');
            cleanupAllConnections();
            return;
          }

          if (msg.type === 'voice:peer-state' && msg.peerId) {
            setPeers((prev) =>
              prev.map((p) =>
                p.peerId === msg.peerId
                  ? {
                      ...p,
                      muted: typeof msg.muted === 'boolean' ? msg.muted : p.muted,
                      deafened: typeof msg.deafened === 'boolean' ? msg.deafened : p.deafened,
                      speaking: typeof msg.speaking === 'boolean' ? msg.speaking : p.speaking,
                    }
                  : p
              )
            );
            return;
          }

          if (msg.type === 'voice:offer' && msg.fromPeerId && msg.sdp) {
            if (msg.fromPeerId === peerIdRef.current) return;
            if (msg.fromPeer) {
              const incomingPeer = msg.fromPeer;
              setPeers((prev) =>
                prev.some((p) => p.peerId === incomingPeer.peerId)
                  ? prev
                  : [...prev, incomingPeer]
              );
            }
            const pc = await createPeerConnection(msg.fromPeerId, false);
            if (pc.signalingState !== 'stable') {
              const polite = peerIdRef.current < msg.fromPeerId;
              if (!polite) return;
              await Promise.all([
                pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
                pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)),
              ]);
            } else {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({
              type: 'voice:answer',
              targetPeerId: msg.fromPeerId,
              sdp: answer,
            });
            return;
          }

          if (msg.type === 'voice:answer' && msg.fromPeerId && msg.sdp) {
            const pc = pcsRef.current.get(msg.fromPeerId);
            if (pc && pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(() => {});
            }
            return;
          }

          if (msg.type === 'voice:ice' && msg.fromPeerId && msg.candidate) {
            const pc = pcsRef.current.get(msg.fromPeerId);
            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
            }
          }
        } catch {
          // Ignora pacotes inválidos
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        setIsConnecting(false);
        if (!navigator.onLine) {
          setConnectionState('offline-local');
        }
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        setIsConnecting(false);
        if (!joinedRef.current) {
          setConnectionState('disconnected');
        } else if (!navigator.onLine) {
          setConnectionState('offline-local');
        }
      };
    },
    [
      cleanupAllConnections,
      clearAllPeerConnections,
      closePeerConnection,
      createPeerConnection,
      isSupported,
      sendSignal,
    ]
  );

  const joinVoice = useCallback(
    async (opts?: { mode?: VoiceChannelMode; withMic?: boolean }) => {
      setErrorMsg(null);
      const targetMode = opts?.mode || channelModeRef.current;
      const wantMic = opts?.withMic ?? false;
      setChannelMode(targetMode);
      channelModeRef.current = targetMode;

      if (wantMic) {
        const stream = await acquireMicStream();
        if (stream) {
          rawMicStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
          stream.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
          setIsMicMuted(false);
          micMutedRef.current = false;
          audioProcessorRef.current?.updateParams({ micMuted: false });
        } else {
          setIsMicMuted(true);
          micMutedRef.current = true;
          audioProcessorRef.current?.updateParams({ micMuted: true });
        }
      } else {
        setIsMicMuted(true);
        micMutedRef.current = true;
        audioProcessorRef.current?.updateParams({ micMuted: true });
      }

      setIsJoined(true);
      joinedRef.current = true;

      if (!navigator.onLine) {
        setConnectionState('offline-local');
        return;
      }

      connectWebSocket(targetMode);
    },
    [acquireMicStream, connectWebSocket]
  );

  const leaveVoice = useCallback(() => {
    void flushActivityToDb(true);
    setIsJoined(false);
    joinedRef.current = false;
    setIsMicMuted(true);
    micMutedRef.current = true;
    setConnectionState('disconnected');
    setErrorMsg(null);
    cleanupAllConnections();
  }, [cleanupAllConnections, flushActivityToDb]);

  const muteMicrophone = useCallback(() => {
    setErrorMsg(null);
    rawMicStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
    processedStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
    for (const pc of pcsRef.current.values()) {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = false;
        }
      });
    }

    setIsMicMuted(true);
    micMutedRef.current = true;
    audioProcessorRef.current?.updateParams({ micMuted: true });

    lastSpeakingEmitRef.current = false;
    lastUiLevelRef.current = 0;
    lastPreLevelRef.current = 0;
    lastSuppressedRef.current = false;
    setIsLocalSpeaking(false);
    setLocalMicLevel(0);
    setPreGateMicLevel(0);
    setIsNoiseSuppressed(false);

    if (joinedRef.current) {
      sendSignal({
        type: 'voice:state',
        muted: true,
        deafened: deafenedRef.current,
        speaking: false,
      });
    }
  }, [sendSignal]);

  const toggleMic = useCallback(async () => {
    setErrorMsg(null);
    if (!joinedRef.current) {
      await joinVoice({ mode: channelModeRef.current, withMic: true });
      return;
    }

    const nextMuted = !micMutedRef.current;
    if (!nextMuted) {
      const stream = await acquireMicStream();
      if (!stream) {
        muteMicrophone();
        return;
      }
      rawMicStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      for (const pc of pcsRef.current.values()) {
        await attachLocalTrackToPeer(pc);
        pc.getSenders().forEach((sender) => {
          if (sender.track && sender.track.kind === 'audio') {
            sender.track.enabled = true;
          }
        });
      }

      setIsMicMuted(false);
      micMutedRef.current = false;
      audioProcessorRef.current?.updateParams({ micMuted: false });
      sendSignal({
        type: 'voice:state',
        muted: false,
        deafened: deafenedRef.current,
        speaking: false,
      });
    } else {
      muteMicrophone();
    }
  }, [acquireMicStream, attachLocalTrackToPeer, joinVoice, muteMicrophone, sendSignal]);

  const toggleDeafen = useCallback(() => {
    const nextDeafened = !deafenedRef.current;
    deafenedRef.current = nextDeafened;
    setIsDeafened(nextDeafened);
    for (const [pId, audioEl] of remoteAudiosRef.current.entries()) {
      audioEl.muted = nextDeafened || mutedPeersSetRef.current.has(pId);
    }
    sendSignal({
      type: 'voice:state',
      muted: micMutedRef.current,
      deafened: nextDeafened,
      speaking: !micMutedRef.current && isLocalSpeaking,
    });
  }, [isLocalSpeaking, sendSignal]);

  const switchChannelMode = useCallback(
    (newMode: VoiceChannelMode) => {
      if (newMode === channelModeRef.current) return;
      setChannelMode(newMode);
      channelModeRef.current = newMode;
      if (joinedRef.current) {
        clearAllPeerConnections();
        setPeers([]);
        connectWebSocket(newMode);
      }
    },
    [clearAllPeerConnections, connectWebSocket]
  );

  const toggleMutePeer = useCallback((peerId: string) => {
    setMutedPeerIds((prev) => {
      const next = prev.includes(peerId)
        ? prev.filter((id) => id !== peerId)
        : [...prev, peerId];
      mutedPeersSetRef.current = new Set(next);
      const audioEl = remoteAudiosRef.current.get(peerId);
      if (audioEl) {
        audioEl.muted = deafenedRef.current || mutedPeersSetRef.current.has(peerId);
      }
      return next;
    });
  }, []);

  const updateIdentity = useCallback(
    (newCode: string, newName: string, newAvatar: string) => {
      const changedRoom = identityRef.current.roomCode !== newCode;
      identityRef.current = { roomCode: newCode, playerName: newName, playerAvatar: newAvatar };
      if (joinedRef.current && changedRoom) {
        void (async () => {
          await flushActivityToDb(true);
          if (joinedRef.current) {
            const nowMs = Date.now();
            const fresh = createFreshTracker(nowMs);
            activityTrackerRef.current = fresh;
            setCurrentVoiceActivity(buildActivitySnapshot(fresh, nowMs, null));
          }
        })();
        if (channelModeRef.current === 'private') {
          clearAllPeerConnections();
          setPeers([]);
          connectWebSocket('private');
        }
      }
    },
    [
      buildActivitySnapshot,
      clearAllPeerConnections,
      connectWebSocket,
      createFreshTracker,
      flushActivityToDb,
    ]
  );

  useEffect(() => {
    updateIdentity(roomCode, playerName, playerAvatar);
  }, [roomCode, playerName, playerAvatar, updateIdentity]);

  const value = useMemo<VoiceChatContextValue>(
    () => ({
      isSupported,
      isOnline,
      isJoined,
      isConnecting,
      connectionState,
      channelMode,
      activeRoomKey,
      peers,
      isMicMuted,
      isDeafened,
      isLocalSpeaking,
      localMicLevel,
      preGateMicLevel,
      isNoiseSuppressed,
      analyserNode,
      mutedPeerIds,
      errorMsg,
      noiseGateMode,
      hasHeadset,
      selectedMicLabel,
      investigatingCompetitors,
      voiceSessionHistory,
      currentVoiceActivity,
      setNoiseGateMode,
      joinVoice,
      leaveVoice,
      toggleMic,
      muteMicrophone,
      toggleDeafen,
      switchChannelMode,
      toggleMutePeer,
      updateIdentity,
      refreshVoiceHistory,
      clearVoiceHistory,
    }),
    [
      isSupported,
      isOnline,
      isJoined,
      isConnecting,
      connectionState,
      channelMode,
      activeRoomKey,
      peers,
      isMicMuted,
      isDeafened,
      isLocalSpeaking,
      localMicLevel,
      preGateMicLevel,
      isNoiseSuppressed,
      analyserNode,
      mutedPeerIds,
      errorMsg,
      noiseGateMode,
      hasHeadset,
      selectedMicLabel,
      investigatingCompetitors,
      voiceSessionHistory,
      currentVoiceActivity,
      setNoiseGateMode,
      joinVoice,
      leaveVoice,
      toggleMic,
      muteMicrophone,
      toggleDeafen,
      switchChannelMode,
      toggleMutePeer,
      updateIdentity,
      refreshVoiceHistory,
      clearVoiceHistory,
    ]
  );

  return <VoiceChatContext.Provider value={value}>{children}</VoiceChatContext.Provider>;
};

export function useVoiceChat(): VoiceChatContextValue {
  const ctx = useContext(VoiceChatContext);
  if (!ctx) {
    throw new Error('useVoiceChat deve ser usado dentro de VoiceChatProvider');
  }
  return ctx;
}
