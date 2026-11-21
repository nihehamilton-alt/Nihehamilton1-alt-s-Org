export interface VoiceActivitySessionLog {
  id: string;
  roomCode: string;
  raceRound: number;
  channelMode: 'private' | 'public';
  playerName: string;
  startedAt: number;
  lastSavedAt: number;
  endedAt: number | null;
  activeVoiceConnectedMs: number;
  micUnmutedMs: number;
  speakingDurationMs: number;
  speakingBurstCount: number;
  peakLevel: number;
  avgSpeakingLevel: number;
  noiseSuppressedEvents: number;
}

const DB_NAME = 'rei_run_voice_analytics';
const DB_VERSION = 1;
const STORE_NAME = 'voice_sessions';
const MAX_STORED_SESSIONS = 50;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openVoiceActivityDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('startedAt', 'startedAt', { unique: false });
          store.createIndex('roomCode', 'roomCode', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

function pruneExcessSessions(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('startedAt');
      const countReq = store.count();

      countReq.onsuccess = () => {
        const excess = countReq.result - MAX_STORED_SESSIONS;
        if (excess <= 0) {
          resolve();
          return;
        }
        let deleted = 0;
        const cursorReq = index.openCursor(null, 'next');
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor || deleted >= excess) {
            resolve();
            return;
          }
          cursor.delete();
          deleted += 1;
          cursor.continue();
        };
        cursorReq.onerror = () => resolve();
      };

      countReq.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function upsertVoiceActivitySession(
  session: VoiceActivitySessionLog
): Promise<boolean> {
  const db = await openVoiceActivityDb();
  if (!db) return false;

  const saved = await new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(session);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });

  if (saved) {
    await pruneExcessSessions(db);
  }
  return saved;
}

export async function listVoiceActivitySessions(
  limit = 30
): Promise<VoiceActivitySessionLog[]> {
  const db = await openVoiceActivityDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('startedAt');
      const items: VoiceActivitySessionLog[] = [];
      const cursorReq = index.openCursor(null, 'prev');

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || items.length >= limit) {
          resolve(items);
          return;
        }
        items.push(cursor.value as VoiceActivitySessionLog);
        cursor.continue();
      };

      cursorReq.onerror = () => resolve(items);
      tx.onabort = () => resolve(items);
    } catch {
      resolve([]);
    }
  });
}

export async function clearVoiceActivitySessions(): Promise<boolean> {
  const db = await openVoiceActivityDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
