import { useState, useEffect } from 'react';

export interface OfflineMatchRecord {
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

const STORAGE_KEY = 'rei_run_offline_records';
const STATS_KEY = 'rei_run_global_stats';
const DEVICE_ID_KEY = 'rei_run_device_id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

const SESSION_PLAYER_ID_KEY = 'rei_run_session_player_id';
const SESSION_CREATED_ROOMS_KEY = 'rei_run_created_rooms';

export function getSessionPlayerId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem(SESSION_PLAYER_ID_KEY);
    if (!id) {
      id = `PLY-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      sessionStorage.setItem(SESSION_PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return getDeviceId();
  }
}

export function restoreSessionPlayerId(candidateId: string | undefined | null): string {
  if (typeof window === 'undefined' || !candidateId) return getSessionPlayerId();
  const clean = candidateId.trim();
  if (!clean) return getSessionPlayerId();
  try {
    sessionStorage.setItem(SESSION_PLAYER_ID_KEY, clean);
  } catch {
    // Ignore storage errors
  }
  return clean;
}

export function markCreatedRoomSession(roomCode: string, creatorId: string): void {
  if (typeof window === 'undefined' || !roomCode || !creatorId) return;
  const code = roomCode.trim().toUpperCase();
  try {
    const raw = sessionStorage.getItem(SESSION_CREATED_ROOMS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[code] = creatorId;
    sessionStorage.setItem(SESSION_CREATED_ROOMS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function getCreatedRoomCreatorId(roomCode: string): string | null {
  if (typeof window === 'undefined' || !roomCode) return null;
  const code = roomCode.trim().toUpperCase();
  try {
    const historyState = window.history.state as { reiCreatorRoom?: string; reiCreatorId?: string } | null;
    if (
      historyState &&
      typeof historyState.reiCreatorRoom === 'string' &&
      historyState.reiCreatorRoom.toUpperCase() === code &&
      typeof historyState.reiCreatorId === 'string' &&
      historyState.reiCreatorId.trim()
    ) {
      return historyState.reiCreatorId.trim();
    }
  } catch {
    // Ignore history access errors
  }
  try {
    const raw = sessionStorage.getItem(SESSION_CREATED_ROOMS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return typeof map[code] === 'string' && map[code].trim() ? map[code].trim() : null;
  } catch {
    return null;
  }
}

export function clearCreatedRoomSession(roomCode?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!roomCode) {
      sessionStorage.removeItem(SESSION_CREATED_ROOMS_KEY);
      return;
    }
    const code = roomCode.trim().toUpperCase();
    const raw = sessionStorage.getItem(SESSION_CREATED_ROOMS_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, string>;
    delete map[code];
    sessionStorage.setItem(SESSION_CREATED_ROOMS_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Desconhecido';
  const ua = navigator.userAgent;
  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
    ? 'iPhone/iPad'
    : /windows/i.test(ua)
    ? 'Windows'
    : /mac/i.test(ua)
    ? 'Mac'
    : 'Linux/Outro';
  const browser = /edg/i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
    ? 'Chrome'
    : /safari/i.test(ua)
    ? 'Safari'
    : /firefox|fxios/i.test(ua)
    ? 'Firefox'
    : 'Browser';
  return `${os} · ${browser}`;
}

/**
 * Hook para detectar conectividade online/offline em tempo real no dispositivo
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Ao voltar a ter internet / saldo, sincroniza automaticamente
      syncPendingMatchesToServer().catch(() => {});
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Tenta sincronizar pendências ao montar se já estiver online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncPendingMatchesToServer().catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Salva uma corrida concluída no telemóvel e envia ao servidor (ou mantém na fila se offline)
 */
export function saveRaceRecord(
  match: Omit<OfflineMatchRecord, 'id' | 'timestamp' | 'synced' | 'deviceId' | 'deviceLabel'>
): OfflineMatchRecord {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

  const newRecord: OfflineMatchRecord = {
    ...match,
    id: `RACE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: Date.now(),
    synced: false, // Só passa a true quando o servidor confirmar receção HTTP 200
    deviceId: getDeviceId(),
    deviceLabel: getDeviceLabel(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
  };

  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    const records: OfflineMatchRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
    records.unshift(newRecord);
    // Guarda até os últimos 150 registos no dispositivo
    if (records.length > 150) records.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

    updateLocalStats(newRecord);

    // Se estiver online, envia imediatamente ao servidor em segundo plano
    if (isOnline) {
      sendBatchToServer([newRecord]).then((syncedIds) => {
        if (syncedIds.includes(newRecord.id)) {
          markRecordsSynced(syncedIds);
        }
      });
    }
  } catch (err) {
    console.error('Erro ao guardar corrida localmente:', err);
  }

