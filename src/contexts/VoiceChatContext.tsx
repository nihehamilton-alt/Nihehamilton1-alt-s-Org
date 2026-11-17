import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getDeviceId } from '../utils/offlineSync';

export type VoiceChannelMode = 'private' | 'public';

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
  localMicLevel: number;
  mutedPeerIds: string[];
  errorMsg: string | null;
  joinVoice: (opts?: { mode?: VoiceChannelMode; withMic?: boolean }) => Promise<void>;
  leaveVoice: () => void;
  toggleMic: () => Promise<void>;
  toggleDeafen: () => void;
  switchChannelMode: (mode: VoiceChannelMode) => void;
  toggleMutePeer: (peerId: string) => void;
  updateIdentity: (roomCode: string, playerName: string, avatar: string) => void;
}

const VoiceChatContext = createContext<VoiceChatContextValue | null>(null);

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const VoiceChatProvider: React.FC<{
  children: React.ReactNode;
  roomCode: string;
  playerName: string;
  playerAvatar: string;
  hasInviteLink: boolean;
}> = ({ children, roomCode, playerName, playerAvatar, hasInviteLink }) => {
  const isSupported =
    typeof window !== 'undefined' &&
    typeof WebSocket !== 'undefined' &&
    typeof RTCPeerConnection !== 'undefined';

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [channelMode, setChannelMode] = useState<VoiceChannelMode>(() =>
    hasInviteLink ? 'private' : 'private'
  );
  const [activeRoomKey, setActiveRoomKey] = useState<string>(`PRIVATE:${roomCode}`);
  const [peers, setPeers] = useState<VoiceRemotePeer[]>([]);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(true);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState<boolean>(false);
  const [localMicLevel, setLocalMicLevel] = useState<number>(0);
  const [mutedPeerIds, setMutedPeerIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    'disconnected' | 'connecting' | 'connected' | 'offline-local'
  >('disconnected');

  const peerIdRef = useRef<string>(getDeviceId());
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micMonitorRafRef = useRef<number | null>(null);

  const identityRef = useRef({ roomCode, playerName, playerAvatar });
  const micMutedRef = useRef(isMicMuted);
  const deafenedRef = useRef(isDeafened);
  const channelModeRef = useRef(channelMode);
  const joinedRef = useRef(isJoined);
  const mutedPeersSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    identityRef.current = { roomCode, playerName, playerAvatar };
  }, [roomCode, playerName, playerAvatar]);

  useEffect(() => {
    micMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    deafenedRef.current = isDeafened;
    // Atualiza áudio de todos os peers remotos imediatamente
    for (const [pId, audioEl] of remoteAudiosRef.current.entries()) {
      audioEl.muted = isDeafened || mutedPeersSetRef.current.has(pId);
    }
  }, [isDeafened]);

  useEffect(() => {
    channelModeRef.current = channelMode;
  }, [channelMode]);

  useEffect(() => {
    joinedRef.current = isJoined;
  }, [isJoined]);

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

  const stopMicMonitor = useCallback(() => {
    if (micMonitorRafRef.current) {
      cancelAnimationFrame(micMonitorRafRef.current);
      micMonitorRafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setLocalMicLevel(0);
    setIsLocalSpeaking(false);
  }, []);

  const startMicMonitor = useCallback(
    (stream: MediaStream) => {
      stopMicMonitor();
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let lastSpeakingEmit = false;
        let lastEmitTime = 0;

        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length / 255;
          const level = micMutedRef.current ? 0 : Math.min(1, avg * 3.2);
          setLocalMicLevel(level);

          const speakingNow = !micMutedRef.current && level > 0.14;
          const now = performance.now();
          if (speakingNow !== lastSpeakingEmit && now - lastEmitTime > 180) {
            lastSpeakingEmit = speakingNow;
            lastEmitTime = now;
            setIsLocalSpeaking(speakingNow);
            sendSignal({
              type: 'voice:state',
              muted: micMutedRef.current,
              deafened: deafenedRef.current,
              speaking: speakingNow,
            });
          }
          micMonitorRafRef.current = requestAnimationFrame(tick);
        };
        micMonitorRafRef.current = requestAnimationFrame(tick);
      } catch {
        // Ignora caso navegador bloqueie AudioContext
      }
    },
    [sendSignal, stopMicMonitor]
  );

  const closePeerConnection = useCallback((remotePeerId: string) => {
    const pc = pcsRef.current.get(remotePeerId);
    if (pc) {
      try {
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
  }, []);

  const cleanupAllConnections = useCallback(() => {
    for (const remoteId of Array.from(pcsRef.current.keys())) {
      closePeerConnection(remoteId);
    }
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
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
    }
    stopMicMonitor();
    setPeers([]);
    setIsConnecting(false);
  }, [closePeerConnection, stopMicMonitor]);

  useEffect(() => {
    return () => {
      cleanupAllConnections();
    };
  }, [cleanupAllConnections]);

  const acquireMicStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) {
      const activeTrack = localStreamRef.current.getAudioTracks()[0];
      if (activeTrack && activeTrack.readyState === 'live') {
        return localStreamRef.current;
      }
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Microfone não suportado neste navegador.');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      localStreamRef.current = stream;
      startMicMonitor(stream);
      return stream;
    } catch {
      setErrorMsg('Permissão de microfone recusada. Podes continuar apenas a ouvir!');
      return null;
    }
  }, [startMicMonitor]);

  const attachLocalTrackToPeer = useCallback(async (pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
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
      if (pcsRef.current.has(remotePeerId)) {
        return pcsRef.current.get(remotePeerId)!;
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
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        let audioEl = remoteAudiosRef.current.get(remotePeerId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          remoteAudiosRef.current.set(remotePeerId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.muted = deafenedRef.current || mutedPeersSetRef.current.has(remotePeerId);
        audioEl.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeerConnection(remotePeerId);
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
      if (wsRef.current) {
        try {
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
            const existingPeers = Array.isArray(msg.peers) ? msg.peers : [];
            setPeers(existingPeers);
            for (const p of existingPeers) {
              await createPeerConnection(p.peerId, true);
            }
            return;
          }

          if (msg.type === 'voice:peer-joined' && msg.peer) {
            const joinedPeer = msg.peer;
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
            if (msg.fromPeer) {
              const incomingPeer = msg.fromPeer;
              setPeers((prev) =>
                prev.some((p) => p.peerId === incomingPeer.peerId)
                  ? prev
                  : [...prev, incomingPeer]
              );
            }
            const pc = await createPeerConnection(msg.fromPeerId, false);
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
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
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            }
            return;
          }

          if (msg.type === 'voice:ice' && msg.fromPeerId && msg.candidate) {
            const pc = pcsRef.current.get(msg.fromPeerId);
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
            }
          }
        } catch {
          // Ignora pacotes inválidos
        }
      };

      ws.onerror = () => {
        setIsConnecting(false);
        if (!navigator.onLine) {
          setConnectionState('offline-local');
        }
      };

      ws.onclose = () => {
        setIsConnecting(false);
        if (!joinedRef.current) {
          setConnectionState('disconnected');
        } else if (!navigator.onLine) {
          setConnectionState('offline-local');
        }
      };
    },
    [closePeerConnection, createPeerConnection, isSupported, sendSignal]
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
          stream.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
          setIsMicMuted(false);
          micMutedRef.current = false;
        } else {
          setIsMicMuted(true);
          micMutedRef.current = true;
        }
      } else {
        setIsMicMuted(true);
        micMutedRef.current = true;
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
    setIsJoined(false);
    joinedRef.current = false;
    setIsMicMuted(true);
    micMutedRef.current = true;
    setConnectionState('disconnected');
    setErrorMsg(null);
    cleanupAllConnections();
  }, [cleanupAllConnections]);

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
        setIsMicMuted(true);
        micMutedRef.current = true;
        return;
      }
      const track = stream.getAudioTracks()[0];
      if (track) track.enabled = true;

      // Atualiza track nos PeerConnections existentes
      for (const pc of pcsRef.current.values()) {
        await attachLocalTrackToPeer(pc);
      }
    } else if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    }

    setIsMicMuted(nextMuted);
    micMutedRef.current = nextMuted;
    if (nextMuted) setIsLocalSpeaking(false);

    sendSignal({
      type: 'voice:state',
      muted: nextMuted,
      deafened: deafenedRef.current,
      speaking: false,
    });
  }, [acquireMicStream, attachLocalTrackToPeer, joinVoice, sendSignal]);

  const toggleDeafen = useCallback(() => {
    const nextDeafened = !deafenedRef.current;
    setIsDeafened(nextDeafened);
    deafenedRef.current = nextDeafened;
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
        for (const id of Array.from(pcsRef.current.keys())) {
          closePeerConnection(id);
        }
        setPeers([]);
        connectWebSocket(newMode);
      }
    },
    [closePeerConnection, connectWebSocket]
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
      if (joinedRef.current && changedRoom && channelModeRef.current === 'private') {
        for (const id of Array.from(pcsRef.current.keys())) {
          closePeerConnection(id);
        }
        setPeers([]);
        connectWebSocket('private');
      }
    },
    [closePeerConnection, connectWebSocket]
  );

  // Sincroniza troca de sala/link automaticamente caso o jogador já esteja ligado na voz privada
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
      mutedPeerIds,
      errorMsg,
      joinVoice,
      leaveVoice,
      toggleMic,
      toggleDeafen,
      switchChannelMode,
      toggleMutePeer,
      updateIdentity,
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
      mutedPeerIds,
      errorMsg,
      joinVoice,
      leaveVoice,
      toggleMic,
      toggleDeafen,
      switchChannelMode,
      toggleMutePeer,
      updateIdentity,
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
