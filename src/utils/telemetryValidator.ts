import {
  LANE_WIDTH,
  TRACK_LEFT,
  TRACK_WIDTH,
  WAVES,
} from '../game/constants';
import type {
  BatchAnomalyReportPayload,
  CompetitorSessionStatus,
  RemoteRunnerSnapshot,
  TelemetryAnomalyLog,
  TelemetryAnomalyReason,
  TelemetryInvestigationEntry,
} from '../types/game';

// Velocidade máxima física do jogo: WAVES[1] (12.2) * Nitro (1.35) * Dash (1.55) * 1.5 ≈ 38.29 m/s
// Margem técnica para jitter de clock/rede: 45.0 m/s
const MAX_LEGIT_SPEED_MPS = WAVES[1].speed * 1.35 * 1.55 * 1.5 * 1.175;
const EXTREME_BURST_SPEED_MPS = 68.0;
const MAX_LANE_SWITCHES_PER_SEC = 10;
const LANE_SWITCH_WINDOW_MS = 1000;
const VELOCITY_WINDOW_MIN_MS = 140;

const DEFAULT_BATCH_ENDPOINT = '/api/telemetry/anomalies/batch';
const DEFAULT_MAX_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL_MS = 4000;
const DEFAULT_MAX_QUEUE_SIZE = 200;
const DEFAULT_RELOG_THROTTLE_MS = 250;
const MAX_RETRY_ATTEMPTS = 3;

interface QueuedAnomalyLog {
  log: TelemetryAnomalyLog;
  attempts: number;
}

interface CompetitorTelemetryTracker {
  competitorId: string;
  competitorName: string;
  anchorTimestampMs: number;
  anchorDistance: number;
  lastTimestampMs: number;
  lastDistance: number;
  lastLane: number;
  lastTargetLane: number;
  lastLaneX: number;
  consecutiveSpeedSpikes: number;
  anomalyCount: number;
  consecutiveAnomalies: number;
  desyncAlerted: boolean;
  laneSwitchTimestamps: number[];
  sessionStatus: CompetitorSessionStatus;
  investigation?: TelemetryInvestigationEntry;
  lastLoggedAnomalyAt: number;
}

export interface TelemetryValidationResult {
  sessionStatus: CompetitorSessionStatus;
  newlyFlagged: boolean;
  desyncSuspected: boolean;
  newlyDesynced: boolean;
  investigation?: TelemetryInvestigationEntry;
  loggedAnomaly?: TelemetryAnomalyLog;
}

export interface TelemetrySessionContext {
  roomCode?: string;
  raceRound?: number;
  reporterId?: string;
}

export interface ClientTelemetryValidatorOptions {
  endpoint?: string;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  relogThrottleMs?: number;
}