  return newRecord;
}

function updateLocalStats(record: OfflineMatchRecord) {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const stats = raw ? JSON.parse(raw) : { totalRaces: 0, totalPrizesKz: 0, topRankCount: 0 };
    stats.totalRaces = (stats.totalRaces || 0) + 1;
    stats.totalPrizesKz = (stats.totalPrizesKz || 0) + (record.prizeKz || 0);
    if (record.playerRank <= 3) {
      stats.topRankCount = (stats.topRankCount || 0) + 1;
    }
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota issues
  }
}

function markRecordsSynced(syncedIds: string[]) {
  try {
    const idSet = new Set(syncedIds);
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    if (!existingRaw) return;
    const records: OfflineMatchRecord[] = JSON.parse(existingRaw);
    const now = Date.now();
    const updated = records.map((r) =>
      idSet.has(r.id) ? { ...r, synced: true, syncedAt: now } : r
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('rei-run-sync-updated'));
  } catch {
    // Ignore
  }
}

/**
 * Envia lote de partidas para o servidor real (/api/matches/sync)
 */
async function sendBatchToServer(records: OfflineMatchRecord[]): Promise<string[]> {
  if (records.length === 0) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('/api/matches/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];
    const data = (await resp.json()) as { ok?: boolean; syncedIds?: string[] };
    return data.ok && Array.isArray(data.syncedIds) ? data.syncedIds : [];
  } catch {
    return [];
  }
}

/**
 * Sincroniza todas as corridas que foram disputadas offline quando a ligação é restabelecida
 */
export async function syncPendingMatchesToServer(): Promise<{ syncedCount: number; pendingCount: number }> {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    if (!existingRaw) return { syncedCount: 0, pendingCount: 0 };

    const records: OfflineMatchRecord[] = JSON.parse(existingRaw);
    const pending = records.filter((r) => !r.synced);

    if (pending.length === 0) {
      return { syncedCount: 0, pendingCount: 0 };
    }

    const syncedIds = await sendBatchToServer(pending);
    if (syncedIds.length > 0) {
      markRecordsSynced(syncedIds);
    }

    return {
      syncedCount: syncedIds.length,
      pendingCount: pending.length - syncedIds.length,
    };
  } catch (err) {
    console.error('Erro na sincronização de partidas pendentes:', err);
    return { syncedCount: 0, pendingCount: 0 };
  }
}

/**
 * Retorna contagem de partidas guardadas localmente pendentes de sincronização
 */
export function getPendingSyncCount(): number {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    if (!existingRaw) return 0;
    const records: OfflineMatchRecord[] = JSON.parse(existingRaw);
    return records.filter((r) => !r.synced).length;
  } catch {
    return 0;
  }
}

/**
 * Retorna histórico de todas as corridas locais
 */
export function getAllOfflineRecords(): OfflineMatchRecord[] {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    return existingRaw ? JSON.parse(existingRaw) : [];
  } catch {
    return [];
  }
}

/**
 * Busca partidas sincronizadas no servidor (para o Painel Administrativo)
 */
export async function fetchServerMatches(): Promise<OfflineMatchRecord[]> {
  try {
    const resp = await fetch('/api/matches');
    if (!resp.ok) return [];
    const data = (await resp.json()) as { ok?: boolean; matches?: OfflineMatchRecord[] };
    return data.ok && Array.isArray(data.matches) ? data.matches : [];
  } catch {
    return [];
  }
}
