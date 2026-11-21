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
  localMicLevel: number;
  mutedPeerIds: string[];
  errorMsg: string | null;
  noiseGateMode: VoiceNoiseGateMode;
  hasHeadset: boolean;
  selectedMicLabel: string | null;
  setNoiseGateMode: (mode: VoiceNoiseGateMode) => void;
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

export const VoiceChatProvider: React.FC<{
  children: React.ReactNode;
  roomCode: string;
  playerName: string;
  playerAvatar: string;
  hasInviteLink: boolean;
}> = ({ children, roomCode, playerName, playerAvatar }) => {
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
  const [mutedPeerIds, setMutedPeerIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noiseGateMode, setNoiseGateModeState] = useState<VoiceNoiseGateMode>('strict');
  const [hasHeadset, setHasHeadset] = useState<boolean>(false);
  const [selectedMicLabel, setSelectedMicLabel] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    'disconnected' | 'connecting' | 'connected' | 'offline-local'
  >('disconnected');

  const peerIdRef = useRef<string>(getSessionPlayerId());
  const wsRef = useRef<WebSocket | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gateGainRef = useRef<GainNode | null>(null);
  const micMonitorRafRef = useRef<number | null>(null);

  const identityRef = useRef({ roomCode, playerName, playerAvatar });
  const micMutedRef = useRef(isMicMuted);
  const deafenedRef = useRef(isDeafened);
  const channelModeRef = useRef(channelMode);
  const joinedRef = useRef(isJoined);
  const noiseGateModeRef = useRef<VoiceNoiseGateMode>(noiseGateMode);
  const hasHeadsetRef = useRef<boolean>(hasHeadset);
  const anyRemoteSpeakingRef = useRef<boolean>(false);
  const mutedPeersSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    identityRef.current = { roomCode, playerName, playerAvatar };
  }, [roomCode, playerName, playerAvatar]);

  useEffect(() => {
    micMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    deafenedRef.current = isDeafened;
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
    noiseGateModeRef.current = noiseGateMode;
  }, [noiseGateMode]);

  useEffect(() => {
    anyRemoteSpeakingRef.current = peers.some(
      (p) => p.speaking && !p.muted && !mutedPeerIds.includes(p.peerId)
    );
  }, [peers, mutedPeerIds]);

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
  }, []);

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

  const setNoiseGateMode = useCallback((mode: VoiceNoiseGateMode) => {
    noiseGateModeRef.current = mode;
    setNoiseGateModeState(mode);
  }, []);

  const stopAudioPipeline = useCallback(() => {
    if (micMonitorRafRef.current) {
      cancelAnimationFrame(micMonitorRafRef.current);
      micMonitorRafRef.current = null;
    }
    gateGainRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach((tr) => tr.stop());
      processedStreamRef.current = null;
    }
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getTracks().forEach((tr) => tr.stop());
      rawMicStreamRef.current = null;
    }
    setLocalMicLevel(0);
    setIsLocalSpeaking(false);
  }, []);

  const buildProcessedVocalPipeline = useCallback(
    (rawStream: MediaStream): MediaStream => {
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

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) {
          processedStreamRef.current = rawStream;
          return rawStream;
        }

        const ctx = new AudioCtx({ latencyHint: 'interactive' });
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(rawStream);

        // Corta ruídos graves de fundo (vento, ventoinha, trânsito, vibração)
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 120;
        highpass.Q.value = 0.707;

        // Corta chiado agudo, teclas e interferência ambiente acima da faixa vocal
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 3600;
        lowpass.Q.value = 0.707;

        // Realce suave de presença da voz próxima ao microfone
        const presence = ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 1900;
        presence.Q.value = 1.0;
        presence.gain.value = 2.5;

        // Compressor suave para evitar picos e manter volume da voz estável
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 14;
        compressor.ratio.value = 3.5;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.14;

        // Analyser lê apenas a banda vocal já filtrada para não abrir com barulho grave/agudo
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;

        // Noise Gate digital: inicia fechado (0) para não enviar ruído ambiente quando não há voz de perto
        const gateGain = ctx.createGain();
        gateGain.gain.value = 0;
        gateGainRef.current = gateGain;

        const dest = ctx.createMediaStreamDestination();
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(presence);
        presence.connect(analyser);
        presence.connect(compressor);
        compressor.connect(gateGain);
        gateGain.connect(dest);

        processedStreamRef.current = dest.stream;

        const timeBuf = new Float32Array(analyser.fftSize);
        let gateOpen = false;
        let holdUntilMs = 0;
        let lastSpeakingEmit = false;
        let lastEmitTime = 0;
        let lastUiLevelEmit = 0;
        let lastUiLevel = 0;

        const tick = () => {
          if (audioCtxRef.current !== ctx) return;
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }

          analyser.getFloatTimeDomainData(timeBuf);
          let sumSq = 0;
          for (let i = 0; i < timeBuf.length; i++) {
            const sample = timeBuf[i];
            sumSq += sample * sample;
          }
          const rms = Math.sqrt(sumSq / timeBuf.length);
          const nowPerf = performance.now();
          const nowAudio = ctx.currentTime;

          const strict = noiseGateModeRef.current === 'strict';
          // Anti-eco: se não houver auriculares e outro jogador estiver falando nas colunas, exige voz mais forte/próxima
          const speakerEchoGuard =
            !hasHeadsetRef.current && anyRemoteSpeakingRef.current && !deafenedRef.current
              ? 0.024
              : 0;
          const openThreshold = (strict ? 0.032 : 0.017) + speakerEchoGuard;
          const closeThreshold = openThreshold * 0.65;
          const holdDurationMs = strict ? 210 : 300;

          if (micMutedRef.current) {
            gateOpen = false;
            holdUntilMs = 0;
            gateGain.gain.setTargetAtTime(0, nowAudio, 0.01);
            rawStream.getAudioTracks().forEach((tr) => {
              tr.enabled = false;
            });
            dest.stream.getAudioTracks().forEach((tr) => {
              tr.enabled = false;
            });
          } else {
            rawStream.getAudioTracks().forEach((tr) => {
              if (!tr.enabled) tr.enabled = true;
            });
            dest.stream.getAudioTracks().forEach((tr) => {
              if (!tr.enabled) tr.enabled = true;
            });

            if (rms >= openThreshold) {
              gateOpen = true;
              holdUntilMs = nowPerf + holdDurationMs;
            } else if (gateOpen && rms < closeThreshold && nowPerf > holdUntilMs) {
              gateOpen = false;
            }

            const targetGain = gateOpen ? 1.0 : 0.0;
            gateGain.gain.setTargetAtTime(targetGain, nowAudio, gateOpen ? 0.012 : 0.045);
          }

          const visualLevel = micMutedRef.current
            ? 0
            : gateOpen
            ? Math.min(1, Math.max(0.15, rms * 10.5))
            : Math.min(0.22, rms * 4.5);

          if (nowPerf - lastUiLevelEmit > 85 && Math.abs(visualLevel - lastUiLevel) > 0.03) {
            lastUiLevelEmit = nowPerf;
            lastUiLevel = visualLevel;
            setLocalMicLevel(visualLevel);
          }

          const speakingNow = !micMutedRef.current && gateOpen;
          if (speakingNow !== lastSpeakingEmit && nowPerf - lastEmitTime > 160) {
            lastSpeakingEmit = speakingNow;
            lastEmitTime = nowPerf;
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
        return dest.stream;
      } catch {
        processedStreamRef.current = rawStream;
        return rawStream;
      }
    },
    [sendSignal, stopAudioPipeline]
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
      cleanupAllConnections();
    };
  }, [cleanupAllConnections]);

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
      await refreshAudioDevices();
      const processed = buildProcessedVocalPipeline(rawStream);
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
      rawMicStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      for (const pc of pcsRef.current.values()) {
        await attachLocalTrackToPeer(pc);
      }
    } else {
      rawMicStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      processedStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      if (gateGainRef.current && audioCtxRef.current) {
        gateGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01);
      }
    }

    setIsMicMuted(nextMuted);
    micMutedRef.current = nextMuted;
    if (nextMuted) {
      setIsLocalSpeaking(false);
      setLocalMicLevel(0);
    }

    sendSignal({
      type: 'voice:state',
      muted: nextMuted,
      deafened: deafenedRef.current,
      speaking: false,
    });
  }, [acquireMicStream, attachLocalTrackToPeer, joinVoice, sendSignal]);

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
      if (joinedRef.current && changedRoom && channelModeRef.current === 'private') {
        clearAllPeerConnections();
        setPeers([]);
        connectWebSocket('private');
      }
    },
    [clearAllPeerConnections, connectWebSocket]
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
      mutedPeerIds,
      errorMsg,
      noiseGateMode,
      hasHeadset,
      selectedMicLabel,
      setNoiseGateMode,
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
      noiseGateMode,
      hasHeadset,
      selectedMicLabel,
      setNoiseGateMode,
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
