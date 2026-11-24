import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { loadServerConfig } from './config/env.ts';

interface MatchRecord {
  id: string;
  timestamp: number;
  syncedAt?: number;
  roomCode: string;
  roomTitle: string;
  betAmount: number;
  playerRank: number;
  distanceMeters: number;
  coinsCollected: number;
  prizeKz: number;
  streak: number;
  synced: boolean;
  deviceId?: string;
  deviceLabel?: string;
  userAgent?: string;
}

interface RoomParticipant {
  id: string;
  name: string;
  avatar: string;
  avatarId: string;
  color: string;
  isHost: boolean;
  joinedAt: number;
  lastSeenAt: number;
  progressDistance: number;
  lane: number;
  targetLane?: number;
  laneX?: number;
  action: string;
  jumpY: number;
  stumbling?: boolean;
  finished?: boolean;
  finishTime?: number;
  profileReady?: boolean;
  selectingProfile?: boolean;
  connected?: boolean;
  betAmount?: number;
  sessionStatus?: 'normal' | 'investigating';
  isSpectating?: boolean;
}

type TelemetryAnomalyReason = 'impossible-speed' | 'lane-switch-flood' | 'position-teleport';
type ServerTelemetryRiskLevel = 'normal' | 'monitor' | 'investigating' | 'high-risk';

interface TelemetryAnomalyLogServer {
  id: string;
  roomCode: string;
  raceRound: number;
  reporterId: string;
  competitorId: string;
  competitorName: string;
  reason: TelemetryAnomalyReason;
  detectedAt: number;
  receivedAt: number;
  progressDistance: number;
  lane: number;
  targetLane: number;
  laneX: number;
  peakSpeedMps?: number;
  switchesPerSec?: number;
}

interface ServerParticipantAnomalySummary {
  competitorId: string;
  competitorName: string;
  roomCode: string;
  totalAnomalies: number;
  reasons: Record<TelemetryAnomalyReason, number>;
  maxSpeedMps: number;
  maxSwitchesPerSec: number;
  suspicionScore: number;
  riskLevel: ServerTelemetryRiskLevel;
  firstDetectedAt: number;
  lastDetectedAt: number;
}

interface RoomStandingEntryServer {
  id: string;
  name: string;
  avatar: string;
  avatarId: string;
  color: string;
  isBot: boolean;
  lane: number;
  progressDistance: number;
  rank: number;
  betAmount: number;
  payoutKz: number;
}

interface ServerRoom {
  code: string;
  title: string;
  hostName: string;
  hostId?: string;
  creatorId?: string;
  maxPlayers: number;
  betAmount: number;
  fillWithBots: boolean;
  isDemo: boolean;
  accessMode: 'random' | 'invite-only';
  createdAt: number;
  updatedAt: number;
  raceStatus: 'idle' | 'starting' | 'running' | 'completed';
  raceRound: number;
  raceStartAt: number | null;
  syncedRaceStartAt?: number | null;
  raceSeed?: number;
  pendingStart?: boolean;
  participants: RoomParticipant[];
  kickedIds: string[];
  lastResults?: {
    raceRound: number;
    betAmount: number;
    finishedAt: number;
    rankings: RoomStandingEntryServer[];
  };
}

interface ServerDatabase {
  matches: MatchRecord[];
  rooms: Record<string, ServerRoom>;
}

const config = loadServerConfig();
const PORT = config.port;
const DATA_DIR = config.dataDir;
const DB_FILE = config.dbFile;

function ensureDb(): ServerDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial: ServerDatabase = { matches: [], rooms: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ServerDatabase>;
    return {
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      rooms: parsed.rooms && typeof parsed.rooms === 'object' ? parsed.rooms : {},
    };
  } catch (err) {
    console.error('Erro ao ler base de dados local:', err);
    return { matches: [], rooms: {} };
  }
}

function saveDb(db: ServerDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao gravar base de dados local:', err);
  }
}

// Limpeza de participantes inativos (nunca remove o criador da sala enquanto troca para WhatsApp/Instagram)
function pruneRoomParticipants(room: ServerRoom): void {
  const now = Date.now();
  const disconnectedCutoff = now - 45_000;
  const creatorDisconnectedCutoff = now - 30 * 60 * 1000;
  const idleCutoff = now - 15 * 60 * 1000;
  room.participants = room.participants.filter((p) => {
    const isCreatorOrLockedHost =
      (room.creatorId && p.id === room.creatorId) || (!room.creatorId && p.id === room.hostId && room.accessMode === 'invite-only');
    if (p.connected === false) {
      return isCreatorOrLockedHost
        ? p.lastSeenAt >= creatorDisconnectedCutoff
        : p.lastSeenAt >= disconnectedCutoff;
    }
    return isCreatorOrLockedHost || p.isHost || p.lastSeenAt >= idleCutoff;
  });
}

const VALID_RACE_ACTIONS = new Set(['running', 'jumping', 'sliding', 'dashing', 'stumbling']);
const VALID_RACE_STATUSES = new Set(['idle', 'starting', 'running', 'completed']);

