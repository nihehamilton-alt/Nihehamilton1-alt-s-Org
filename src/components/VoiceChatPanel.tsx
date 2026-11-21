import React, { useMemo, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Radio,
  Users,
  Lock,
  Globe,
  ChevronDown,
  ChevronUp,
  Headphones,
  ShieldCheck,
} from 'lucide-react';
import { useVoiceChat } from '../contexts/VoiceChatContext';
import { useI18n } from '../contexts/I18nContext';
import { AvatarDoll } from './AvatarDoll';

interface VoiceChatPanelProps {
  variant: 'lobby' | 'compact';
  roomCode: string;
}

export const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({ variant, roomCode }) => {
  const { t, lang } = useI18n();
  const {
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
    setNoiseGateMode,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    switchChannelMode,
    toggleMutePeer,
  } = useVoiceChat();

  const [expandedPeers, setExpandedPeers] = useState(false);

  const audioUiLabels = useMemo(() => {
    const code = (lang || 'pt').slice(0, 2);
    if (code === 'en') {
      return {
        headsetDetected: 'Headset connected · Near-field voice only',
        headsetAdvice: 'Use earphones for 0 echo · Ambient noise filter active',
        strictModeBtn: 'Near Voice Only',
        balancedModeBtn: 'Balanced',
      };
    }
    if (code === 'es') {
      return {
        headsetDetected: 'Auriculares detectados · Solo voz de cerca',
        headsetAdvice: 'Usa auriculares para 0 eco · Filtro ambiental activo',
        strictModeBtn: 'Solo Voz Cerca',
        balancedModeBtn: 'Normal',
      };
    }
    if (code === 'fr') {
      return {
        headsetDetected: 'Écouteurs détectés · Voix proche uniquement',
        headsetAdvice: 'Utilisez des écouteurs (0 écho) · Filtre bruit actif',
        strictModeBtn: 'Voix Proche',
        balancedModeBtn: 'Normal',
      };
    }
    return {
      headsetDetected: 'Auriculares ligados · Só voz de perto (0 eco)',
      headsetAdvice: 'Use auriculares para captar só voz de perto e evitar eco',
      strictModeBtn: 'Só Voz de Perto',
      balancedModeBtn: 'Normal',
    };
  }, [lang]);

  if (!isSupported) return null;

  const activeSpeaker = peers.find((p) => p.speaking && !p.muted && !mutedPeerIds.includes(p.peerId));
  const totalConnected = (isJoined ? 1 : 0) + peers.length;

  // ============================================================================
  // COMPACT RACE-TRACK BAR (Antes, Durante e Depois da Partida)
  // ============================================================================
  if (variant === 'compact') {
    return (
      <div className="w-full max-w-[500px] mb-2 game-panel rounded-2xl px-3 py-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                !isJoined
                  ? 'bg-zinc-600'
                  : connectionState === 'connected'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            <div className="flex items-center gap-1.5 min-w-0 text-xs font-mono">
              {channelMode === 'private' ? (
                <Lock size={12} className="text-amber-400 shrink-0" />
              ) : (
                <Globe size={12} className="text-sky-400 shrink-0" />
              )}
              <span className="font-bold text-zinc-200 truncate flex items-center gap-1.5">
                {!isJoined ? (
                  t.voice.compactIdleTitle
                ) : activeSpeaker ? (
                  <>
                    <AvatarDoll name={activeSpeaker.name} size={18} variant="bust" />
                    <span className="truncate">{activeSpeaker.name}</span>
                  </>
                ) : isLocalSpeaking ? (
                  t.voice.youSpeaking
                ) : channelMode === 'private' ? (
                  `${t.voice.privateShort} ${roomCode}`
                ) : (
                  `${t.voice.publicShort} (${totalConnected}/5)`
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isJoined ? (
              <>
                <button
                  type="button"
                  onClick={() => joinVoice({ mode: channelMode, withMic: false })}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-xl game-btn-secondary text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  title={t.voice.listenOnlyTip}
                >
                  <Volume2 size={13} className="text-emerald-400" />
                  <span>{t.voice.listenBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => joinVoice({ mode: channelMode, withMic: true })}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-xl game-btn-gold text-[11px] font-black flex items-center gap-1 cursor-pointer"
                  title={t.voice.joinSpeakTip}
                >
                  <Mic size={13} />
                  <span>{t.voice.speakBtn}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`px-2.5 py-1.5 min-h-[34px] rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer border transition-colors ${
                    !isMicMuted
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={isMicMuted ? t.voice.micUnmuteTip : t.voice.micMuteTip}
                >
                  {!isMicMuted ? <Mic size={13} /> : <MicOff size={13} />}
                  <span>{!isMicMuted ? t.voice.micOn : t.voice.micOff}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleDeafen}
                  className={`px-2 py-1.5 min-h-[34px] rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                    isDeafened
                      ? 'bg-rose-950/70 border-rose-500/60 text-rose-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title={isDeafened ? t.voice.unmuteAudioTip : t.voice.muteAudioTip}
                >
                  {isDeafened ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>

                <button
                  type="button"
                  onClick={() => setExpandedPeers((prev) => !prev)}
                  className="px-2 py-1.5 min-h-[34px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                  title={t.voice.peersListTitle}
                >
                  <Users size={12} />
                  <span>{totalConnected}/5</span>
                  {expandedPeers ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                <button
                  type="button"
                  onClick={leaveVoice}
                  className="p-1.5 min-h-[34px] min-w-[34px] rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800 text-rose-300 flex items-center justify-center cursor-pointer"
                  title={t.voice.leaveBtn}
                >
                  <PhoneOff size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Barra expandida discreta (canal privado/público, filtro só voz de perto, auriculares e peers) */}
        {isJoined && expandedPeers && (
          <div className="pt-1.5 border-t border-zinc-800/80 flex flex-col gap-1.5 text-[11px] font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => switchChannelMode('private')}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                    channelMode === 'private'
                      ? 'bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  🔒 {t.voice.privateTab}
                </button>
                <button
                  type="button"
                  onClick={() => switchChannelMode('public')}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                    channelMode === 'public'
                      ? 'bg-sky-500 text-zinc-950 border-sky-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  🌐 {t.voice.publicTab}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNoiseGateMode(noiseGateMode === 'strict' ? 'balanced' : 'strict')}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                  noiseGateMode === 'strict'
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                }`}
              >
                <ShieldCheck size={11} />
                <span>
                  {noiseGateMode === 'strict'
                    ? audioUiLabels.strictModeBtn
                    : audioUiLabels.balancedModeBtn}
                </span>
              </button>
            </div>

            <div
              className={`px-2 py-1 rounded-lg border text-[10px] flex items-center justify-between gap-1.5 ${
                hasHeadset
                  ? 'bg-emerald-950/45 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/35 text-amber-200'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Headphones size={12} className="shrink-0" />
                <span className="truncate">
                  {hasHeadset ? audioUiLabels.headsetDetected : audioUiLabels.headsetAdvice}
                </span>
              </span>
              <span className="text-[9px] text-zinc-500 shrink-0">{activeRoomKey}</span>
            </div>

            {peers.length === 0 ? (
              <span className="text-[10px] text-zinc-400">
                {isOnline ? t.voice.waitingPeers : t.voice.offlineNote}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {peers.map((p) => {
                  const isPeerMuted = mutedPeerIds.includes(p.peerId);
                  return (
                    <button
                      key={p.peerId}
                      type="button"
                      onClick={() => toggleMutePeer(p.peerId)}
                      className={`px-2 py-1 rounded-lg border flex items-center gap-1 text-[10px] cursor-pointer ${
                        isPeerMuted
                          ? 'bg-zinc-900 border-rose-500/40 text-zinc-500 line-through'
                          : p.speaking && !p.muted
                          ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                      }`}
                      title={isPeerMuted ? t.voice.unmutePeerTip : t.voice.mutePeerTip}
                    >
                      <AvatarDoll name={p.name} size={16} variant="bust" />
                      <span className="max-w-[85px] truncate">{p.name}</span>
                      <span>{isPeerMuted || p.muted ? '🔇' : p.speaking ? '🎙️' : '🔊'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {errorMsg && <span className="text-[10px] font-mono text-amber-300">{errorMsg}</span>}
      </div>
    );
  }

  // ============================================================================
  // LOBBY ARENA CARD (Prioridade para Link/QR da Sala + Canal Aleatório)
  // ============================================================================
  return (
    <div className="p-3.5 game-subplate rounded-2xl border-emerald-500/35 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Radio size={15} />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300 block">
              {t.voice.lobbyTitle}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 block">
              {isOnline ? t.voice.lobbyOnlineSub : t.voice.offlineNote}
            </span>
          </div>
        </div>

        {/* Prioridade Sala Link vs Aleatório */}
        <div className="flex items-center gap-1 game-panel rounded-xl p-0.5 text-[10px] font-mono">
          <button
            type="button"
            onClick={() => switchChannelMode('private')}
            className={`px-2 py-1 rounded-lg font-bold cursor-pointer flex items-center gap-1 transition-colors ${
              channelMode === 'private'
                ? 'bg-amber-500 text-zinc-950 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Lock size={11} />
            <span>{t.voice.privateTab}</span>
          </button>
          <button
            type="button"
            onClick={() => switchChannelMode('public')}
            className={`px-2 py-1 rounded-lg font-bold cursor-pointer flex items-center gap-1 transition-colors ${
              channelMode === 'public'
                ? 'bg-sky-500 text-zinc-950 font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe size={11} />
            <span>{t.voice.publicTab}</span>
          </button>
        </div>
      </div>

      {/* Aviso de Auriculares + Filtro Anti-Ruído / Anti-Eco */}
      <div
        className={`px-2.5 py-2 rounded-xl border text-[10px] font-mono flex flex-wrap items-center justify-between gap-2 ${
          hasHeadset
            ? 'bg-emerald-950/45 border-emerald-500/45 text-emerald-200'
            : 'bg-amber-950/35 border-amber-500/35 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Headphones size={14} className="shrink-0" />
          <span className="truncate font-bold">
            {hasHeadset ? audioUiLabels.headsetDetected : audioUiLabels.headsetAdvice}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setNoiseGateMode(noiseGateMode === 'strict' ? 'balanced' : 'strict')}
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
            noiseGateMode === 'strict'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300'
          }`}
        >
          <ShieldCheck size={11} />
          <span>
            {noiseGateMode === 'strict'
              ? audioUiLabels.strictModeBtn
              : audioUiLabels.balancedModeBtn}
          </span>
        </button>
      </div>

      {/* Controlos Principais de Voz (Falar, Desligar Mic para só ouvir, Sair) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {!isJoined ? (
          <>
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => joinVoice({ mode: channelMode, withMic: true })}
              className="col-span-1 sm:col-span-2 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Mic size={14} />
              <span>{isConnecting ? '...' : t.voice.joinSpeakBtn}</span>
            </button>
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => joinVoice({ mode: channelMode, withMic: false })}
              className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              title={t.voice.listenOnlyTip}
            >
              <Volume2 size={14} className="text-amber-400" />
              <span>{t.voice.listenOnlyBtn}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMic}
              className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                !isMicMuted
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-300'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {!isMicMuted ? <Mic size={14} /> : <MicOff size={14} />}
              <span>{!isMicMuted ? t.voice.micActiveBtn : t.voice.micMutedBtn}</span>
            </button>

            <button
              type="button"
              onClick={toggleDeafen}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                isDeafened
                  ? 'bg-rose-950/70 text-rose-300 border-rose-600'
                  : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{isDeafened ? t.voice.audioOffBtn : t.voice.audioOnBtn}</span>
            </button>

            <button
              type="button"
              onClick={leaveVoice}
              className="col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <PhoneOff size={14} />
              <span>{t.voice.leaveBtn}</span>
            </button>
          </>
        )}
      </div>

      {/* Medidor de Nível do Microfone + Lista de Jogadores Ligados na Voz */}
      {isJoined && (
        <div className="flex flex-col gap-2 pt-1.5 border-t border-zinc-800/80">
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
            <span>{!isMicMuted ? '🎙️' : '🔇'}</span>
            <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-emerald-400 transition-all duration-75"
                style={{ width: `${Math.round(localMicLevel * 100)}%` }}
              />
            </div>
            <span className="tabular-nums">{totalConnected}/5</span>
          </div>

          {peers.length === 0 ? (
            <p className="text-[11px] font-mono text-zinc-400">
              {isOnline ? t.voice.waitingPeers : t.voice.offlineNote}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {peers.map((p) => {
                const isPeerMuted = mutedPeerIds.includes(p.peerId);
                return (
                  <div
                    key={p.peerId}
                    className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      p.speaking && !p.muted && !isPeerMuted
                        ? 'bg-emerald-950/50 border-emerald-400/70'
                        : 'bg-zinc-900/90 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AvatarDoll name={p.name} size={22} variant="bust" />
                      <span className="font-bold text-zinc-200 truncate text-[11px]">{p.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMutePeer(p.peerId)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer shrink-0 ${
                        isPeerMuted
                          ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                      title={isPeerMuted ? t.voice.unmutePeerTip : t.voice.mutePeerTip}
                    >
                      {isPeerMuted ? '🔇' : p.muted ? 'Mic Off' : p.speaking ? '🎙️' : '🔊'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {errorMsg && <span className="text-[11px] font-mono text-amber-300">{errorMsg}</span>}
    </div>
  );
};
