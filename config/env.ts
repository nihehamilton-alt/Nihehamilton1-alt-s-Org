import 'dotenv/config';
import path from 'path';

export interface ServerConfig {
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  port: number;
  host: string;
  dataDir: string;
  dbFile: string;
  geminiApiKey: string;
  isAiConfigured: boolean;
  appUrl: string;
  disableHmr: boolean;
}

function readEnv(keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return fallback;
}

function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl.replace(/\/+$/, '');
  }
  return `https://${rawUrl.replace(/\/+$/, '')}`;
}

export function loadServerConfig(): ServerConfig {
  const rawNodeEnv = readEnv(['NODE_ENV'], 'development').toLowerCase();
  const nodeEnv: ServerConfig['nodeEnv'] =
    rawNodeEnv === 'production'
      ? 'production'
      : rawNodeEnv === 'test'
      ? 'test'
      : 'development';

  // Prioriza NODE_ENV=production; aceita marcadores padrão de cloud apenas como fallback
  const isCloudHosted = Boolean(
    readEnv([
      'RENDER',
      'VERCEL',
      'AWS_EXECUTION_ENV',
      'AWS_LAMBDA_FUNCTION_NAME',
      'RAILWAY_ENVIRONMENT',
      'FLY_APP_NAME',
      'KOYEB_APP_NAME',
    ])
  );
  const isProduction = nodeEnv === 'production' || isCloudHosted;

  const parsedPort = Number(readEnv(['PORT', 'APP_PORT'], '3000'));
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
  const host = readEnv(['HOST'], '0.0.0.0');

  const rawDataDir = readEnv(['DATA_DIR', 'DB_DIR'], 'data');
  const dataDir = path.resolve(rawDataDir);
  const dbFile = path.join(dataDir, 'rei-run-db.json');

  const rawGeminiKey = readEnv(['GEMINI_API_KEY', 'GOOGLE_API_KEY'], '');
  const geminiApiKey =
    rawGeminiKey && rawGeminiKey !== 'MY_GEMINI_API_KEY' ? rawGeminiKey : '';
  const isAiConfigured = geminiApiKey.length > 0;

  const rawAppUrl = readEnv(
    ['APP_URL', 'PUBLIC_URL', 'RENDER_EXTERNAL_URL', 'VERCEL_URL'],
    `http://localhost:${port}`
  );
  const appUrl = normalizeUrl(rawAppUrl);

  const disableHmr = readEnv(['DISABLE_HMR'], 'false').toLowerCase() === 'true';

  return {
    nodeEnv,
    isProduction,
    port,
    host,
    dataDir,
    dbFile,
    geminiApiKey,
    isAiConfigured,
    appUrl,
    disableHmr,
  };
}
