import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SUBAGENT_PORT,
  PRODUCER_PORT,
  OKX_FACILITATOR_BASE,
} from '@x402/shared';

// Resolve .env relative to this source file so the loader works regardless
// of which directory pnpm filters into when running `dev:subagent`.
// apps/subagent/src/config.ts -> ../../../.env (repo root)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
loadEnv({ path: path.resolve(repoRoot, '.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.SUBAGENT_PORT ?? SUBAGENT_PORT),
  // Subagent acts as both an x402 RECEIVER (Consumer pays it) and an x402
  // SIGNER (it pays Producer). As a receiver it needs an address to payTo.
  // As a signer it needs the account id to switch to before signing.
  subagentAddress: requireEnv('SUBAGENT_ADDRESS'),
  subagentAccountId: requireEnv('SUBAGENT_ACCOUNT_ID'),
  // Where to reach the Producer to buy raw research inputs.
  producerUrl: process.env.PRODUCER_URL ?? `http://localhost:${PRODUCER_PORT}`,
  // Facilitator auth lives in the same OKX AK as Producer + Consumer,
  // so env var names are shared.
  okxApiKey: requireEnv('OKX_API_KEY'),
  okxSecretKey: requireEnv('OKX_SECRET_KEY'),
  okxPassphrase: requireEnv('OKX_PASSPHRASE'),
  facilitatorBase: process.env.OKX_FACILITATOR_BASE_URL ?? OKX_FACILITATOR_BASE,
  dbPath: process.env.APP_DB_PATH ?? path.join(repoRoot, 'data/app.db'),
} as const;