export class ClientTelemetryValidator {
  private trackers = new Map<string, CompetitorTelemetryTracker>();
  private pendingQueue: QueuedAnomalyLog[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private logSequence = 0;

  private roomCode = 'UNKNOWN';
  private raceRound = 0;
  private reporterId = 'anonymous';

  private readonly endpoint: string;
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly relogThrottleMs: number;

  constructor(options: ClientTelemetryValidatorOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_BATCH_ENDPOINT;
    this.maxBatchSize = Math.max(1, options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE);
    this.flushIntervalMs = Math.max(500, options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS);
    this.maxQueueSize = Math.max(10, options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE);
    this.relogThrottleMs = Math.max(0, options.relogThrottleMs ?? DEFAULT_RELOG_THROTTLE_MS);
  }

  setSessionContext(ctx: TelemetrySessionContext): void {
    const nextRoomCode =
      typeof ctx.roomCode === 'string' && ctx.roomCode.trim()
        ? ctx.roomCode.trim().toUpperCase()
        : this.roomCode;

    if (nextRoomCode !== this.roomCode && this.pendingQueue.length > 0) {
      void this.flushBatch();
    }

    this.roomCode = nextRoomCode;
    if (typeof ctx.raceRound === 'number' && Number.isFinite(ctx.raceRound)) {
      this.raceRound = Math.max(0, Math.round(ctx.raceRound));
    }
    if (typeof ctx.reporterId === 'string' && ctx.reporterId.trim()) {
      this.reporterId = ctx.reporterId.trim();
    }
  }

  getPendingQueueSize(): number {
    return this.pendingQueue.length;
  }

  resetAll(): void {
    if (this.pendingQueue.length > 0) {
      void this.flushBatch();
    }
    this.trackers.clear();
  }

  resetKinematicsForNewRound(): void {
    if (this.pendingQueue.length > 0) {
      void this.flushBatch();
    }
    const now = Date.now();
    for (const [id, tracker] of this.trackers.entries()) {
      if (tracker.sessionStatus !== 'investigating') {
        this.trackers.delete(id);
      } else {
        tracker.anchorTimestampMs = now;
        tracker.anchorDistance = 0;
        tracker.lastTimestampMs = now;
        tracker.lastDistance = 0;
        tracker.consecutiveSpeedSpikes = 0;
        tracker.anomalyCount = 0;
        tracker.consecutiveAnomalies = 0;
        tracker.desyncAlerted = false;
        tracker.laneSwitchTimestamps = [];
      }
    }
  }

  removeCompetitor(competitorId: string): void {
    this.trackers.delete(competitorId);
  }

  getInvestigations(): Record<string, TelemetryInvestigationEntry> {
    const out: Record<string, TelemetryInvestigationEntry> = {};
    for (const [id, tracker] of this.trackers.entries()) {
      if (tracker.sessionStatus === 'investigating' && tracker.investigation) {
        out[id] = tracker.investigation;
      }
    }
    return out;
  }

  getDesyncAlerts(): TelemetryInvestigationEntry[] {
    const out: TelemetryInvestigationEntry[] = [];
    for (const tracker of this.trackers.values()) {
      if (tracker.desyncAlerted && tracker.investigation) {
        out.push(tracker.investigation);
      }
    }
    return out;
  }

  inspectTelemetry(
    competitorId: string,
    competitorName: string,
    snapshot: RemoteRunnerSnapshot,
    nowMs: number = Date.now()
  ): TelemetryValidationResult {
    const existing = this.trackers.get(competitorId);
    if (!existing) {
      this.trackers.set(competitorId, {
        competitorId,
        competitorName,
        anchorTimestampMs: nowMs,
        anchorDistance: snapshot.progressDistance,
        lastTimestampMs: nowMs,
        lastDistance: snapshot.progressDistance,
        lastLane: snapshot.lane,
        lastTargetLane: snapshot.targetLane,
        lastLaneX: snapshot.laneX,
        consecutiveSpeedSpikes: 0,
        anomalyCount: 0,
        consecutiveAnomalies: 0,
        desyncAlerted: false,
        laneSwitchTimestamps: [],
        sessionStatus: 'normal',
        lastLoggedAnomalyAt: 0,
      });
      return {
        sessionStatus: 'normal',
        newlyFlagged: false,
        desyncSuspected: false,
        newlyDesynced: false,
      };
    }

    existing.competitorName = competitorName || existing.competitorName;

    let anomalyReason: TelemetryAnomalyReason | null = null;
    let peakSpeedMps: number | undefined;
    let switchesPerSec: number | undefined;

    // 1. Verificação de limites de pista / teletransporte impossível
    const minValidX = TRACK_LEFT - 24;
    const maxValidX = TRACK_LEFT + TRACK_WIDTH + 24;
    if (
      !Number.isFinite(snapshot.laneX) ||
      snapshot.laneX < minValidX ||
      snapshot.laneX > maxValidX ||
      !Number.isFinite(snapshot.progressDistance)
    ) {
      anomalyReason = 'position-teleport';
    }

    // Recuo impossível de distância durante a corrida ativa
    const stepDistDelta = snapshot.progressDistance - existing.lastDistance;
    const stepDtMs = Math.max(1, nowMs - existing.lastTimestampMs);
    if (!anomalyReason && existing.lastDistance > 2 && stepDistDelta < -1.5) {
      anomalyReason = 'position-teleport';
    }

    // Salto instantâneo de distância (>22m em menos de 350ms)
    if (!anomalyReason && stepDtMs <= 350 && stepDistDelta > 22) {
      anomalyReason = 'impossible-speed';
      peakSpeedMps = Number((stepDistDelta / (stepDtMs / 1000)).toFixed(1));
    }

    // 2. Verificação de velocidade em janela temporal estável (>= 140ms para ignorar packet bunching)
    const windowMs = nowMs - existing.anchorTimestampMs;
    let evaluatedCleanVelocityWindow = false;
    if (!anomalyReason && windowMs >= VELOCITY_WINDOW_MIN_MS) {
      const windowDist = snapshot.progressDistance - existing.anchorDistance;
      const windowSpeedMps = windowDist / (windowMs / 1000);

      if (windowSpeedMps > EXTREME_BURST_SPEED_MPS) {
        anomalyReason = 'impossible-speed';
        peakSpeedMps = Number(windowSpeedMps.toFixed(1));
      } else if (windowSpeedMps > MAX_LEGIT_SPEED_MPS) {
        existing.consecutiveSpeedSpikes += 1;
        if (existing.consecutiveSpeedSpikes >= 2) {
          anomalyReason = 'impossible-speed';
          peakSpeedMps = Number(windowSpeedMps.toFixed(1));
        }
      } else {
        existing.consecutiveSpeedSpikes = 0;
        evaluatedCleanVelocityWindow = true;
      }

      existing.anchorTimestampMs = nowMs;
      existing.anchorDistance = snapshot.progressDistance;
    }

    // 3. Frequência anómala de troca de faixa (macro/bot de ziguezague)
    const targetLaneChanged = snapshot.targetLane !== existing.lastTargetLane;
    const laneChanged = snapshot.lane !== existing.lastLane;
    if (targetLaneChanged || laneChanged) {
      existing.laneSwitchTimestamps.push(nowMs);
    }
    const cutoff = nowMs - LANE_SWITCH_WINDOW_MS;
    existing.laneSwitchTimestamps = existing.laneSwitchTimestamps.filter((ts) => ts >= cutoff);

    if (!anomalyReason && existing.laneSwitchTimestamps.length > MAX_LANE_SWITCHES_PER_SEC) {
      anomalyReason = 'lane-switch-flood';
      switchesPerSec = existing.laneSwitchTimestamps.length;
    }

    // Salto lateral impossível (> 2.85 faixas em < 55ms)
    const lateralJumpPx = Math.abs(snapshot.laneX - existing.lastLaneX);
    if (!anomalyReason && stepDtMs < 55 && lateralJumpPx > LANE_WIDTH * 2.85) {
      anomalyReason = 'position-teleport';
    }

    existing.lastTimestampMs = nowMs;
    existing.lastDistance = snapshot.progressDistance;
    existing.lastLane = snapshot.lane;
    existing.lastTargetLane = snapshot.targetLane;
    existing.lastLaneX = snapshot.laneX;

    if (anomalyReason) {
      const wasAlreadyInvestigating = existing.sessionStatus === 'investigating';
      const wasAlreadyDesynced = existing.desyncAlerted;
      existing.anomalyCount += 1;
      existing.consecutiveAnomalies += 1;
      if (existing.consecutiveAnomalies >= 2 || existing.anomalyCount >= 3) {
        existing.desyncAlerted = true;
      }

      const entry: TelemetryInvestigationEntry = {
        competitorId,
        competitorName: existing.competitorName,
        sessionStatus: 'investigating',
        reason: anomalyReason,
        detectedAt: nowMs,
        peakSpeedMps: peakSpeedMps ?? existing.investigation?.peakSpeedMps,
        switchesPerSec: switchesPerSec ?? existing.investigation?.switchesPerSec,
        anomalyCount: existing.anomalyCount,
        consecutiveAnomalies: existing.consecutiveAnomalies,
        desyncSuspected: existing.desyncAlerted,
      };
      existing.sessionStatus = 'investigating';
      existing.investigation = entry;

      let loggedAnomaly: TelemetryAnomalyLog | undefined;
      const shouldLogSample =
        !wasAlreadyInvestigating || nowMs - existing.lastLoggedAnomalyAt >= this.relogThrottleMs;

      if (shouldLogSample) {
        existing.lastLoggedAnomalyAt = nowMs;
        this.logSequence += 1;
        loggedAnomaly = {
          id: `anom-${nowMs}-${this.logSequence}-${competitorId.slice(0, 8)}`,
          roomCode: this.roomCode,
          raceRound: this.raceRound,
          reporterId: this.reporterId,
          competitorId,
          competitorName: existing.competitorName,
          reason: anomalyReason,
          detectedAt: nowMs,
          progressDistance: Number(
            (Number.isFinite(snapshot.progressDistance) ? snapshot.progressDistance : 0).toFixed(2)
          ),
          lane: snapshot.lane,
          targetLane: snapshot.targetLane,
          laneX: Number((Number.isFinite(snapshot.laneX) ? snapshot.laneX : 0).toFixed(2)),
          peakSpeedMps,
          switchesPerSec,
        };
        this.enqueueAnomalyLog(loggedAnomaly);
      }

      return {
        sessionStatus: 'investigating',
        newlyFlagged: !wasAlreadyInvestigating,
        desyncSuspected: existing.desyncAlerted,
        newlyDesynced: !wasAlreadyDesynced && existing.desyncAlerted,
        investigation: entry,
        loggedAnomaly,
      };
    }

    if (evaluatedCleanVelocityWindow) {
      existing.consecutiveAnomalies = 0;
    }

    if (existing.sessionStatus === 'investigating') {
      return {
        sessionStatus: 'investigating',
        newlyFlagged: false,
        desyncSuspected: existing.desyncAlerted,
        newlyDesynced: false,
        investigation: existing.investigation,
      };
    }

    return {
      sessionStatus: 'normal',
      newlyFlagged: false,
      desyncSuspected: existing.desyncAlerted,
      newlyDesynced: false,
    };
  }

  private enqueueAnomalyLog(log: TelemetryAnomalyLog): void {
    if (this.pendingQueue.length >= this.maxQueueSize) {
      this.pendingQueue.shift();
    }
    this.pendingQueue.push({ log, attempts: 0 });

    if (this.pendingQueue.length >= this.maxBatchSize) {
      void this.flushBatch();
      return;
    }

    this.scheduleFlushTimer();
  }

  private scheduleFlushTimer(): void {
    if (this.flushTimer !== null || this.pendingQueue.length === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushBatch();
    }, this.flushIntervalMs);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async flushBatch(useBeacon = false): Promise<boolean> {
    if (this.pendingQueue.length === 0) {
      this.clearFlushTimer();
      return true;
    }

    if (useBeacon) {
      this.clearFlushTimer();
      const batchItems = this.pendingQueue.splice(0, Math.min(50, this.pendingQueue.length));
      const payload = this.buildPayload(batchItems.map((item) => item.log));
      const serialized = JSON.stringify(payload);

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([serialized], { type: 'application/json' });
        const queued = navigator.sendBeacon(this.endpoint, blob);
        if (queued) {
          return true;
        }
      }

      if (typeof fetch === 'function') {
        try {
          const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serialized,
            keepalive: true,
          });
          return res.ok;
        } catch {
          return false;
        }
      }
      return false;
    }

    if (this.isFlushing || typeof fetch !== 'function') {
      return false;
    }

    this.clearFlushTimer();
    this.isFlushing = true;
    let allOk = true;

    try {
      while (this.pendingQueue.length > 0) {
        const batchItems = this.pendingQueue.splice(0, this.maxBatchSize);
        const payload = this.buildPayload(batchItems.map((item) => item.log));

        try {
          const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch {
          allOk = false;
          const retryable = batchItems
            .map((item) => ({ log: item.log, attempts: item.attempts + 1 }))
            .filter((item) => item.attempts < MAX_RETRY_ATTEMPTS);

          if (retryable.length > 0) {
            const availableSlots = Math.max(0, this.maxQueueSize - this.pendingQueue.length);
            if (availableSlots > 0) {
              this.pendingQueue.unshift(...retryable.slice(0, availableSlots));
            }
          }
          break;
        }
      }
    } finally {
      this.isFlushing = false;
      if (this.pendingQueue.length > 0) {
        this.scheduleFlushTimer();
      }
    }

    return allOk;
  }

  private buildPayload(logs: TelemetryAnomalyLog[]): BatchAnomalyReportPayload {
    const primaryLog = logs[0];
    return {
      roomCode: primaryLog?.roomCode || this.roomCode,
      raceRound: primaryLog?.raceRound ?? this.raceRound,
      reporterId: primaryLog?.reporterId || this.reporterId,
      sentAt: Date.now(),
      logs,
    };
  }

  dispose(): void {
    this.clearFlushTimer();
    if (this.pendingQueue.length > 0) {
      void this.flushBatch(true);
    }
    this.trackers.clear();
  }
}