function sanitizeRoomCode(raw: unknown, fallbackPrefix = 'ARENA'): string {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 32);
  return cleaned || `${fallbackPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function sanitizeText(raw: unknown, fallback: string, maxLen = 48): string {
  const cleaned = typeof raw === 'string' ? raw.trim().slice(0, maxLen) : '';
  return cleaned || fallback;
}

function pruneStaleRooms(db: ServerDatabase): number {
  const now = Date.now();
  const STALE_EMPTY_ROOM_MS = 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [code, room] of Object.entries(db.rooms)) {
    if (code === 'HAMILTON-REI') continue;
    pruneRoomParticipants(room);
    if (room.participants.length === 0 && now - (room.updatedAt || room.createdAt || 0) > STALE_EMPTY_ROOM_MS) {
      delete db.rooms[code];
      removed++;
    }
  }
  return removed;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(self)');
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  const db = ensureDb();
  if (pruneStaleRooms(db) > 0) {
    saveDb(db);
  }
  const LANE_ORDER = [2, 1, 3, 0, 4];

  const roomSockets = new Map<string, Set<WebSocket>>();
  const socketToRoomClient = new Map<WebSocket, { roomCode: string; playerId: string }>();
  const lastPublicOpponents = new Map<string, Set<string>>();
  const recentPublicOpponents = new Map<string, string[]>();
  const roomFinishControl = new Map<
    string,
    {
      raceRound: number;
      timer: ReturnType<typeof setTimeout> | null;
      bots: Array<{
        id: string;
        name: string;
        avatar: string;
        avatarId: string;
        color: string;
        lane: number;
        progressDistance: number;
      }>;
    }
  >();
  const roomStartControl = new Map<
    string,
    { raceRound: number; timer: ReturnType<typeof setTimeout> | null }
  >();
  const SYNC_COUNTDOWN_LEAD_MS = 3400;

  const MAX_TELEMETRY_LOGS = 2000;
  const MAX_ANALYSES_COUNT = 500;
  const telemetryAnomalyLogs: TelemetryAnomalyLogServer[] = [];
  const seenAnomalyLogIds = new Set<string>();
  const participantTelemetryAnalyses = new Map<string, ServerParticipantAnomalySummary>();

  const VALID_ANOMALY_REASONS = new Set<TelemetryAnomalyReason>([
    'impossible-speed',
    'lane-switch-flood',
    'position-teleport',
  ]);

  const computeServerSuspicionScore = (summary: ServerParticipantAnomalySummary): number => {
    const weightedReasons =
      summary.reasons['position-teleport'] * 35 +
      summary.reasons['impossible-speed'] * 25 +
      summary.reasons['lane-switch-flood'] * 18;
    const distinctReasonCount = (Object.values(summary.reasons) as number[]).filter((c) => c > 0).length;
    const repeatBonus = Math.min(45, Math.max(0, summary.totalAnomalies - 1) * 10);
    const speedBonus = summary.maxSpeedMps > 68 ? 20 : summary.maxSpeedMps > 45 ? 10 : 0;
    const varietyBonus = distinctReasonCount >= 2 ? 15 : 0;
    return Math.min(100, Math.max(weightedReasons, 15) + repeatBonus + speedBonus + varietyBonus);
  };

  const resolveRiskLevel = (
    suspicionScore: number,
    totalAnomalies: number
  ): ServerTelemetryRiskLevel => {
    if (suspicionScore >= 70 || totalAnomalies >= 4) return 'high-risk';
    if (suspicionScore >= 25 || totalAnomalies >= 1) return 'investigating';
    return 'monitor';
  };

  const sanitizeTelemetryLog = (
    raw: unknown,
    fallbackRoomCode: string,
    fallbackRaceRound: number,
    fallbackReporterId: string,
    receivedAt: number
  ): TelemetryAnomalyLogServer | null => {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;

    const competitorId =
      typeof item.competitorId === 'string' ? item.competitorId.trim().slice(0, 64) : '';
    const reason =
      typeof item.reason === 'string' && VALID_ANOMALY_REASONS.has(item.reason as TelemetryAnomalyReason)
        ? (item.reason as TelemetryAnomalyReason)
        : null;
    if (!competitorId || !reason) return null;

    const roomCode = (
      typeof item.roomCode === 'string' && item.roomCode.trim()
        ? item.roomCode
        : fallbackRoomCode
    )
      .trim()
      .toUpperCase()
      .slice(0, 32);
    const reporterId = (
      typeof item.reporterId === 'string' && item.reporterId.trim()
        ? item.reporterId
        : fallbackReporterId
    )
      .trim()
      .slice(0, 64);
    const competitorName = (
      typeof item.competitorName === 'string' && item.competitorName.trim()
        ? item.competitorName
        : competitorId
    )
      .trim()
      .slice(0, 40);

    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 96)
        : `anom-${receivedAt}-${competitorId}-${Math.random().toString(36).slice(2, 7)}`;

    const raceRound =
      typeof item.raceRound === 'number' && Number.isFinite(item.raceRound)
        ? Math.max(0, Math.round(item.raceRound))
        : fallbackRaceRound;
    const detectedAt =
      typeof item.detectedAt === 'number' && Number.isFinite(item.detectedAt)
        ? Math.min(receivedAt + 5000, Math.max(0, item.detectedAt))
        : receivedAt;
    const progressDistance =
      typeof item.progressDistance === 'number' && Number.isFinite(item.progressDistance)
        ? Number(Math.max(-1000, Math.min(100000, item.progressDistance)).toFixed(2))
        : 0;
    const lane =
      typeof item.lane === 'number' && Number.isFinite(item.lane)
        ? Math.max(0, Math.min(4, Math.round(item.lane)))
        : 0;
    const targetLane =
      typeof item.targetLane === 'number' && Number.isFinite(item.targetLane)
        ? Math.max(0, Math.min(4, Math.round(item.targetLane)))
        : lane;
    const laneX =
      typeof item.laneX === 'number' && Number.isFinite(item.laneX)
        ? Number(Math.max(-2000, Math.min(4000, item.laneX)).toFixed(2))
        : 0;
    const peakSpeedMps =
      typeof item.peakSpeedMps === 'number' && Number.isFinite(item.peakSpeedMps)
        ? Number(Math.max(0, Math.min(5000, item.peakSpeedMps)).toFixed(1))
        : undefined;
    const switchesPerSec =
      typeof item.switchesPerSec === 'number' && Number.isFinite(item.switchesPerSec)
        ? Math.max(0, Math.min(500, Math.round(item.switchesPerSec)))
        : undefined;

    return {
      id,
      roomCode: roomCode || 'UNKNOWN',
      raceRound,
      reporterId: reporterId || 'anonymous',
      competitorId,
      competitorName,
      reason,
      detectedAt,
      receivedAt,
      progressDistance,
      lane,
      targetLane,
      laneX,
      peakSpeedMps,
      switchesPerSec,
    };
  };

  const sendRoomWs = (ws: WebSocket, payload: unknown) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const broadcastToRoom = (code: string, payload: unknown, excludeWs?: WebSocket) => {
    const sockets = roomSockets.get(code);
    if (!sockets) return;
    for (const clientWs of sockets) {
      if (excludeWs && clientWs === excludeWs) continue;
      sendRoomWs(clientWs, payload);
    }
  };

  const resolveRoomHostAndLanes = (room: ServerRoom) => {
    // Regra estrita: quem criou a sala (creatorId) é o único e exclusivo líder.
    // Mesmo se minimizar o browser para enviar o link no WhatsApp/Instagram, nenhum convidado assume a liderança.
    if (room.creatorId) {
      room.hostId = room.creatorId;
    }

    if (room.participants.length === 0) return;

    if (!room.creatorId) {
      const currentHost = room.hostId
        ? room.participants.find((p) => p.id === room.hostId)
        : undefined;
      const hasConnectedOther = room.participants.some((p) => p.connected !== false);
      if (!currentHost || (room.accessMode === 'random' && currentHost.connected === false && hasConnectedOther)) {
        const connectedPreferred = room.participants.find((p) => p.connected !== false);
        const existingFlagHost = room.participants.find((p) => p.isHost);
        room.hostId = connectedPreferred
          ? connectedPreferred.id
          : existingFlagHost
          ? existingFlagHost.id
          : room.participants[0].id;
      }
    }

    const effectiveLeaderId = room.creatorId || room.hostId;
    room.hostId = effectiveLeaderId;

    room.participants.forEach((p) => {
      p.isHost = Boolean(effectiveLeaderId && p.id === effectiveLeaderId);
      if (typeof p.profileReady !== 'boolean') {
        p.profileReady = true;
      }
      if (typeof p.selectingProfile !== 'boolean') {
        p.selectingProfile = !p.profileReady;
      }
      p.betAmount = clampRoomBet(p.betAmount, room.betAmount || 500);
    });
    const hostParticipant = room.participants.find((p) => p.isHost);
    if (hostParticipant) {
      room.hostName = hostParticipant.name || room.hostName;
    }
    // Host gets lane 2 (center), guests get [1, 3, 0, 4]
    const ordered = [
      ...room.participants.filter((p) => p.isHost),
      ...room.participants.filter((p) => !p.isHost),
    ];
    ordered.forEach((p, idx) => {
      if (room.raceStatus === 'idle' || typeof p.lane !== 'number') {
        p.lane = LANE_ORDER[idx % LANE_ORDER.length];
      }
    });
  };

  const recordPublicMatchOpponents = (room: ServerRoom) => {
    if ((room.accessMode || 'invite-only') !== 'random') return;
    const racers = room.participants.filter((p) => p.isSpectating !== true);
    if (racers.length < 2) return;
    for (const p of racers) {
      const others = racers.filter((o) => o.id !== p.id).map((o) => o.id);
      if (others.length === 0) continue;
      lastPublicOpponents.set(p.id, new Set(others));
      const existingRecent = recentPublicOpponents.get(p.id) || [];
      const updatedRecent = [
        ...others,
        ...existingRecent.filter((id) => !others.includes(id)),
      ].slice(0, 16);
      recentPublicOpponents.set(p.id, updatedRecent);
    }
  };

  const findOrCreatePublicRoom = (
    isDemoMode: boolean,
    playerId: string,
    preferredBet: number,
    hostDisplayName: string,
    excludeRoomCode?: string
  ): ServerRoom => {
    const modeTag = isDemoMode ? 'DEMO' : 'REAL';
    const safeBet = clampRoomBet(preferredBet, 500);
    const excludeClean = excludeRoomCode ? excludeRoomCode.trim().toUpperCase() : '';
    const lastSet = lastPublicOpponents.get(playerId) || new Set<string>();
    const recentList = recentPublicOpponents.get(playerId) || [];

    const candidates = Object.values(db.rooms)
      .filter((r) => {
        pruneRoomParticipants(r);
        if ((r.accessMode || 'invite-only') !== 'random') return false;
        if (Boolean(r.isDemo) !== Boolean(isDemoMode)) return false;
        if (r.raceStatus !== 'idle') return false;
        if (clampRoomBet(r.betAmount, 500) !== safeBet) return false;
        if (excludeClean && r.code === excludeClean) return false;
        if (Array.isArray(r.kickedIds) && r.kickedIds.includes(playerId)) return false;
        if (r.participants.some((p) => p.id === playerId)) return false;
        if (r.participants.length >= (r.maxPlayers || 5)) return false;
        const connectedOthers = r.participants.filter((p) => p.connected !== false);
        const hasLastRepeat = connectedOthers.some((p) => lastSet.has(p.id));
        if (hasLastRepeat) return false;
        return true;
      })
      .map((r) => {
        const connectedOthers = r.participants.filter((p) => p.connected !== false);
        const recentOverlap = connectedOthers.filter((p) => recentList.includes(p.id)).length;
        return {
          room: r,
          recentOverlap,
          connectedCount: connectedOthers.length,
          jitter: Math.random(),
        };
      })
      .sort((a, b) => {
        if (a.recentOverlap !== b.recentOverlap) return a.recentOverlap - b.recentOverlap;
        const aHasHumans = a.connectedCount > 0 ? 1 : 0;
        const bHasHumans = b.connectedCount > 0 ? 1 : 0;
        if (aHasHumans !== bHasHumans) return bHasHumans - aHasHumans;
        return a.jitter - b.jitter;
      });

    if (candidates.length > 0) {
      return candidates[0].room;
    }

    let slot = 1;
    let chosenCode = `ARENA-AO-VIVO-${modeTag}-${slot}`;
    while (db.rooms[chosenCode]) {
      const existing = db.rooms[chosenCode];
      pruneRoomParticipants(existing);
      if (
        existing.raceStatus === 'idle' &&
        existing.accessMode === 'random' &&
        Boolean(existing.isDemo) === Boolean(isDemoMode) &&
        existing.code !== excludeClean &&
        existing.participants.length === 0
      ) {
        existing.betAmount = safeBet;
        existing.hostId = playerId;
        existing.hostName = hostDisplayName || 'Anfitrião';
        existing.updatedAt = Date.now();
        return existing;
      }
      slot++;
      chosenCode = `ARENA-AO-VIVO-${modeTag}-${slot}`;
    }

    const now = Date.now();
    const freshRoom: ServerRoom = {
      code: chosenCode,
      title: isDemoMode ? 'Arena Pública ao Vivo (Demo)' : 'Arena Pública ao Vivo (Real)',
      hostName: hostDisplayName || 'Anfitrião',
      hostId: playerId,
      maxPlayers: 5,
      betAmount: safeBet,
      fillWithBots: true,
      isDemo: isDemoMode,
      accessMode: 'random',
      createdAt: now,
      updatedAt: now,
      raceStatus: 'idle',
      raceRound: 1,
      raceStartAt: null,
      syncedRaceStartAt: null,
      participants: [],
      kickedIds: [],
    };
    db.rooms[chosenCode] = freshRoom;
    return freshRoom;
  };

  const getUnreadyParticipants = (room: ServerRoom): RoomParticipant[] => {
    return room.participants.filter(
      (p) => p.connected !== false && (p.profileReady === false || p.selectingProfile === true)
    );
  };

  const calculateThreeTorneirasServer = (betKz: number, playerCount: number) => {
    const safeBet = Math.max(50, Math.min(5_000_000, Math.floor(betKz || 500)));
    const clampedPlayers = Math.max(2, Math.min(5, Math.round(playerCount || 5)));
    const totalPotKz = safeBet * clampedPlayers;
    const winnersPotKz = Math.floor(totalPotKz * 0.7);
    const houseFeeKz = Math.floor(totalPotKz * 0.2);
    const creatorRoyaltyKz = Math.max(0, totalPotKz - winnersPotKz - houseFeeKz);
    const firstPrizeKz = Math.floor(totalPotKz * 0.45);
    const secondPrizeKz = Math.max(0, winnersPotKz - firstPrizeKz);
    return {
      totalPotKz,
      winnersPotKz,
      houseFeeKz,
      creatorRoyaltyKz,
      firstPrizeKz,
      secondPrizeKz,
      thirdPrizeKz: 0,
    };
  };

  const finalizeRoomRace = (room: ServerRoom) => {
    const ctrl = roomFinishControl.get(room.code);
    if (ctrl?.timer) {
      clearTimeout(ctrl.timer);
      ctrl.timer = null;
    }
    const bots = ctrl && ctrl.raceRound === room.raceRound ? ctrl.bots : [];
    roomFinishControl.delete(room.code);

    const activeHumanEntries: RoomStandingEntryServer[] = room.participants
      .filter((p) => p.isSpectating !== true)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        avatarId: p.avatarId,
        color: p.color,
        isBot: false,
        lane: typeof p.lane === 'number' ? p.lane : 2,
        progressDistance: Number(p.progressDistance) || 0,
        rank: 1,
        betAmount: room.betAmount,
        payoutKz: 0,
      }));

    const botEntries: RoomStandingEntryServer[] = bots
      .filter((b) => !activeHumanEntries.some((h) => h.id === b.id))
      .slice(0, Math.max(0, (room.maxPlayers || 5) - activeHumanEntries.length))
      .map((b) => ({
        id: b.id,
        name: b.name,
        avatar: b.avatar,
        avatarId: b.avatarId,
        color: b.color,
        isBot: true,
        lane: typeof b.lane === 'number' ? b.lane : 0,
        progressDistance: Number(b.progressDistance) || 0,
        rank: 1,
        betAmount: room.betAmount,
        payoutKz: 0,
      }));

    const combined = [...activeHumanEntries, ...botEntries].sort((a, b) => {
      const diff = b.progressDistance - a.progressDistance;
      if (Math.abs(diff) > 0.0001) return diff;
      if (!a.isBot && b.isBot) return -1;
      if (a.isBot && !b.isBot) return 1;
      return a.lane - b.lane;
    });

    const threeTorneiras = calculateThreeTorneirasServer(room.betAmount, combined.length);
    const rankings = combined.map((entry, idx) => {
      const rank = idx + 1;
      const payoutKz =
        rank === 1 ? threeTorneiras.firstPrizeKz : rank === 2 ? threeTorneiras.secondPrizeKz : 0;
      return {
        ...entry,
        rank,
        betAmount: room.betAmount,
        payoutKz,
      };
    });

    room.raceStatus = 'completed';
    room.pendingStart = false;
    room.updatedAt = Date.now();
    recordPublicMatchOpponents(room);
    room.participants.forEach((p) => {
      p.isSpectating = false;
    });
    room.lastResults = {
      raceRound: room.raceRound,
      betAmount: room.betAmount,
      finishedAt: room.updatedAt,
      rankings,
    };
    saveDb(db);

    broadcastToRoom(room.code, {
      type: 'room:race-finished',
      roomCode: room.code,
      raceRound: room.raceRound,
      betAmount: room.betAmount,
      rankings,
      threeTorneiras,
      room,
      serverTime: Date.now(),
    });
  };

  const triggerSynchronizedRaceStart = (room: ServerRoom): { started: boolean; waitingParticipants: RoomParticipant[] } => {
    resolveRoomHostAndLanes(room);
    if (
      room.raceStatus === 'starting' &&
      typeof room.syncedRaceStartAt === 'number' &&
      room.syncedRaceStartAt > Date.now() - 500
    ) {
      broadcastToRoom(room.code, {
        type: 'room:race-start',
        room,
        raceRound: room.raceRound,
        raceSeed: room.raceSeed,
        raceStartAt: room.syncedRaceStartAt,
        syncedRaceStartAt: room.syncedRaceStartAt,
        betAmount: room.betAmount,
        serverTime: Date.now(),
      });
      return { started: true, waitingParticipants: [] };
    }
    if (room.raceStatus === 'running') {
      const raceElapsedExpired =
        typeof room.syncedRaceStartAt === 'number' &&
        Date.now() > room.syncedRaceStartAt + 44_000;
      if (!raceElapsedExpired) {
        return { started: true, waitingParticipants: [] };
      }
      finalizeRoomRace(room);
    }

    const connectedParticipants = room.participants.filter((p) => p.connected !== false);
    const unready = getUnreadyParticipants(room);
    if (connectedParticipants.length === 0 || unready.length > 0) {
      room.pendingStart = true;
      room.syncedRaceStartAt = null;
      room.updatedAt = Date.now();
      saveDb(db);
      broadcastToRoom(room.code, {
        type: 'room:waiting-opponent',
        room,
        waitingNames: unready.map((u) => u.name),
        serverTime: Date.now(),
      });
      broadcastToRoom(room.code, {
        type: 'room:state',
        room,
        serverTime: Date.now(),
      });
      return { started: false, waitingParticipants: unready };
    }

    const prevCtrl = roomFinishControl.get(room.code);
    if (prevCtrl?.timer) clearTimeout(prevCtrl.timer);
    roomFinishControl.delete(room.code);

    const prevStartCtrl = roomStartControl.get(room.code);
    if (prevStartCtrl?.timer) clearTimeout(prevStartCtrl.timer);
    roomStartControl.delete(room.code);

    const now = Date.now();
    const syncedStartAt = now + SYNC_COUNTDOWN_LEAD_MS;
    room.pendingStart = false;
    room.raceStatus = 'starting';
    room.raceRound = (room.raceRound || 1) + 1;
    room.raceSeed = Math.floor(1 + Math.random() * 2_000_000_000);
    room.syncedRaceStartAt = syncedStartAt;
    room.raceStartAt = syncedStartAt;
    room.lastResults = undefined;
    room.updatedAt = now;

    const ordered = [
      ...room.participants.filter((p) => p.isHost),
      ...room.participants.filter((p) => !p.isHost),
    ];
    ordered.forEach((p, idx) => {
      p.progressDistance = 0;
      p.lane = LANE_ORDER[idx % LANE_ORDER.length];
      p.targetLane = p.lane;
      p.laneX = undefined;
      p.action = 'running';
      p.jumpY = 0;
      p.stumbling = false;
      p.finished = false;
      p.finishTime = undefined;
      p.isSpectating = false;
      p.lastSeenAt = now;
    });

    const scheduledRound = room.raceRound;
    const goTimer = setTimeout(() => {
      roomStartControl.delete(room.code);
      const latestRoom = db.rooms[room.code];
      if (!latestRoom || latestRoom.raceRound !== scheduledRound || latestRoom.raceStatus !== 'starting') {
        return;
      }
      const goNow = Date.now();
      latestRoom.raceStatus = 'running';
      latestRoom.updatedAt = goNow;
      saveDb(db);
      broadcastToRoom(latestRoom.code, {
        type: 'room:race-go',
        roomCode: latestRoom.code,
        raceRound: latestRoom.raceRound,
        syncedRaceStartAt: latestRoom.syncedRaceStartAt,
        room: latestRoom,
        serverTime: goNow,
      });
    }, SYNC_COUNTDOWN_LEAD_MS);
    roomStartControl.set(room.code, { raceRound: scheduledRound, timer: goTimer });

    saveDb(db);
    broadcastToRoom(room.code, {
      type: 'room:race-start',
      room,
      raceRound: room.raceRound,
      raceSeed: room.raceSeed,
      raceStartAt: syncedStartAt,
      syncedRaceStartAt: syncedStartAt,
      betAmount: room.betAmount,
      serverTime: now,
    });
    return { started: true, waitingParticipants: [] };
  };

  // Healthcheck do servidor
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      serverTime: Date.now(),
      storedMatches: db.matches.length,
      activeRooms: Object.keys(db.rooms).length,
      aiConfigured: config.isAiConfigured,
    });
  });

  // ============================================================================
  // 0. INTEGRAÇÃO GEMINI AI (COACH TÁTICO DO REI RUN — SERVER-SIDE)
  // ============================================================================
  app.post('/api/ai/coach', async (req: Request, res: Response) => {
    try {
      const apiKey = config.geminiApiKey;
      if (!apiKey) {
        res.status(503).json({
          ok: false,
          code: 'MISSING_API_KEY',
          error:
            'A chave GEMINI_API_KEY não está configurada no ambiente do servidor. Configure-a para ativar o Coach IA.',
        });
        return;
      }

      const body = (req.body || {}) as {
        lang?: string;
        playerName?: string;
        avatarName?: string;
        question?: string;
        userRank?: number;
        mode?: 'post-race' | 'tactical';
        performance?: {
          avgReactionTimeMs?: number | null;
          bestReactionTimeMs?: number | null;
          dodgeAccuracyPct?: number;
          jumpAccuracyPct?: number;
          evadedCount?: number;
          hitCount?: number;
          totalFaced?: number;
        } | null;
      };

      const targetLang =
        body.lang === 'en'
          ? 'English'
          : body.lang?.startsWith('es')
          ? 'Spanish'
          : body.lang === 'fr'
          ? 'French'
          : 'Portuguese (Angolan/Lusophone tone)';

      const ai = new GoogleGenAI({ apiKey });

      const perfSummary = body.performance
        ? [
            `Posição obtida: #${body.userRank || 1} de 5`,
            `Tempo médio de reação: ${body.performance.avgReactionTimeMs ?? 'N/A'} ms`,
            `Melhor reflexo: ${body.performance.bestReactionTimeMs ?? 'N/A'} ms`,
            `Precisão de desvios: ${body.performance.dodgeAccuracyPct ?? 100}%`,
            `Precisão em saltos/manobras: ${body.performance.jumpAccuracyPct ?? 100}%`,
            `Obstáculos desviados: ${body.performance.evadedCount ?? 0} | Impactos: ${body.performance.hitCount ?? 0}`,
          ].join('\n')
        : 'Sem métricas de corrida ainda (consulta pré-corrida no lobby).';

      const prompt = [
        `Jogador: ${body.playerName || 'Corredor'} | Personagem: ${body.avatarName || 'Rei Zero'}`,
        `Idioma de resposta obrigatório: ${targetLang}`,
        `Modo: ${body.mode || 'tactical'}`,
        `Dados da corrida na Marginal de Luanda (5 faixas, 40s, Dash a cada 4s, salto passa a maioria dos obstáculos baixos/buracos/fios, apenas barreiras e autocarros exigem troca de faixa):`,
        perfSummary,
        body.question?.trim()
          ? `Pergunta do jogador: "${body.question.trim().slice(0, 400)}"`
          : 'Dá uma análise tática direta em 3 pontos curtos (reflexo, uso do Dash de 4s e leitura das 5 faixas) para vencer a próxima corrida.',
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Você é o Coach Oficial do REI RUN (corrida de destreza de 40s em 5 faixas na Marginal de Luanda). Responda de forma objetiva, prática, energética e curta (máximo 110 palavras, com tópicos claros), focando apenas em técnica de jogo real (reação, salto/agachamento, troca de faixa para barreiras/autocarros e Dash a cada 4s). Nunca invente resultados financeiros garantidos.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const advice = response.text?.trim();
      if (!advice) {
        res.status(502).json({
          ok: false,
          error: 'O modelo Gemini não devolveu texto de resposta.',
        });
        return;
      }

      res.json({
        ok: true,
        advice,
        model: 'gemini-4-hydrogen',
      });
    } catch (err) {
      console.error('Erro no endpoint /api/ai/coach:', err);
      const message =
        err instanceof Error ? err.message : 'Erro inesperado ao consultar o Coach IA.';
      res.status(502).json({ ok: false, error: message });
    }
  });

  // ============================================================================
  // 1. SINCRONIZAÇÃO DE PARTIDAS OFFLINE -> SERVIDOR
  // ============================================================================
  app.post('/api/matches/sync', (req: Request, res: Response) => {
    try {
      const body = req.body as { records?: MatchRecord[]; record?: MatchRecord };
      const incoming: MatchRecord[] = Array.isArray(body.records)
        ? body.records
        : body.record
        ? [body.record]
        : [];

      if (incoming.length === 0) {
        res.status(400).json({ ok: false, error: 'Nenhum registo enviado.' });
        return;
      }

      if (incoming.length > 200) {
        res.status(400).json({ ok: false, error: 'Lote excede o limite máximo de 200 registos.' });
        return;
      }

      const existingIds = new Set(db.matches.map((m) => m.id));
      const syncedIds: string[] = [];
      const now = Date.now();

      for (const rec of incoming) {
        if (!rec || typeof rec !== 'object' || typeof rec.id !== 'string') continue;
        const cleanId = rec.id.trim().slice(0, 96);
        if (!cleanId) continue;
        syncedIds.push(cleanId);
        if (!existingIds.has(cleanId)) {
          const safeTs =
            typeof rec.timestamp === 'number' && Number.isFinite(rec.timestamp)
              ? Math.max(0, Math.min(now + 60_000, Math.round(rec.timestamp)))
              : now;
          const cleanMatch: MatchRecord = {
            id: cleanId,
            timestamp: safeTs,
            syncedAt: now,
            roomCode: sanitizeRoomCode(rec.roomCode, 'SOLO'),
            roomTitle: sanitizeText(rec.roomTitle, 'Arena Rei Run', 64),
            betAmount: clampRoomBet(rec.betAmount, 500),
            playerRank:
              typeof rec.playerRank === 'number' && Number.isFinite(rec.playerRank)
                ? Math.max(1, Math.min(5, Math.round(rec.playerRank)))
                : 5,
            distanceMeters:
              typeof rec.distanceMeters === 'number' && Number.isFinite(rec.distanceMeters)
                ? Math.max(0, Math.min(100_000, Math.round(rec.distanceMeters)))
                : 0,
            coinsCollected:
              typeof rec.coinsCollected === 'number' && Number.isFinite(rec.coinsCollected)
                ? Math.max(0, Math.min(10_000, Math.round(rec.coinsCollected)))
                : 0,
            prizeKz:
              typeof rec.prizeKz === 'number' && Number.isFinite(rec.prizeKz)
                ? Math.max(0, Math.min(50_000_000, Math.round(rec.prizeKz)))
                : 0,
            streak:
              typeof rec.streak === 'number' && Number.isFinite(rec.streak)
                ? Math.max(0, Math.min(10_000, Math.round(rec.streak)))
                : 0,
            synced: true,
            deviceId: typeof rec.deviceId === 'string' ? rec.deviceId.trim().slice(0, 64) : undefined,
            deviceLabel:
              typeof rec.deviceLabel === 'string' ? rec.deviceLabel.trim().slice(0, 48) : undefined,
          };
          db.matches.unshift(cleanMatch);
          existingIds.add(cleanId);
        }
      }

      // Mantém os últimos 1000 registos ordenados por data
      db.matches.sort((a, b) => b.timestamp - a.timestamp);
      if (db.matches.length > 1000) {
        db.matches = db.matches.slice(0, 1000);
      }

      saveDb(db);
      res.json({
        ok: true,
        syncedIds,
        totalStored: db.matches.length,
        serverTime: now,
      });
    } catch (err) {
      console.error('Erro em /api/matches/sync:', err);
      res.status(500).json({ ok: false, error: 'Falha ao gravar registos no servidor.' });
    }
  });

  app.get('/api/matches', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      total: db.matches.length,
      matches: db.matches.slice(0, 150),
    });
  });

  // ============================================================================
  // 2. SALAS PRIVADAS & ARENA DOS AMIGOS (MULTIJOGADOR EM TEMPO REAL)
  // ============================================================================
  const MIN_BET_KZ = 50;
  const MAX_BET_KZ = 5_000_000;

  const clampRoomBet = (val: unknown, fallback = 500): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(MIN_BET_KZ, Math.min(MAX_BET_KZ, Math.round(n)));
  };

  const clampMaxPlayers = (val: unknown, fallback = 5): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(2, Math.min(5, Math.round(n)));
  };

  const normalizeAccessMode = (val: unknown): 'random' | 'invite-only' => {
    return val === 'random' ? 'random' : 'invite-only';
  };

  const isLeaderOfRoom = (room: ServerRoom, playerId: string | undefined): boolean => {
    if (!playerId) return false;
    const leaderId = room.creatorId || room.hostId;
    if (!leaderId) return false;
    return leaderId === playerId;
  };

  app.post('/api/rooms', (req: Request, res: Response) => {
    const body = req.body as {
      code?: string;
      title?: string;
      hostName?: string;
      creatorId?: string;
      requesterId?: string;
      maxPlayers?: number;
      betAmount?: number;
      fillWithBots?: boolean;
      isDemo?: boolean;
      accessMode?: 'random' | 'invite-only';
      player?: Partial<RoomParticipant>;
    };

    const code = sanitizeRoomCode(body.code, 'ARENA');
    const now = Date.now();
    const requestedMax = clampMaxPlayers(body.maxPlayers, 5);
    const callerId = (body.creatorId || body.requesterId || body.player?.id || '').trim().slice(0, 64) || undefined;

    let room = db.rooms[code];
    if (!room) {
      room = {
        code,
        title: sanitizeText(body.title, 'Arena do Hamilton', 64),
        hostName: sanitizeText(body.hostName || body.player?.name, 'Hamilton O Zero', 40),
        hostId: callerId,
        creatorId: callerId,
        maxPlayers: requestedMax,
        betAmount: clampRoomBet(body.betAmount, 500),
        fillWithBots: body.fillWithBots ?? false,
        isDemo: body.isDemo ?? true,
        accessMode: normalizeAccessMode(body.accessMode),
        createdAt: now,
        updatedAt: now,
        raceStatus: 'idle',
        raceRound: 1,
        raceStartAt: null,
        syncedRaceStartAt: null,
        participants: [],
        kickedIds: [],
      };
      db.rooms[code] = room;
    } else {
      const canMutateConfig =
        (!room.creatorId && !room.hostId) || isLeaderOfRoom(room, callerId);
      if (canMutateConfig) {
        if (!room.creatorId && callerId) {
          room.creatorId = callerId;
          room.hostId = callerId;
        }
        if (body.title) room.title = sanitizeText(body.title, room.title, 64);
        if (body.hostName) room.hostName = sanitizeText(body.hostName, room.hostName, 40);
        if (typeof body.maxPlayers === 'number') {
          room.maxPlayers = clampMaxPlayers(body.maxPlayers, room.maxPlayers || 5);
        }
        if (typeof body.betAmount === 'number') {
          room.betAmount = clampRoomBet(body.betAmount, room.betAmount || 500);
        }
        if (typeof body.fillWithBots === 'boolean') room.fillWithBots = body.fillWithBots;
        if (body.accessMode === 'random' || body.accessMode === 'invite-only') {
          room.accessMode = body.accessMode;
        } else if (!room.accessMode) {
          room.accessMode = 'invite-only';
        }
      }
      if (!Array.isArray(room.kickedIds)) room.kickedIds = [];
      if (!room.maxPlayers) room.maxPlayers = 5;
      room.updatedAt = now;
    }

    if (body.player && body.player.id) {
      const pid = body.player.id.trim();
      const idx = room.participants.findIndex((p) => p.id === pid);
      if (!room.creatorId && !room.hostId) {
        room.creatorId = pid;
        room.hostId = pid;
      }
      const participant: RoomParticipant = {
        id: pid.slice(0, 64),
        name: sanitizeText(body.player.name, room.hostName, 40),
        avatar: sanitizeText(body.player.avatar, '👑', 8),
        avatarId: sanitizeText(body.player.avatarId, 'rei-zero', 32),
        color: sanitizeText(body.player.color, '#f59e0b', 24),
        isHost: (room.creatorId || room.hostId) === pid,
        joinedAt: idx >= 0 ? room.participants[idx].joinedAt : now,
        lastSeenAt: now,
        progressDistance: idx >= 0 ? room.participants[idx].progressDistance : 0,
        lane: idx >= 0 ? room.participants[idx].lane : 2,
        action: 'running',
        jumpY: 0,
        profileReady: true,
        selectingProfile: false,
      };
      if (idx >= 0) room.participants[idx] = { ...room.participants[idx], ...participant };
      else if (room.participants.length < room.maxPlayers) room.participants.push(participant);
    }

    pruneRoomParticipants(room);
    resolveRoomHostAndLanes(room);
    if (room.participants.length > room.maxPlayers) {
      const hosts = room.participants.filter((p) => p.isHost);
      const guests = room.participants.filter((p) => !p.isHost);
      room.participants = [...hosts, ...guests].slice(0, room.maxPlayers);
    }
    saveDb(db);
    broadcastToRoom(code, { type: 'room:state', room, serverTime: Date.now() });
    res.json({ ok: true, room });
  });

  // Descoberta de sala aberta aleatória (declarada ANTES de /api/rooms/:code)
  app.get('/api/rooms/open/random', (req: Request, res: Response) => {
    const playerId = String(req.query.playerId || '').trim();
    const hasBetFilter = req.query.betAmount !== undefined && Number.isFinite(Number(req.query.betAmount));
    const targetBet = hasBetFilter ? clampRoomBet(Number(req.query.betAmount), 500) : null;
    const hasDemoFilter = req.query.isDemo !== undefined;
    const targetDemo = req.query.isDemo === '1' || req.query.isDemo === 'true';
    const excludeRoom = String(req.query.excludeRoom || '').trim().toUpperCase();
    const lastSet = playerId ? lastPublicOpponents.get(playerId) || new Set<string>() : new Set<string>();
    const recentList = playerId ? recentPublicOpponents.get(playerId) || [] : [];

    const baseCandidates = Object.values(db.rooms).filter((r) => {
      pruneRoomParticipants(r);
      if ((r.accessMode || 'invite-only') !== 'random') return false;
      if (r.raceStatus !== 'idle') return false;
      if (r.participants.length >= (r.maxPlayers || 5)) return false;
      if (excludeRoom && r.code === excludeRoom) return false;
      if (hasDemoFilter && Boolean(r.isDemo) !== targetDemo) return false;
      if (targetBet !== null && clampRoomBet(r.betAmount, 500) !== targetBet) return false;
      if (playerId && Array.isArray(r.kickedIds) && r.kickedIds.includes(playerId)) return false;
      if (playerId && r.participants.some((p) => p.id === playerId)) return false;
      return true;
    });

    const freshCandidates = baseCandidates.filter(
      (r) => !r.participants.some((p) => lastSet.has(p.id))
    );
    const pool = freshCandidates.length > 0 ? freshCandidates : baseCandidates;

    const sorted = pool
      .map((r) => ({
        room: r,
        recentOverlap: r.participants.filter((p) => recentList.includes(p.id)).length,
        jitter: Math.random(),
      }))
      .sort((a, b) => {
        if (a.recentOverlap !== b.recentOverlap) return a.recentOverlap - b.recentOverlap;
        return a.jitter - b.jitter;
      });

    if (sorted.length === 0) {
      res.status(404).json({ ok: false, error: 'Nenhuma sala aleatória disponível com esse valor de aposta.' });
      return;
    }

    res.json({ ok: true, room: sorted[0].room, serverTime: Date.now() });
  });

  app.get('/api/rooms/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = db.rooms[code];
    if (!room) {
      res.status(404).json({ ok: false, error: 'Sala não encontrada.' });
      return;
    }
    pruneRoomParticipants(room);
    resolveRoomHostAndLanes(room);
    res.json({ ok: true, room, serverTime: Date.now() });
  });

  app.delete('/api/rooms/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = db.rooms[code];
    const body = (req.body || {}) as { requesterId?: string };
    const requesterId = String(body.requesterId || req.query.requesterId || '').trim();

    if (room && (room.creatorId || room.hostId) && !isLeaderOfRoom(room, requesterId)) {
      res.status(403).json({
        ok: false,
        onlyHost: true,
        error: 'Apenas o líder que criou a sala pode eliminá-la.',
      });
      return;
    }

    const existed = Boolean(room);
    if (existed) {
      delete db.rooms[code];
      saveDb(db);
    }

    broadcastToRoom(code, {
      type: 'room:deleted',
      roomCode: code,
      serverTime: Date.now(),
    });

    const privateVoiceKey = `PRIVATE:${code}`;
    const roomVoicePeers = voiceRooms.get(privateVoiceKey);
    if (roomVoicePeers) {
      for (const peer of Array.from(roomVoicePeers.values())) {
        sendWs(peer.ws, {
          type: 'voice:room-deleted',
          roomKey: privateVoiceKey,
        });
        removeVoicePeer(peer.ws);
      }
    }

    res.json({ ok: true, existed, deletedCode: code, serverTime: Date.now() });
  });

  app.post('/api/rooms/:code/join', (req: Request, res: Response) => {
    const code = sanitizeRoomCode(req.params.code, 'ARENA');
    const body = req.body as {
      title?: string;
      hostName?: string;
      maxPlayers?: number;
      betAmount?: number;
      fillWithBots?: boolean;
      isDemo?: boolean;
      accessMode?: 'random' | 'invite-only';
      viaInvite?: boolean;
      player?: Partial<RoomParticipant>;
    };
    const now = Date.now();

    let room = db.rooms[code];
    if (!room) {
      const firstId = body.player?.id?.trim().slice(0, 64);
      room = {
        code,
        title: sanitizeText(body.title, `Arena ${code}`, 64),
        hostName: sanitizeText(body.hostName || body.player?.name, 'Anfitrião', 40),
        hostId: firstId,
        creatorId: body.viaInvite ? undefined : firstId,
        maxPlayers: clampMaxPlayers(body.maxPlayers, 5),
        betAmount: clampRoomBet(body.betAmount, 500),
        fillWithBots: body.fillWithBots ?? false,
        isDemo: body.isDemo ?? true,
        accessMode: normalizeAccessMode(body.accessMode),
        createdAt: now,
        updatedAt: now,
        raceStatus: 'idle',
        raceRound: 1,
        raceStartAt: null,
        syncedRaceStartAt: null,
        participants: [],
        kickedIds: [],
      };
      db.rooms[code] = room;
    }

    if (!room.maxPlayers) room.maxPlayers = 5;
    if (!room.accessMode) room.accessMode = 'invite-only';
    if (!Array.isArray(room.kickedIds)) room.kickedIds = [];
    pruneRoomParticipants(room);

    if (body.player && body.player.id) {
      const pid = body.player.id.trim();
      if (room.kickedIds.includes(pid)) {
        res.status(403).json({
          ok: false,
          kicked: true,
          error: 'Foste removido desta sala pelo líder.',
        });
        return;
      }

      const existingIdx = room.participants.findIndex((p) => p.id === pid);
      if (existingIdx >= 0) {
        const isExistingHost = isLeaderOfRoom(room, pid);
        if (isExistingHost && (body.accessMode === 'random' || body.accessMode === 'invite-only')) {
          room.accessMode = body.accessMode;
        }
        if (isExistingHost && typeof body.betAmount === 'number') {
          room.betAmount = clampRoomBet(body.betAmount, room.betAmount || 500);
        }
        room.participants[existingIdx] = {
          ...room.participants[existingIdx],
          name: body.player.name || room.participants[existingIdx].name,
          avatar: body.player.avatar || room.participants[existingIdx].avatar,
          avatarId: body.player.avatarId || room.participants[existingIdx].avatarId,
          color: body.player.color || room.participants[existingIdx].color,
          lastSeenAt: now,
        };
      } else if (room.accessMode === 'invite-only' && body.viaInvite === false) {
        res.status(403).json({
          ok: false,
          inviteOnly: true,
          error: 'Esta sala está fechada apenas para convidados com link!',
        });
        return;
      } else if (room.participants.length >= room.maxPlayers) {
        res.status(409).json({
          ok: false,
          roomFull: true,
          maxPlayers: room.maxPlayers,
          error: 'Sala cheia! O limite máximo de jogadores foi atingido.',
        });
        return;
      } else {
        const canClaimLeader = !room.creatorId && !room.hostId && room.participants.length === 0;
        if (canClaimLeader) {
          room.hostId = pid;
        }
        room.participants.push({
          id: pid,
          name: body.player.name || `Amigo ${room.participants.length + 1}`,
          avatar: body.player.avatar || '⚡',
          avatarId: body.player.avatarId || 'rei-zero',
          color: body.player.color || '#38bdf8',
          isHost: (room.creatorId || room.hostId) === pid,
          joinedAt: now,
          lastSeenAt: now,
          progressDistance: 0,
          lane: room.participants.length % 5,
          action: 'running',
          jumpY: 0,
          isSpectating: room.raceStatus === 'running' || room.raceStatus === 'starting',
        });
      }
    }

    room.updatedAt = now;
    resolveRoomHostAndLanes(room);
    saveDb(db);
    broadcastToRoom(code, { type: 'room:state', room, serverTime: now });
    res.json({ ok: true, room, serverTime: now });
  });

  app.post('/api/rooms/:code/kick', (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = db.rooms[code];
    if (!room) {
      res.status(404).json({ ok: false, error: 'Sala não encontrada.' });
      return;
    }

    const body = req.body as { targetId?: string; requesterId?: string };
    const targetId = String(body.targetId || '').trim();
    const requesterId = String(body.requesterId || '').trim();

    resolveRoomHostAndLanes(room);
    if (!isLeaderOfRoom(room, requesterId)) {
      res.status(403).json({
        ok: false,
        onlyHost: true,
        error: 'Apenas o líder que criou a sala pode remover participantes.',
      });
      return;
    }

    if (!targetId || targetId === requesterId || targetId === room.creatorId) {
      res.status(400).json({ ok: false, error: 'Jogador alvo inválido.' });
      return;
    }

    if (!Array.isArray(room.kickedIds)) room.kickedIds = [];
    if (!room.kickedIds.includes(targetId)) {
      room.kickedIds.push(targetId);
    }

    room.participants = room.participants.filter((p) => p.id !== targetId);
    resolveRoomHostAndLanes(room);
    room.updatedAt = Date.now();
    saveDb(db);
    broadcastToRoom(code, { type: 'room:kicked', roomCode: code, targetId, room, serverTime: room.updatedAt });

    // Desconecta o jogador removido do canal de voz da sala, se estiver conectado
    const privateVoiceKey = `PRIVATE:${code}`;
    const roomVoicePeers = voiceRooms.get(privateVoiceKey);
    if (roomVoicePeers) {
      for (const peer of Array.from(roomVoicePeers.values())) {
        if (peer.peerId === targetId || peer.peerId.startsWith(`${targetId}:`)) {
          sendWs(peer.ws, {
            type: 'voice:kicked',
            roomKey: privateVoiceKey,
          });
          removeVoicePeer(peer.ws);
        }
      }
    }

    res.json({ ok: true, room, kickedId: targetId, serverTime: Date.now() });
  });

  app.post('/api/rooms/:code/start', (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = db.rooms[code];
    if (!room) {
      res.status(404).json({ ok: false, error: 'Sala não encontrada.' });
      return;
    }

    const body = (req.body || {}) as { requesterId?: string };
    const requesterId = String(body.requesterId || '').trim();
    resolveRoomHostAndLanes(room);

    const callerParticipant = room.participants.find((p) => p.id === requesterId);
    if (
      ((room.creatorId || room.hostId) && !isLeaderOfRoom(room, requesterId)) ||
      (callerParticipant && !callerParticipant.isHost)
    ) {
      res.status(403).json({
        ok: false,
        onlyHost: true,
        error: 'Apenas o líder da sala pode iniciar a partida.',
      });
      return;
    }

    const result = triggerSynchronizedRaceStart(room);
    res.json({
      ok: true,
      started: result.started,
      syncedRaceStartAt: room.syncedRaceStartAt ?? null,
      waitingNames: result.waitingParticipants.map((p) => p.name),
      room,
      serverTime: Date.now(),
    });
  });

  app.post('/api/rooms/:code/progress', (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = db.rooms[code];
    if (!room) {
      res.status(404).json({ ok: false, error: 'Sala não encontrada.' });
      return;
    }

    const body = req.body as {
      playerId?: string;
      progressDistance?: number;
      lane?: number;
      action?: string;
      jumpY?: number;
      raceStatus?: 'idle' | 'starting' | 'running' | 'completed';
    };

    const now = Date.now();
    if (typeof body.playerId === 'string' && body.playerId.trim()) {
      const pid = body.playerId.trim();
      const participant = room.participants.find((p) => p.id === pid);
      if (participant && !participant.isSpectating) {
        if (typeof body.progressDistance === 'number' && Number.isFinite(body.progressDistance)) {
          participant.progressDistance = Math.max(0, Math.min(100_000, body.progressDistance));
        }
        if (typeof body.lane === 'number' && Number.isFinite(body.lane)) {
          participant.lane = Math.max(0, Math.min(4, Math.round(body.lane)));
        }
        if (typeof body.action === 'string' && VALID_RACE_ACTIONS.has(body.action)) {
          participant.action = body.action;
        }
        if (typeof body.jumpY === 'number' && Number.isFinite(body.jumpY)) {
          participant.jumpY = Math.max(0, Math.min(500, body.jumpY));
        }
        participant.lastSeenAt = now;
      }
    }

    if (typeof body.raceStatus === 'string' && VALID_RACE_STATUSES.has(body.raceStatus)) {
      room.raceStatus = body.raceStatus;
    }
    room.updatedAt = now;

    res.json({ ok: true, room, serverTime: now });
  });

  // ============================================================================
  // 2.1 TELEMETRIA AO VIVO PARA PAINEL ADMINISTRATIVO (/api/admin/overview)
  // ============================================================================
  interface VoicePeer {
    peerId: string;
    name: string;
    avatar: string;
    roomKey: string;
    roomMode: 'private' | 'public';
    muted: boolean;
    deafened: boolean;
    speaking: boolean;
    rttMs: number | null;
    joinedAt: number;
    ws: WebSocket;
  }

  const voiceRooms = new Map<string, Map<string, VoicePeer>>();
  const socketToPeer = new Map<WebSocket, { peerId: string; roomKey: string }>();

  const toPublicPeer = (p: VoicePeer) => ({
    peerId: p.peerId,
    name: p.name,
    avatar: p.avatar,
    roomKey: p.roomKey,
    roomMode: p.roomMode,
    muted: p.muted,
    deafened: p.deafened,
    speaking: p.speaking,
    rttMs: p.rttMs,
  });

  const sendWs = (ws: WebSocket, payload: unknown) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const broadcastToVoiceRoom = (roomKey: string, payload: unknown, excludePeerId?: string) => {
    const roomPeers = voiceRooms.get(roomKey);
    if (!roomPeers) return;
    for (const peer of roomPeers.values()) {
      if (excludePeerId && peer.peerId === excludePeerId) continue;
      sendWs(peer.ws, payload);
    }
  };

  const removeVoicePeer = (ws: WebSocket) => {
    const ref = socketToPeer.get(ws);
    if (!ref) return;
    socketToPeer.delete(ws);

    const roomPeers = voiceRooms.get(ref.roomKey);
    if (!roomPeers) return;
    roomPeers.delete(ref.peerId);
    if (roomPeers.size === 0) {
      voiceRooms.delete(ref.roomKey);
    } else {
      broadcastToVoiceRoom(ref.roomKey, {
        type: 'voice:peer-left',
        peerId: ref.peerId,
        roomKey: ref.roomKey,
      });
    }
  };

  const findOrAssignPublicVoiceRoom = (): string => {
    let slot = 1;
    while (slot < 100) {
      const candidate = `PUBLIC:ARENA-${slot}`;
      const existing = voiceRooms.get(candidate);
      if (!existing || existing.size < 5) {
        return candidate;
      }
      slot++;
    }
    return `PUBLIC:ARENA-${Date.now()}`;
  };

  app.get('/api/admin/overview', (_req: Request, res: Response) => {
    const roomsList = Object.values(db.rooms).map((r) => {
      pruneRoomParticipants(r);
      return {
        code: r.code,
        title: r.title,
        hostName: r.hostName,
        betAmount: r.betAmount,
        accessMode: r.accessMode || 'invite-only',
        participantsCount: r.participants.length,
        raceStatus: r.raceStatus,
        updatedAt: r.updatedAt,
      };
    });

    const voiceChannels: Array<{
      roomKey: string;
      roomMode: 'private' | 'public';
      peersCount: number;
      peers: Array<{ name: string; avatar: string; muted: boolean; speaking: boolean }>;
    }> = [];
    let activeVoicePeersCount = 0;

    for (const [roomKey, peersMap] of voiceRooms.entries()) {
      activeVoicePeersCount += peersMap.size;
      const peersArr = Array.from(peersMap.values());
      voiceChannels.push({
        roomKey,
        roomMode: peersArr[0]?.roomMode || 'private',
        peersCount: peersArr.length,
        peers: peersArr.map((p) => ({
          name: p.name,
          avatar: p.avatar,
          muted: p.muted,
          speaking: p.speaking,
        })),
      });
    }

    const allAnalyses = Array.from(participantTelemetryAnalyses.values()).sort(
      (a, b) => b.suspicionScore - a.suspicionScore || b.lastDetectedAt - a.lastDetectedAt
    );

    res.json({
      ok: true,
      serverTime: Date.now(),
      storedMatches: db.matches.length,
      activeRoomsCount: roomsList.length,
      activeVoicePeersCount,
      recentAnomalyLogsCount: telemetryAnomalyLogs.length,
      flaggedParticipantsCount: allAnalyses.filter(
        (entry) => entry.riskLevel === 'investigating' || entry.riskLevel === 'high-risk'
      ).length,
      telemetryAnalyses: allAnalyses.slice(0, 20),
      rooms: roomsList.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20),
      voiceChannels,
    });
  });

  app.post('/api/telemetry/anomalies/batch', (req: Request, res: Response) => {
    const body = req.body as {
      roomCode?: unknown;
      raceRound?: unknown;
      reporterId?: unknown;
      logs?: unknown;
    };

    if (!body || !Array.isArray(body.logs)) {
      res.status(400).json({ ok: false, error: 'logs array is required' });
      return;
    }

    if (body.logs.length > 100) {
      res.status(400).json({ ok: false, error: 'Batch exceeds maximum of 100 logs' });
      return;
    }

    const receivedAt = Date.now();
    const fallbackRoomCode =
      typeof body.roomCode === 'string' && body.roomCode.trim()
        ? body.roomCode.trim().toUpperCase().slice(0, 32)
        : 'UNKNOWN';
    const fallbackRaceRound =
      typeof body.raceRound === 'number' && Number.isFinite(body.raceRound)
        ? Math.max(0, Math.round(body.raceRound))
        : 0;
    const fallbackReporterId =
      typeof body.reporterId === 'string' && body.reporterId.trim()
        ? body.reporterId.trim().slice(0, 64)
        : 'anonymous';

    let ingested = 0;
    const touchedKeys = new Set<string>();

    for (const rawEntry of body.logs) {
      const cleanLog = sanitizeTelemetryLog(
        rawEntry,
        fallbackRoomCode,
        fallbackRaceRound,
        fallbackReporterId,
        receivedAt
      );
      if (!cleanLog) continue;
      if (seenAnomalyLogIds.has(cleanLog.id)) continue;

      seenAnomalyLogIds.add(cleanLog.id);
      telemetryAnomalyLogs.push(cleanLog);
      while (telemetryAnomalyLogs.length > MAX_TELEMETRY_LOGS) {
        const evicted = telemetryAnomalyLogs.shift();
        if (evicted) seenAnomalyLogIds.delete(evicted.id);
      }

      const key = `${cleanLog.roomCode}::${cleanLog.competitorId}`;
      let summary = participantTelemetryAnalyses.get(key);
      if (!summary) {
        if (participantTelemetryAnalyses.size >= MAX_ANALYSES_COUNT) {
          const oldestKey = participantTelemetryAnalyses.keys().next().value;
          if (oldestKey) participantTelemetryAnalyses.delete(oldestKey);
        }
        summary = {
          competitorId: cleanLog.competitorId,
          competitorName: cleanLog.competitorName,
          roomCode: cleanLog.roomCode,
          totalAnomalies: 0,
          reasons: {
            'impossible-speed': 0,
            'lane-switch-flood': 0,
            'position-teleport': 0,
          },
          maxSpeedMps: 0,
          maxSwitchesPerSec: 0,
          suspicionScore: 0,
          riskLevel: 'monitor',
          firstDetectedAt: cleanLog.detectedAt,
          lastDetectedAt: cleanLog.detectedAt,
        };
      }

      summary.competitorName = cleanLog.competitorName || summary.competitorName;
      summary.totalAnomalies += 1;
      summary.reasons[cleanLog.reason] += 1;
      if (typeof cleanLog.peakSpeedMps === 'number') {
        summary.maxSpeedMps = Math.max(summary.maxSpeedMps, cleanLog.peakSpeedMps);
      }
      if (typeof cleanLog.switchesPerSec === 'number') {
        summary.maxSwitchesPerSec = Math.max(summary.maxSwitchesPerSec, cleanLog.switchesPerSec);
      }
      summary.firstDetectedAt = Math.min(summary.firstDetectedAt, cleanLog.detectedAt);
      summary.lastDetectedAt = Math.max(summary.lastDetectedAt, cleanLog.detectedAt);
      summary.suspicionScore = computeServerSuspicionScore(summary);
      summary.riskLevel = resolveRiskLevel(summary.suspicionScore, summary.totalAnomalies);

      participantTelemetryAnalyses.set(key, summary);
      touchedKeys.add(key);
      ingested += 1;

      const room = db.rooms[cleanLog.roomCode];
      if (room && (summary.riskLevel === 'investigating' || summary.riskLevel === 'high-risk')) {
        const participant = room.participants.find((p) => p.id === cleanLog.competitorId);
        if (participant && participant.sessionStatus !== 'investigating') {
          participant.sessionStatus = 'investigating';
        }
      }
    }

    const updatedAnalyses = Array.from(touchedKeys)
      .map((key) => participantTelemetryAnalyses.get(key))
      .filter((entry): entry is ServerParticipantAnomalySummary => Boolean(entry));

    res.json({
      ok: true,
      ingested,
      totalStored: telemetryAnomalyLogs.length,
      analyses: updatedAnalyses,
      serverTime: receivedAt,
    });
  });

  app.get('/api/telemetry/anomalies', (req: Request, res: Response) => {
    const roomCodeFilter =
      typeof req.query.roomCode === 'string' && req.query.roomCode.trim()
        ? req.query.roomCode.trim().toUpperCase()
        : null;
    const competitorIdFilter =
      typeof req.query.competitorId === 'string' && req.query.competitorId.trim()
        ? req.query.competitorId.trim()
        : null;

    const filteredLogs = telemetryAnomalyLogs.filter((entry) => {
      if (roomCodeFilter && entry.roomCode !== roomCodeFilter) return false;
      if (competitorIdFilter && entry.competitorId !== competitorIdFilter) return false;
      return true;
    });

    const filteredAnalyses = Array.from(participantTelemetryAnalyses.values())
      .filter((entry) => {
        if (roomCodeFilter && entry.roomCode !== roomCodeFilter) return false;
        if (competitorIdFilter && entry.competitorId !== competitorIdFilter) return false;
        return true;
      })
      .sort((a, b) => b.suspicionScore - a.suspicionScore || b.lastDetectedAt - a.lastDetectedAt);

    res.json({
      ok: true,
      count: filteredLogs.length,
      logs: filteredLogs.slice(-100),
      analyses: filteredAnalyses,
      serverTime: Date.now(),
    });
  });

  // ============================================================================
  // 3. VITE MIDDLEWARE EM DEV OU ESTÁTICO EM PRODUÇÃO
  // ============================================================================
  const isHostedProduction = config.isProduction;

  // Qualquer rota /api/* não encontrada retorna JSON 404 em vez de cair no SPA fallback
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  const httpServer = http.createServer(app);
  const disableHmr = config.disableHmr;

  if (!isHostedProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    const distIndexPath = path.join(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      if (!fs.existsSync(distIndexPath)) {
        res.status(503).send('Build assets not found. Run npm run build first.');
        return;
      }
      res.sendFile(distIndexPath);
    });
  }

  const wss = new WebSocketServer({ noServer: true });
  const roomWss = new WebSocketServer({ noServer: true });
  const wsAliveMap = new WeakMap<WebSocket, boolean>();

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws/voice') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      } else if (pathname === '/ws/room') {
        roomWss.handleUpgrade(req, socket, head, (ws) => {
          roomWss.emit('connection', ws, req);
        });
      } else if (disableHmr || pathname !== '/') {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  const detachRoomSocket = (ws: WebSocket) => {
    const ref = socketToRoomClient.get(ws);
    if (!ref) return;
    socketToRoomClient.delete(ws);

    const sockets = roomSockets.get(ref.roomCode);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) roomSockets.delete(ref.roomCode);
    }

    const room = db.rooms[ref.roomCode];
    if (room) {
      const participant = room.participants.find((p) => p.id === ref.playerId);
      if (participant) {
        participant.connected = false;
        participant.lastSeenAt = Date.now();
      }
      const anyConnected = room.participants.some((p) => p.connected !== false);
      if (!anyConnected) {
        room.raceStatus = 'idle';
        room.pendingStart = false;
        room.raceStartAt = null;
        room.syncedRaceStartAt = null;
      }
      resolveRoomHostAndLanes(room);
      if (room.pendingStart && getUnreadyParticipants(room).length === 0 && anyConnected) {
        triggerSynchronizedRaceStart(room);
      } else {
        broadcastToRoom(ref.roomCode, { type: 'room:state', room, serverTime: Date.now() });
      }
    }
  };

  roomWss.on('connection', (ws: WebSocket) => {
    wsAliveMap.set(ws, true);
    ws.on('pong', () => {
      wsAliveMap.set(ws, true);
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          roomCode?: string;
          title?: string;
          hostName?: string;
          creatorId?: string;
          isRoomCreator?: boolean;
          maxPlayers?: number;
          betAmount?: number;
          fillWithBots?: boolean;
          isDemo?: boolean;
          accessMode?: 'random' | 'invite-only';
          viaInvite?: boolean;
          autoMatch?: boolean;
          autoStart?: boolean;
          excludeRoomCode?: string;
          selectingProfile?: boolean;
          isSpectating?: boolean;
          raceRound?: number;
          clientTime?: number;
          playerId?: string;
          progressDistance?: number;
          lane?: number;
          targetLane?: number;
          laneX?: number;
          action?: string;
          jumpY?: number;
          stumbling?: boolean;
          finished?: boolean;
          bots?: Array<{
            id: string;
            name: string;
            avatar: string;
            avatarId: string;
            color: string;
            lane: number;
            progressDistance: number;
          }>;
          player?: {
            id?: string;
            name?: string;
            avatar?: string;
            avatarId?: string;
            color?: string;
            profileReady?: boolean;
            selectingProfile?: boolean;
          };
        };

        if (!msg || !msg.type) return;

        if (msg.type === 'room:ping') {
          sendRoomWs(ws, {
            type: 'room:pong',
            clientTime: typeof msg.clientTime === 'number' ? msg.clientTime : Date.now(),
            serverTime: Date.now(),
          });
          return;
        }

        if (msg.type === 'room:find-next-public') {
          const prevRef = socketToRoomClient.get(ws);
          const playerId = (msg.player?.id || msg.playerId || prevRef?.playerId || '').trim();
          if (!playerId) return;

          const now = Date.now();
          const oldRoomCode = (msg.excludeRoomCode || prevRef?.roomCode || '').trim().toUpperCase();

          if (prevRef) {
            const oldSockets = roomSockets.get(prevRef.roomCode);
            if (oldSockets) {
              oldSockets.delete(ws);
              if (oldSockets.size === 0) roomSockets.delete(prevRef.roomCode);
            }
            socketToRoomClient.delete(ws);

            const oldRoom = db.rooms[prevRef.roomCode];
            if (oldRoom) {
              recordPublicMatchOpponents(oldRoom);
              oldRoom.participants = oldRoom.participants.filter((p) => p.id !== playerId);
              if (oldRoom.participants.length === 0) {
                oldRoom.raceStatus = 'idle';
                oldRoom.pendingStart = false;
                oldRoom.raceStartAt = null;
                oldRoom.syncedRaceStartAt = null;
              }
              resolveRoomHostAndLanes(oldRoom);
              oldRoom.updatedAt = now;
              broadcastToRoom(oldRoom.code, { type: 'room:state', room: oldRoom, serverTime: now }, ws);
            }
          }

          const nextRoom = findOrCreatePublicRoom(
            Boolean(msg.isDemo ?? true),
            playerId,
            clampRoomBet(msg.betAmount, 500),
            (msg.player?.name || msg.hostName || 'Corredor').trim(),
            oldRoomCode
          );
          const nextCode = nextRoom.code;

          let nextSockets = roomSockets.get(nextCode);
          if (!nextSockets) {
            nextSockets = new Set<WebSocket>();
            roomSockets.set(nextCode, nextSockets);
          }
          nextSockets.add(ws);
          socketToRoomClient.set(ws, { roomCode: nextCode, playerId });

          pruneRoomParticipants(nextRoom);
          if (nextRoom.participants.length === 0) {
            nextRoom.hostId = playerId;
            nextRoom.hostName = (msg.player?.name || msg.hostName || 'Corredor').trim();
          }

          const existingIdx = nextRoom.participants.findIndex((p) => p.id === playerId);
          if (existingIdx < 0) {
            nextRoom.participants.push({
              id: playerId,
              name: (msg.player?.name || `Corredor ${nextRoom.participants.length + 1}`).trim(),
              avatar: msg.player?.avatar || '⚡',
              avatarId: msg.player?.avatarId || 'rei-zero',
              color: msg.player?.color || '#38bdf8',
              isHost: nextRoom.hostId === playerId || nextRoom.participants.length === 0,
              joinedAt: now,
              lastSeenAt: now,
              progressDistance: 0,
              lane: LANE_ORDER[nextRoom.participants.length % LANE_ORDER.length],
              action: 'running',
              jumpY: 0,
              profileReady: msg.player?.profileReady !== false,
              selectingProfile: Boolean(msg.player?.selectingProfile),
              connected: true,
              betAmount: nextRoom.betAmount,
              isSpectating: false,
            });
          } else {
            const p = nextRoom.participants[existingIdx];
            p.connected = true;
            p.lastSeenAt = now;
            p.isSpectating = false;
            p.betAmount = nextRoom.betAmount;
          }

          resolveRoomHostAndLanes(nextRoom);
          nextRoom.updatedAt = now;
          saveDb(db);

          sendRoomWs(ws, {
            type: 'room:joined',
            room: nextRoom,
            serverTime: now,
            rotatedPublicMatch: true,
            startAfterJoin: Boolean(msg.autoStart),
          });
          broadcastToRoom(nextCode, { type: 'room:state', room: nextRoom, serverTime: now }, ws);
          return;
        }

        if (msg.type === 'room:join' && msg.roomCode && msg.player?.id) {
          const playerId = msg.player.id.trim();
          const now = Date.now();

          let room: ServerRoom;
          let code: string;
          if (msg.autoMatch) {
            room = findOrCreatePublicRoom(
              Boolean(msg.isDemo ?? true),
              playerId,
              clampRoomBet(msg.betAmount, 500),
              (msg.player.name || msg.hostName || 'Corredor').trim(),
              msg.excludeRoomCode
            );
            code = room.code;
          } else {
            code = msg.roomCode.trim().toUpperCase();
            room = db.rooms[code];
            const explicitCreator =
              msg.isRoomCreator === true || Boolean(msg.creatorId && msg.creatorId.trim() === playerId);
            if (!room) {
              room = {
                code,
                title: (msg.title || `Arena ${code}`).trim(),
                hostName: (msg.hostName || msg.player.name || 'Anfitrião').trim(),
                hostId: explicitCreator || !msg.viaInvite ? playerId : undefined,
                creatorId: explicitCreator || !msg.viaInvite ? playerId : undefined,
                maxPlayers: clampMaxPlayers(msg.maxPlayers, 5),
                betAmount: clampRoomBet(msg.betAmount, 500),
                fillWithBots: msg.fillWithBots ?? false,
                isDemo: msg.isDemo ?? true,
                accessMode: normalizeAccessMode(msg.accessMode),
                createdAt: now,
                updatedAt: now,
                raceStatus: 'idle',
                raceRound: 1,
                raceStartAt: null,
                syncedRaceStartAt: null,
                participants: [],
                kickedIds: [],
              };
              db.rooms[code] = room;
            } else if (explicitCreator && !room.creatorId) {
              room.creatorId = playerId;
              room.hostId = playerId;
            }
          }

          // Remove from previous room if switching
          const prevRef = socketToRoomClient.get(ws);
          if (prevRef && (prevRef.roomCode !== code || prevRef.playerId !== playerId)) {
            detachRoomSocket(ws);
          }

          let sockets = roomSockets.get(code);
          if (!sockets) {
            sockets = new Set<WebSocket>();
            roomSockets.set(code, sockets);
          }
          sockets.add(ws);
          socketToRoomClient.set(ws, { roomCode: code, playerId });

          pruneRoomParticipants(room);

          if (Array.isArray(room.kickedIds) && room.kickedIds.includes(playerId)) {
            sendRoomWs(ws, { type: 'room:kicked', roomCode: code, targetId: playerId });
            return;
          }

          const existingIdx = room.participants.findIndex((p) => p.id === playerId);
          if (existingIdx < 0) {
            const isCreator =
              Boolean(room.creatorId && room.creatorId === playerId) ||
              Boolean(room.hostId && room.hostId === playerId) ||
              (!room.creatorId && !room.hostId && room.participants.length === 0 && !msg.viaInvite);
            if (room.accessMode === 'invite-only' && msg.viaInvite === false && !msg.autoMatch && !isCreator) {
              sendRoomWs(ws, { type: 'room:error', code: 'INVITE_ONLY', roomCode: code });
              return;
            }
            if (room.participants.length >= (room.maxPlayers || 5)) {
              sendRoomWs(ws, { type: 'room:error', code: 'ROOM_FULL', roomCode: code });
              return;
            }
            if (isCreator) {
              room.hostId = playerId;
              if (!room.creatorId && !msg.autoMatch) room.creatorId = playerId;
            }
            const joinedMidRace = room.raceStatus === 'running' || room.raceStatus === 'starting';
            room.participants.push({
              id: playerId,
              name: (msg.player.name || `Corredor ${room.participants.length + 1}`).trim(),
              avatar: msg.player.avatar || '⚡',
              avatarId: msg.player.avatarId || 'rei-zero',
              color: msg.player.color || '#38bdf8',
              isHost: (room.creatorId || room.hostId) === playerId,
              joinedAt: now,
              lastSeenAt: now,
              progressDistance: 0,
              lane: LANE_ORDER[room.participants.length % LANE_ORDER.length],
              action: 'running',
              jumpY: 0,
              profileReady: msg.player.profileReady !== false,
              selectingProfile: Boolean(msg.player.selectingProfile),
              connected: true,
              betAmount: room.betAmount,
              isSpectating: joinedMidRace,
            });
          } else {
            const p = room.participants[existingIdx];
            p.name = (msg.player.name || p.name).trim();
            p.avatar = msg.player.avatar || p.avatar;
            p.avatarId = msg.player.avatarId || p.avatarId;
            p.color = msg.player.color || p.color;
            p.lastSeenAt = now;
            p.connected = true;
            p.betAmount = room.betAmount;
            if (room.raceStatus === 'idle' || room.raceStatus === 'completed') {
              p.isSpectating = false;
            }
            if (typeof msg.player.profileReady === 'boolean') {
              p.profileReady = msg.player.profileReady;
            }
            if (typeof msg.player.selectingProfile === 'boolean') {
              p.selectingProfile = msg.player.selectingProfile;
            }
          }

          resolveRoomHostAndLanes(room);
          room.updatedAt = now;
          saveDb(db);

          sendRoomWs(ws, { type: 'room:joined', room, serverTime: now });
          if (room.pendingStart && getUnreadyParticipants(room).length === 0) {
            triggerSynchronizedRaceStart(room);
          } else {
            broadcastToRoom(code, { type: 'room:state', room, serverTime: now });
          }
          return;
        }

        if (msg.type === 'room:leave') {
          const ref = socketToRoomClient.get(ws);
          if (ref) {
            const leftRoom = db.rooms[ref.roomCode];
            if (leftRoom && leftRoom.creatorId !== ref.playerId) {
              leftRoom.participants = leftRoom.participants.filter((p) => p.id !== ref.playerId);
              resolveRoomHostAndLanes(leftRoom);
              leftRoom.updatedAt = Date.now();
              saveDb(db);
              broadcastToRoom(leftRoom.code, { type: 'room:state', room: leftRoom, serverTime: Date.now() }, ws);
            }
            detachRoomSocket(ws);
          }
          return;
        }

        const clientRef = socketToRoomClient.get(ws);
        if (!clientRef) return;
        const room = db.rooms[clientRef.roomCode];
        if (!room) return;
        const participant = room.participants.find((p) => p.id === clientRef.playerId);

        if (msg.type === 'room:activity-state' && participant) {
          const isEditing = Boolean(msg.selectingProfile);
          participant.selectingProfile = isEditing;
          participant.profileReady = !isEditing;
          participant.connected = true;
          participant.lastSeenAt = Date.now();
          resolveRoomHostAndLanes(room);
          room.updatedAt = Date.now();
          saveDb(db);

          if (!isEditing && room.pendingStart && getUnreadyParticipants(room).length === 0) {
            triggerSynchronizedRaceStart(room);
          } else {
            broadcastToRoom(room.code, { type: 'room:state', room, serverTime: Date.now() });
          }
          return;
        }

        if (msg.type === 'room:profile-ready' && participant && msg.player) {
          participant.name = (msg.player.name || participant.name).trim();
          participant.avatar = msg.player.avatar || participant.avatar;
          participant.avatarId = msg.player.avatarId || participant.avatarId;
          participant.color = msg.player.color || participant.color;
          participant.profileReady = true;
          participant.selectingProfile = false;
          participant.connected = true;
          participant.lastSeenAt = Date.now();
          resolveRoomHostAndLanes(room);
          room.updatedAt = Date.now();
          saveDb(db);

          if (room.pendingStart && getUnreadyParticipants(room).length === 0) {
            triggerSynchronizedRaceStart(room);
          } else {
            broadcastToRoom(room.code, { type: 'room:state', room, serverTime: Date.now() });
          }
          return;
        }

        if (msg.type === 'room:update-bet' && typeof msg.betAmount === 'number') {
          resolveRoomHostAndLanes(room);
          if (!isLeaderOfRoom(room, clientRef.playerId)) {
            sendRoomWs(ws, { type: 'room:not-host', roomCode: room.code, serverTime: Date.now() });
            return;
          }
          room.betAmount = clampRoomBet(msg.betAmount, room.betAmount || 500);
          room.participants.forEach((p) => {
            p.betAmount = room.betAmount;
          });
          room.updatedAt = Date.now();
          saveDb(db);
          broadcastToRoom(room.code, { type: 'room:state', room, serverTime: room.updatedAt });
          return;
        }

        if (msg.type === 'room:update-config') {
          resolveRoomHostAndLanes(room);
          if (!isLeaderOfRoom(room, clientRef.playerId)) {
            sendRoomWs(ws, { type: 'room:not-host', roomCode: room.code, serverTime: Date.now() });
            return;
          }
          if (typeof msg.maxPlayers === 'number') {
            room.maxPlayers = clampMaxPlayers(msg.maxPlayers, room.maxPlayers || 5);
          }
          if (msg.accessMode === 'random' || msg.accessMode === 'invite-only') {
            room.accessMode = msg.accessMode;
          }
          if (typeof msg.fillWithBots === 'boolean') {
            room.fillWithBots = msg.fillWithBots;
          }
          if (typeof msg.title === 'string' && msg.title.trim()) {
            room.title = msg.title.trim();
          }
          if (typeof msg.betAmount === 'number') {
            room.betAmount = clampRoomBet(msg.betAmount, room.betAmount || 500);
            room.participants.forEach((p) => {
              p.betAmount = room.betAmount;
            });
          }
          room.updatedAt = Date.now();
          saveDb(db);
          broadcastToRoom(room.code, { type: 'room:state', room, serverTime: room.updatedAt });
          return;
        }

        if (msg.type === 'room:start-request') {
          resolveRoomHostAndLanes(room);
          if (!participant?.isHost || !isLeaderOfRoom(room, clientRef.playerId)) {
            sendRoomWs(ws, {
              type: 'room:not-host',
              roomCode: room.code,
              onlyHost: true,
              serverTime: Date.now(),
            });
            return;
          }
          triggerSynchronizedRaceStart(room);
          return;
        }

        if (msg.type === 'room:spectate-state' && participant) {
          const canSpectateNow = room.raceStatus === 'running' || room.raceStatus === 'starting';
          participant.isSpectating = canSpectateNow ? Boolean(msg.isSpectating) : false;
          participant.connected = true;
          participant.lastSeenAt = Date.now();
          room.updatedAt = participant.lastSeenAt;
          saveDb(db);
          broadcastToRoom(room.code, { type: 'room:state', room, serverTime: room.updatedAt });
          return;
        }

        if (msg.type === 'room:race-telemetry' && participant) {
          if (participant.isSpectating) {
            return;
          }
          if (typeof msg.raceRound === 'number' && room.raceRound && msg.raceRound !== room.raceRound) {
            return;
          }
          const nowMs = Date.now();
          if (room.raceStatus === 'starting' && nowMs >= (room.syncedRaceStartAt || 0)) {
            room.raceStatus = 'running';
          }
          if (typeof msg.progressDistance === 'number' && Number.isFinite(msg.progressDistance)) {
            participant.progressDistance = Math.max(0, Math.min(100_000, msg.progressDistance));
          }
          if (typeof msg.lane === 'number' && Number.isFinite(msg.lane)) {
            participant.lane = Math.max(0, Math.min(4, Math.round(msg.lane)));
          }
          if (typeof msg.targetLane === 'number' && Number.isFinite(msg.targetLane)) {
            participant.targetLane = Math.max(0, Math.min(4, Math.round(msg.targetLane)));
          }
          if (typeof msg.laneX === 'number' && Number.isFinite(msg.laneX)) {
            participant.laneX = Math.max(-200, Math.min(2000, msg.laneX));
          }
          if (typeof msg.action === 'string' && VALID_RACE_ACTIONS.has(msg.action)) {
            participant.action = msg.action;
          }
          if (typeof msg.jumpY === 'number' && Number.isFinite(msg.jumpY)) {
            participant.jumpY = Math.max(0, Math.min(500, msg.jumpY));
          }
          if (typeof msg.stumbling === 'boolean') participant.stumbling = msg.stumbling;
          if (typeof msg.finished === 'boolean') participant.finished = msg.finished;
          participant.lastSeenAt = nowMs;

          broadcastToRoom(
            room.code,
            {
              type: 'room:race-sync',
              roomCode: room.code,
              raceRound: room.raceRound,
              playerId: participant.id,
              progressDistance: participant.progressDistance,
              lane: participant.lane,
              targetLane: participant.targetLane ?? participant.lane,
              laneX: participant.laneX,
              action: participant.action,
              jumpY: participant.jumpY,
              stumbling: Boolean(participant.stumbling),
              finished: Boolean(participant.finished),
              serverTime: participant.lastSeenAt,
            },
            ws
          );
          return;
        }

        if (msg.type === 'room:race-finish' && participant) {
          if (participant.isSpectating) {
            return;
          }
          if (room.raceStatus === 'completed') {
            if (room.lastResults) {
              sendRoomWs(ws, {
                type: 'room:race-finished',
                roomCode: room.code,
                raceRound: room.lastResults.raceRound,
                betAmount: room.lastResults.betAmount,
                rankings: room.lastResults.rankings,
                threeTorneiras: calculateThreeTorneirasServer(
                  room.lastResults.betAmount,
                  room.lastResults.rankings.length
                ),
                room,
                serverTime: Date.now(),
              });
            }
            return;
          }

          if (typeof msg.progressDistance === 'number') {
            participant.progressDistance = Math.max(0, msg.progressDistance);
          }
          participant.finished = true;
          participant.finishTime = Date.now();
          participant.lastSeenAt = participant.finishTime;

          let ctrl = roomFinishControl.get(room.code);
          if (!ctrl || ctrl.raceRound !== room.raceRound) {
            ctrl = {
              raceRound: room.raceRound,
              timer: null,
              bots: Array.isArray(msg.bots) ? msg.bots : [],
            };
            roomFinishControl.set(room.code, ctrl);
          } else if (Array.isArray(msg.bots) && msg.bots.length > 0 && (participant.isHost || ctrl.bots.length === 0)) {
            ctrl.bots = msg.bots;
          }

          const connectedHumans = room.participants.filter(
            (p) => p.connected !== false && p.isSpectating !== true
          );
          const allHumansFinished =
            connectedHumans.length <= 1 || connectedHumans.every((p) => p.finished === true);

          if (allHumansFinished) {
            finalizeRoomRace(room);
          } else if (!ctrl.timer) {
            ctrl.timer = setTimeout(() => {
              const latestRoom = db.rooms[room.code];
              if (latestRoom && latestRoom.raceStatus !== 'completed') {
                finalizeRoomRace(latestRoom);
              }
            }, 650);
          }
          return;
        }

        if (msg.type === 'room:return-lobby') {
          resolveRoomHostAndLanes(room);
          if (room.raceStatus === 'completed') {
            const prevStartCtrl = roomStartControl.get(room.code);
            if (prevStartCtrl?.timer) clearTimeout(prevStartCtrl.timer);
            roomStartControl.delete(room.code);
            room.raceStatus = 'idle';
            room.pendingStart = false;
            room.raceStartAt = null;
            room.syncedRaceStartAt = null;
            room.participants.forEach((p) => {
              p.progressDistance = 0;
              p.finished = false;
              p.stumbling = false;
              p.jumpY = 0;
              p.action = 'running';
              p.isSpectating = false;
            });
            resolveRoomHostAndLanes(room);
            room.updatedAt = Date.now();
            saveDb(db);
            broadcastToRoom(room.code, { type: 'room:state', room, serverTime: room.updatedAt });
          } else if (room.raceStatus === 'idle' && participant) {
            participant.isSpectating = false;
            participant.progressDistance = 0;
            participant.finished = false;
            participant.stumbling = false;
            participant.jumpY = 0;
            participant.action = 'running';
            resolveRoomHostAndLanes(room);
            room.updatedAt = Date.now();
            saveDb(db);
            broadcastToRoom(room.code, { type: 'room:state', room, serverTime: room.updatedAt });
          } else {
            // Não abortar uma contagem regressiva ('starting') ou corrida em curso ('running')
            sendRoomWs(ws, { type: 'room:state', room, serverTime: Date.now() });
          }
          return;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      detachRoomSocket(ws);
    });

    ws.on('error', () => {
      detachRoomSocket(ws);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    wsAliveMap.set(ws, true);
    ws.on('pong', () => {
      wsAliveMap.set(ws, true);
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          peerId?: string;
          name?: string;
          avatar?: string;
          roomCode?: string;
          mode?: 'private' | 'public';
          muted?: boolean;
          deafened?: boolean;
          speaking?: boolean;
          rttMs?: number;
          adaptiveBufferMs?: number;
          clientTime?: number;
          raceStatus?: string;
          raceRound?: number;
          targetPeerId?: string;
          sdp?: unknown;
          candidate?: unknown;
        };

        if (!msg || !msg.type) return;

        if (msg.type === 'voice:ping') {
          const clientTime =
            typeof msg.clientTime === 'number' && Number.isFinite(msg.clientTime)
              ? msg.clientTime
              : Date.now();
          sendWs(ws, {
            type: 'voice:pong',
            clientTime,
            serverTime: Date.now(),
            raceStatus: typeof msg.raceStatus === 'string' ? msg.raceStatus : undefined,
            raceRound: typeof msg.raceRound === 'number' ? msg.raceRound : undefined,
          });
          return;
        }

        if (msg.type === 'voice:join' && msg.peerId) {
          removeVoicePeer(ws);

          const mode: 'private' | 'public' = msg.mode === 'public' ? 'public' : 'private';
          const cleanCode = (msg.roomCode || 'HAMILTON-REI').trim().toUpperCase();
          const roomKey =
            mode === 'private' ? `PRIVATE:${cleanCode}` : findOrAssignPublicVoiceRoom();

          let roomPeers = voiceRooms.get(roomKey);
          if (!roomPeers) {
            roomPeers = new Map<string, VoicePeer>();
            voiceRooms.set(roomKey, roomPeers);
          }

          // Idempotência: se o mesmo peerId reconectou num novo socket, remove o antigo
          const existingPeer = roomPeers.get(msg.peerId);
          if (existingPeer && existingPeer.ws !== ws) {
            socketToPeer.delete(existingPeer.ws);
            roomPeers.delete(msg.peerId);
          }

          const newPeer: VoicePeer = {
            peerId: msg.peerId,
            name: (msg.name || 'Corredor').slice(0, 28),
            avatar: msg.avatar || '👑',
            roomKey,
            roomMode: mode,
            muted: Boolean(msg.muted),
            deafened: Boolean(msg.deafened),
            speaking: false,
            rttMs:
              typeof msg.rttMs === 'number' && Number.isFinite(msg.rttMs) && msg.rttMs >= 0
                ? Math.round(msg.rttMs)
                : null,
            joinedAt: Date.now(),
            ws,
          };

          const existingList = Array.from(roomPeers.values()).map(toPublicPeer);
          roomPeers.set(newPeer.peerId, newPeer);
          socketToPeer.set(ws, { peerId: newPeer.peerId, roomKey });

          sendWs(ws, {
            type: 'voice:joined',
            roomKey,
            roomMode: mode,
            selfPeerId: newPeer.peerId,
            peers: existingList,
          });

          broadcastToVoiceRoom(
            roomKey,
            {
              type: 'voice:peer-joined',
              roomKey,
              peer: toPublicPeer(newPeer),
            },
            newPeer.peerId
          );
          return;
        }

        if (msg.type === 'voice:leave') {
          removeVoicePeer(ws);
          return;
        }

        const senderRef = socketToPeer.get(ws);
        if (!senderRef) return;
        const roomPeers = voiceRooms.get(senderRef.roomKey);
        if (!roomPeers) return;
        const sender = roomPeers.get(senderRef.peerId);
        if (!sender) return;

        if (msg.type === 'voice:state') {
          if (typeof msg.muted === 'boolean') sender.muted = msg.muted;
          if (typeof msg.deafened === 'boolean') sender.deafened = msg.deafened;
          if (typeof msg.speaking === 'boolean') sender.speaking = msg.speaking;
          if (typeof msg.rttMs === 'number' && Number.isFinite(msg.rttMs) && msg.rttMs >= 0) {
            sender.rttMs = Math.round(msg.rttMs);
          }

          broadcastToVoiceRoom(
            senderRef.roomKey,
            {
              type: 'voice:peer-state',
              peerId: sender.peerId,
              muted: sender.muted,
              deafened: sender.deafened,
              speaking: sender.speaking,
              rttMs: sender.rttMs,
            },
            sender.peerId
          );
          return;
        }

        if (
          (msg.type === 'voice:offer' ||
            msg.type === 'voice:answer' ||
            msg.type === 'voice:ice') &&
          msg.targetPeerId
        ) {
          const target = roomPeers.get(msg.targetPeerId);
          if (target) {
            sendWs(target.ws, {
              type: msg.type,
              fromPeerId: sender.peerId,
              fromPeer: toPublicPeer(sender),
              sdp: msg.sdp,
              candidate: msg.candidate,
            });
          }
        }
      } catch {
        // Ignora mensagens malformadas
      }
    });

    ws.on('close', () => {
      removeVoicePeer(ws);
    });

    ws.on('error', () => {
      removeVoicePeer(ws);
    });
  });

  const wsHeartbeatTimer = setInterval(() => {
    const checkPool = (pool: WebSocketServer) => {
      for (const client of pool.clients) {
        if (wsAliveMap.get(client) === false) {
          client.terminate();
          continue;
        }
        wsAliveMap.set(client, false);
        try {
          client.ping();
        } catch {
          client.terminate();
        }
      }
    };
    checkPool(roomWss);
    checkPool(wss);
  }, 25_000);
  wsHeartbeatTimer.unref();

  const roomPruneTimer = setInterval(() => {
    if (pruneStaleRooms(db) > 0) {
      saveDb(db);
    }
  }, 10 * 60 * 1000);
  roomPruneTimer.unref();

  const shutdownGracefully = () => {
    clearInterval(wsHeartbeatTimer);
    clearInterval(roomPruneTimer);
    for (const ctrl of roomFinishControl.values()) {
      if (ctrl.timer) clearTimeout(ctrl.timer);
    }
    roomFinishControl.clear();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.once('SIGINT', shutdownGracefully);
  process.once('SIGTERM', shutdownGracefully);

  httpServer.listen(PORT, config.host, () => {
    console.log(
      `REI RUN server running on http://${config.host}:${PORT} [${config.nodeEnv}] (WebSocket /ws/voice enabled)`
    );
  });
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar servidor REI RUN:', err);
  process.exit(1);
});
