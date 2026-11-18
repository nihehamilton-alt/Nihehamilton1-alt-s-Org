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
  action: string;
  jumpY: number;
}

interface ServerRoom {
  code: string;
  title: string;
  hostName: string;
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
  participants: RoomParticipant[];
  kickedIds: string[];
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

// Limpeza de participantes inativos há mais de 15 minutos
function pruneRoomParticipants(room: ServerRoom): void {
  const cutoff = Date.now() - 15 * 60 * 1000;
  room.participants = room.participants.filter((p) => p.isHost || p.lastSeenAt >= cutoff);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const db = ensureDb();

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

      const existingIds = new Set(db.matches.map((m) => m.id));
      const syncedIds: string[] = [];
      const now = Date.now();

      for (const rec of incoming) {
        if (!rec || !rec.id) continue;
        syncedIds.push(rec.id);
        if (!existingIds.has(rec.id)) {
          db.matches.unshift({
            ...rec,
            synced: true,
            syncedAt: now,
          });
          existingIds.add(rec.id);
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
  const MAX_BET_KZ = 100_000;

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

  app.post('/api/rooms', (req: Request, res: Response) => {
    const body = req.body as {
      code?: string;
      title?: string;
      hostName?: string;
      maxPlayers?: number;
      betAmount?: number;
      fillWithBots?: boolean;
      isDemo?: boolean;
      accessMode?: 'random' | 'invite-only';
      player?: Partial<RoomParticipant>;
    };

    const code = (body.code || `ARENA-${Math.floor(1000 + Math.random() * 9000)}`)
      .trim()
      .toUpperCase();
    const now = Date.now();
    const requestedMax = clampMaxPlayers(body.maxPlayers, 5);

    let room = db.rooms[code];
    if (!room) {
      room = {
        code,
        title: (body.title || 'Arena do Hamilton').trim(),
        hostName: (body.hostName || 'Hamilton O Zero').trim(),
        maxPlayers: requestedMax,
        betAmount: clampRoomBet(body.betAmount, 500),
        fillWithBots: body.fillWithBots ?? true,
        isDemo: body.isDemo ?? true,
        accessMode: normalizeAccessMode(body.accessMode),
        createdAt: now,
        updatedAt: now,
        raceStatus: 'idle',
        raceRound: 1,
        raceStartAt: null,
        participants: [],
        kickedIds: [],
      };
      db.rooms[code] = room;
    } else {
      if (body.title) room.title = body.title.trim();
      if (body.hostName) room.hostName = body.hostName.trim();
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
      if (!Array.isArray(room.kickedIds)) room.kickedIds = [];
      if (!room.maxPlayers) room.maxPlayers = 5;
      room.updatedAt = now;
    }

    if (body.player && body.player.id) {
      const idx = room.participants.findIndex((p) => p.id === body.player!.id);
      const participant: RoomParticipant = {
        id: body.player.id,
        name: body.player.name || room.hostName,
        avatar: body.player.avatar || '👑',
        avatarId: body.player.avatarId || 'rei-zero',
        color: body.player.color || '#f59e0b',
        isHost: true,
        joinedAt: idx >= 0 ? room.participants[idx].joinedAt : now,
        lastSeenAt: now,
        progressDistance: idx >= 0 ? room.participants[idx].progressDistance : 0,
        lane: idx >= 0 ? room.participants[idx].lane : 2,
        action: 'running',
        jumpY: 0,
      };
      if (idx >= 0) room.participants[idx] = participant;
      else if (room.participants.length < room.maxPlayers) room.participants.push(participant);
    }

    pruneRoomParticipants(room);
    if (room.participants.length > room.maxPlayers) {
      const hosts = room.participants.filter((p) => p.isHost);
      const guests = room.participants.filter((p) => !p.isHost);
      room.participants = [...hosts, ...guests].slice(0, room.maxPlayers);
    }
    saveDb(db);
    res.json({ ok: true, room });
  });

  // Descoberta de sala aberta aleatória (declarada ANTES de /api/rooms/:code)
  app.get('/api/rooms/open/random', (req: Request, res: Response) => {
    const playerId = String(req.query.playerId || '').trim();
    const candidates = Object.values(db.rooms)
      .filter((r) => {
        pruneRoomParticipants(r);
        if ((r.accessMode || 'invite-only') !== 'random') return false;
        if (r.raceStatus !== 'idle') return false;
        if (r.participants.length >= (r.maxPlayers || 5)) return false;
        if (playerId && Array.isArray(r.kickedIds) && r.kickedIds.includes(playerId)) return false;
        if (playerId && r.participants.some((p) => p.id === playerId)) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (candidates.length === 0) {
      res.status(404).json({ ok: false, error: 'Nenhuma sala aleatória disponível.' });
      return;
    }

    res.json({ ok: true, room: candidates[0], serverTime: Date.now() });
  });

  app.get('/api/rooms/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = db.rooms[code];
    if (!room) {
      res.status(404).json({ ok: false, error: 'Sala não encontrada.' });
      return;
    }
    pruneRoomParticipants(room);
    res.json({ ok: true, room, serverTime: Date.now() });
  });

  app.delete('/api/rooms/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const existed = Boolean(db.rooms[code]);
    if (existed) {
      delete db.rooms[code];
      saveDb(db);
    }

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
    const code = String(req.params.code || '').trim().toUpperCase();
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
      room = {
        code,
        title: (body.title || `Arena ${code}`).trim(),
        hostName: (body.hostName || 'Anfitrião').trim(),
        maxPlayers: clampMaxPlayers(body.maxPlayers, 5),
        betAmount: clampRoomBet(body.betAmount, 500),
        fillWithBots: body.fillWithBots ?? true,
        isDemo: body.isDemo ?? true,
        accessMode: normalizeAccessMode(body.accessMode),
        createdAt: now,
        updatedAt: now,
        raceStatus: 'idle',
        raceRound: 1,
        raceStartAt: null,
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
      if (room.kickedIds.includes(body.player.id)) {
        res.status(403).json({
          ok: false,
          kicked: true,
          error: 'Foste removido desta sala pelo anfitrião.',
        });
        return;
      }

      const existingIdx = room.participants.findIndex((p) => p.id === body.player!.id);
      if (existingIdx >= 0) {
        const isExistingHost = room.participants[existingIdx].isHost;
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
        room.participants.push({
          id: body.player.id,
          name: body.player.name || `Amigo ${room.participants.length + 1}`,
          avatar: body.player.avatar || '⚡',
          avatarId: body.player.avatarId || 'rei-zero',
          color: body.player.color || '#38bdf8',
          isHost: room.participants.length === 0,
          joinedAt: now,
          lastSeenAt: now,
          progressDistance: 0,
          lane: room.participants.length % 5,
          action: 'running',
          jumpY: 0,
        });
      }
    }

    room.updatedAt = now;
    saveDb(db);
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

    if (!targetId || targetId === requesterId) {
      res.status(400).json({ ok: false, error: 'Jogador alvo inválido.' });
      return;
    }

    if (!Array.isArray(room.kickedIds)) room.kickedIds = [];
    if (!room.kickedIds.includes(targetId)) {
      room.kickedIds.push(targetId);
    }

    room.participants = room.participants.filter((p) => p.id !== targetId);
    room.updatedAt = Date.now();
    saveDb(db);

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

    const now = Date.now();
    room.raceStatus = 'starting';
    room.raceRound = (room.raceRound || 1) + 1;
    room.raceStartAt = now + 2450; // Sincroniza contagem regressiva de ~2.45s
    room.updatedAt = now;
    room.participants = room.participants.map((p, idx) => ({
      ...p,
      progressDistance: 0,
      lane: idx % 5,
      action: 'running',
      jumpY: 0,
      lastSeenAt: now,
    }));

    saveDb(db);
    res.json({ ok: true, room, serverTime: now });
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
    if (body.playerId) {
      const participant = room.participants.find((p) => p.id === body.playerId);
      if (participant) {
        if (typeof body.progressDistance === 'number') {
          participant.progressDistance = body.progressDistance;
        }
        if (typeof body.lane === 'number') participant.lane = body.lane;
        if (typeof body.action === 'string') participant.action = body.action;
        if (typeof body.jumpY === 'number') participant.jumpY = body.jumpY;
        participant.lastSeenAt = now;
      }
    }

    if (body.raceStatus) {
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

    res.json({
      ok: true,
      serverTime: Date.now(),
      storedMatches: db.matches.length,
      activeRoomsCount: roomsList.length,
      activeVoicePeersCount,
      rooms: roomsList.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20),
      voiceChannels,
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
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws/voice') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
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
          targetPeerId?: string;
          sdp?: unknown;
          candidate?: unknown;
        };

        if (!msg || !msg.type) return;

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

          broadcastToVoiceRoom(
            senderRef.roomKey,
            {
              type: 'voice:peer-state',
              peerId: sender.peerId,
              muted: sender.muted,
              deafened: sender.deafened,
              speaking: sender.speaking,
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
