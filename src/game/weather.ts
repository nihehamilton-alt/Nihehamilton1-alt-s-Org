import { SupportedLanguage, WeatherKind, WeatherState } from '../types/game';
import { createSeededRng } from './engine';

interface WeatherWindow {
  kind: Exclude<WeatherKind, 'clear'>;
  startSec: number;
  endSec: number;
  windDirection: -1 | 1;
  phaseOffset: number;
}

interface CachedWeatherSchedule {
  seed: number;
  windows: [WeatherWindow, WeatherWindow];
}

let cachedSchedule: CachedWeatherSchedule | null = null;

export const createDefaultWeatherState = (): WeatherState => ({
  kind: 'clear',
  intensity: 0,
  speedMultiplier: 1,
  shakeIntensity: 0,
  windDirection: 1,
  gustPulse: 0,
});

const getWeatherSchedule = (seed: number): [WeatherWindow, WeatherWindow] => {
  const normalizedSeed = Math.floor(Math.abs(seed || 1337)) || 1337;
  if (cachedSchedule && cachedSchedule.seed === normalizedSeed) {
    return cachedSchedule.windows;
  }

  const rng = createSeededRng(normalizedSeed ^ 0x5f3759df);
  const firstKind: Exclude<WeatherKind, 'clear'> = rng() < 0.5 ? 'light-rain' : 'wind-gust';
  const secondKind: Exclude<WeatherKind, 'clear'> =
    firstKind === 'light-rain' ? 'wind-gust' : 'light-rain';

  const w1Start = 6.2 + rng() * 1.6;
  const w1Duration = 10.0 + rng() * 2.0;
  const w2Start = 21.4 + rng() * 1.6;
  const w2Duration = 11.0 + rng() * 2.0;

  const windows: [WeatherWindow, WeatherWindow] = [
    {
      kind: firstKind,
      startSec: w1Start,
      endSec: Math.min(19.2, w1Start + w1Duration),
      windDirection: rng() < 0.5 ? -1 : 1,
      phaseOffset: rng() * Math.PI * 2,
    },
    {
      kind: secondKind,
      startSec: w2Start,
      endSec: Math.min(35.8, w2Start + w2Duration),
      windDirection: rng() < 0.5 ? -1 : 1,
      phaseOffset: rng() * Math.PI * 2,
    },
  ];

  cachedSchedule = { seed: normalizedSeed, windows };
  return windows;
};

const smoothStep01 = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export const evaluateRaceWeather = (seed: number, elapsedSeconds: number): WeatherState => {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return createDefaultWeatherState();
  }

  const windows = getWeatherSchedule(seed);
  const rampSec = 1.45;

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    if (elapsedSeconds >= w.startSec && elapsedSeconds <= w.endSec) {
      const fadeIn = smoothStep01((elapsedSeconds - w.startSec) / rampSec);
      const fadeOut = smoothStep01((w.endSec - elapsedSeconds) / rampSec);
      const intensity = Math.min(fadeIn, fadeOut);

      if (w.kind === 'light-rain') {
        const drizzlePulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * 3.1 + w.phaseOffset);
        return {
          kind: 'light-rain',
          intensity,
          speedMultiplier: 1 - 0.08 * intensity,
          shakeIntensity: 0.24 * intensity * (0.7 + 0.3 * drizzlePulse),
          windDirection: w.windDirection,
          gustPulse: drizzlePulse * intensity,
        };
      }

      const gustWave = Math.sin(elapsedSeconds * 2.2 + w.phaseOffset);
      const gustPulse = (0.5 + 0.5 * Math.sin(elapsedSeconds * 3.4 + w.phaseOffset)) * intensity;
      return {
        kind: 'wind-gust',
        intensity,
        speedMultiplier: 1 + gustWave * 0.075 * intensity,
        shakeIntensity: intensity * (0.42 + 0.58 * gustPulse),
        windDirection: w.windDirection,
        gustPulse,
      };
    }
  }

  return createDefaultWeatherState();
};

export interface WeatherUiBadge {
  icon: string;
  label: string;
  effectHint: string;
}

export const getWeatherUiBadge = (kind: WeatherKind, lang: SupportedLanguage): WeatherUiBadge => {
  if (kind === 'light-rain') {
    if (lang === 'pt') {
      return { icon: '🌧️', label: 'Chuva Leve', effectHint: '-8% Tração' };
    }
    if (lang.startsWith('es')) {
      return { icon: '🌧️', label: 'Lluvia Ligera', effectHint: '-8% Tracción' };
    }
    if (lang === 'fr') {
      return { icon: '🌧️', label: 'Pluie Légère', effectHint: '-8% Adhérence' };
    }
    return { icon: '🌧️', label: 'Light Rain', effectHint: '-8% Grip' };
  }

  if (kind === 'wind-gust') {
    if (lang === 'pt') {
      return { icon: '💨', label: 'Rajada Atlântica', effectHint: 'Vento & Vibração' };
    }
    if (lang.startsWith('es')) {
      return { icon: '💨', label: 'Ráfaga Costera', effectHint: 'Viento y Vibración' };
    }
    if (lang === 'fr') {
      return { icon: '💨', label: 'Rafale Côtière', effectHint: 'Vent & Secousse' };
    }
    return { icon: '💨', label: 'Wind Gust', effectHint: 'Speed & Shake' };
  }

  if (lang === 'pt') {
    return { icon: '☀️', label: 'Céu Limpo', effectHint: 'Pista Seca' };
  }
  if (lang.startsWith('es')) {
    return { icon: '☀️', label: 'Despejado', effectHint: 'Pista Seca' };
  }
  if (lang === 'fr') {
    return { icon: '☀️', label: 'Ciel Clair', effectHint: 'Piste Sèche' };
  }
  return { icon: '☀️', label: 'Clear', effectHint: 'Dry Track' };
};
