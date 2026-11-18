export type MissionStatKey = 'races' | 'coins' | 'podiums' | 'wins';

export interface DailyMission {
  id: string;
  icon: string;
  statKey: MissionStatKey;
  target: number;
  rewardKz: number;
  title: string;
  description: string;
}

export interface DailyMissionsStats {
  races: number;
  coins: number;
  podiums: number;
  wins: number;
}

export interface DailyMissionsState {
  dateKey: string;
  stats: DailyMissionsStats;
  claimedIds: string[];
}

const DAILY_MISSIONS_STORAGE_KEY = 'rei_zero_daily_missions_v1';

export const DAILY_MISSIONS: DailyMission[] = [
  {
    id: 'warm-up',
    icon: '🏁',
    statKey: 'races',
    target: 2,
    rewardKz: 350,
    title: 'Aquecimento na Marginal',
    description: 'Completa 2 corridas oficiais de 40 segundos hoje.',
  },
  {
    id: 'coin-hunter',
    icon: '🪙',
    statKey: 'coins',
    target: 25,
    rewardKz: 500,
    title: 'Caçador de Kwanzas',
    description: 'Apanha 25 moedas douradas durante as corridas.',
  },
  {
    id: 'podium-presence',
    icon: '🏅',
    statKey: 'podiums',
    target: 2,
    rewardKz: 750,
    title: 'Presença no Pódio',
    description: 'Termina no Top 3 da Marginal em 2 corridas.',
  },
  {
    id: 'crown-conquest',
    icon: '👑',
    statKey: 'wins',
    target: 1,
    rewardKz: 1200,
    title: 'Conquista da Coroa',
    description: 'Vence em 1º lugar e sobe ao Trono Real.',
  },
];

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createFreshDailyMissionsState(
  dateKey: string = getLocalDateKey()
): DailyMissionsState {
  return {
    dateKey,
    stats: {
      races: 0,
      coins: 0,
      podiums: 0,
      wins: 0,
    },
    claimedIds: [],
  };
}

export function getMissionProgress(mission: DailyMission, stats: DailyMissionsStats): number {
  return Math.max(0, stats[mission.statKey] ?? 0);
}

export function loadDailyMissionsState(): DailyMissionsState {
  const todayKey = getLocalDateKey();
  if (typeof window === 'undefined') {
    return createFreshDailyMissionsState(todayKey);
  }
  try {
    const raw = localStorage.getItem(DAILY_MISSIONS_STORAGE_KEY);
    if (!raw) return createFreshDailyMissionsState(todayKey);
    const parsed = JSON.parse(raw) as Partial<DailyMissionsState>;
    if (!parsed || parsed.dateKey !== todayKey) {
      return createFreshDailyMissionsState(todayKey);
    }
    return {
      dateKey: todayKey,
      stats: {
        races: Math.max(0, Number(parsed.stats?.races) || 0),
        coins: Math.max(0, Number(parsed.stats?.coins) || 0),
        podiums: Math.max(0, Number(parsed.stats?.podiums) || 0),
        wins: Math.max(0, Number(parsed.stats?.wins) || 0),
      },
      claimedIds: Array.isArray(parsed.claimedIds)
        ? parsed.claimedIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return createFreshDailyMissionsState(todayKey);
  }
}

export function saveDailyMissionsState(state: DailyMissionsState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_MISSIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
