import { describe, it, expect } from 'vitest';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { signOkxRequest } from '../../packages/okx-auth/src/sign';
import {
  FACILITATOR_PATHS,
  OKX_FACILITATOR_BASE,
} from '../../packages/shared/src/constants';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../..');
loadEnv({ path: path.resolve(repoRoot, '.env') });

const SKIP = process.env.RUN_INTEGRATION !== '1';

describe.skipIf(SKIP)('facilitator integration', () => {
  it('GET /supported returns list of schemes for X Layer', async () => {
    const { timestamp, signature } = signOkxRequest({
      method: 'GET',
      path: FACILITATOR_PATHS.supported,
      secretKey: process.env.OKX_SECRET_KEY!,
    });
    const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
      headers: {
        'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': process.env.OKX_PASSPHRASE!,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: string | number; data: { kinds: unknown[] } };
    expect(String(body.code)).toBe('0');
    expect(Array.isArray(body.data.kinds)).toBe(true);
    expect(body.data.kinds.length).toBeGreaterThan(0);
  }, 30_000);
});
