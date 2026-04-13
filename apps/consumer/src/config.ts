import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  GROQ_BASE_URL,
  GROQ_PRIMARY_MODEL,
  GROQ_FAST_MODEL,
  USDG_CONTRACT,
  PRODUCER_PORT,
} from '@x402/shared';

// Resolve .env relative to this source file so the loader works regardless
// of which directory pnpm filters into when running `pnpm --filter consumer start`.
// apps/consumer/src/config.ts -> ../../../.env (repo root)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(currentDir, '../../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  groqApiKey: requireEnv('GROQ_API_KEY'),
  groqBaseUrl: process.env.GROQ_BASE_URL ?? GROQ_BASE_URL,
  groqPrimaryModel: process.env.GROQ_PRIMARY_MODEL ?? GROQ_PRIMARY_MODEL,
  groqFastModel: process.env.GROQ_FAST_MODEL ?? GROQ_FAST_MODEL,
  consumerAccountId: requireEnv('CONSUMER_ACCOUNT_ID'),
  producerUrl: process.env.PRODUCER_URL ?? `http://localhost:${PRODUCER_PORT}`,
  usdgContract: USDG_CONTRACT,
  dbPath: process.env.APP_DB_PATH ?? 'data/app.db',
  minBalanceUsdg: Number(process.env.MIN_BALANCE_USDG ?? '0.5'),
  targetCyclesPerMin: Number(process.env.TARGET_CYCLES_PER_MIN ?? '15'),
} as const;
