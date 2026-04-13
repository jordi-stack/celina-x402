import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  PRODUCER_PORT,
  USDG_CONTRACT,
  OKX_MCP_ENDPOINT,
  OKX_FACILITATOR_BASE,
} from '@x402/shared';

// Resolve .env relative to this source file so the loader works regardless
// of which directory pnpm filters into when running `dev:producer`.
// apps/producer/src/config.ts -> ../../../.env (repo root)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
loadEnv({ path: path.resolve(repoRoot, '.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PRODUCER_PORT ?? PRODUCER_PORT),
  producerAddress: requireEnv('PRODUCER_ADDRESS'),
  producerAccountId: requireEnv('PRODUCER_ACCOUNT_ID'),
  okxApiKey: requireEnv('OKX_API_KEY'),
  okxSecretKey: requireEnv('OKX_SECRET_KEY'),
  okxPassphrase: requireEnv('OKX_PASSPHRASE'),
  mcpEndpoint: process.env.OKX_MCP_SERVER_URL ?? OKX_MCP_ENDPOINT,
  facilitatorBase: process.env.OKX_FACILITATOR_BASE_URL ?? OKX_FACILITATOR_BASE,
  usdgContract: USDG_CONTRACT,
  dbPath: process.env.APP_DB_PATH ?? path.join(repoRoot, 'data/app.db'),
} as const;
