import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  GROQ_BASE_URL,
  GROQ_PRIMARY_MODEL,
  GROQ_FAST_MODEL,
  USDG_CONTRACT,
  PRODUCER_PORT,
  SUBAGENT_PORT,
  CELINA_ATTESTATION_ADDRESS,
} from '@x402/shared';

// Resolve .env relative to this source file so the loader works regardless
// of which directory pnpm filters into when running `pnpm --filter consumer start`.
// apps/consumer/src/config.ts -> ../../../.env (repo root)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
loadEnv({ path: path.resolve(repoRoot, '.env') });

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
  consumerAccountAddress: requireEnv('CONSUMER_ADDRESS'),
  producerUrl: process.env.PRODUCER_URL ?? `http://localhost:${PRODUCER_PORT}`,
  subagentUrl: process.env.SUBAGENT_URL ?? `http://localhost:${SUBAGENT_PORT}`,
  usdgContract: USDG_CONTRACT,
  celinaAttestationAddress: process.env.CELINA_ATTESTATION_ADDRESS ?? CELINA_ATTESTATION_ADDRESS,
  xlayerRpcUrl: process.env.XLAYER_RPC_URL ?? 'https://rpc.xlayer.tech',
  dbPath: process.env.APP_DB_PATH ?? path.join(repoRoot, 'data/app.db'),
  maxCallsPerSession: Number(process.env.MAX_CALLS_PER_SESSION ?? '4'),
  sessionBudgetUsdg: process.env.SESSION_BUDGET_USDG ?? '0.10',
} as const;
