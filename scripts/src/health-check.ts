#!/usr/bin/env tsx
/**
 * Pre-flight validation. Fails fast if any blocker found.
 * Must pass before demo-runner starts the full loop.
 *
 * Spec Section 4.4 checklist adapted for CLI v2.2.8 (non-interactive x402-pay).
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { signOkxRequest } from '@x402/okx-auth';
import {
  OKX_FACILITATOR_BASE,
  OKX_MCP_ENDPOINT,
  X_LAYER_RPC,
  FACILITATOR_PATHS,
  HMAC_CLOCK_SKEW_TOLERANCE_MS,
} from '@x402/shared';
import { migrate } from '@x402/orchestrator';
import { WalletClient, spawnCli } from '@x402/onchain-clients';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../..');
loadEnv({ path: path.resolve(repoRoot, '.env') });

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
}

type CheckFn = () => Promise<string>;

const checks: Array<{ name: string; run: CheckFn }> = [
  {
    name: 'Env vars present',
    run: async () => {
      const required = ['OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE', 'GROQ_API_KEY'];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
      return 'OK';
    },
  },
  {
    name: 'onchainos CLI installed >= 2.2.8',
    run: async () => {
      const r = await spawnCli('onchainos', ['--version']);
      if (r.exitCode !== 0) throw new Error('CLI not installed or not on PATH');
      const match = r.stdout.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!match) throw new Error(`Could not parse version: ${r.stdout}`);
      const major = Number(match[1]);
      const minor = Number(match[2]);
      const patch = Number(match[3]);
      const meetsMin =
        major > 2 || (major === 2 && (minor > 2 || (minor === 2 && patch >= 8)));
      if (!meetsMin) throw new Error(`version ${major}.${minor}.${patch} < 2.2.8 required`);
      return `v${major}.${minor}.${patch}`;
    },
  },
  {
    name: 'X Layer RPC reachable',
    run: async () => {
      const res = await fetch(X_LAYER_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { result?: string };
      if (!data.result) throw new Error('no block number returned');
      return `block ${parseInt(data.result, 16)}`;
    },
  },
  {
    name: 'OKX MCP Server reachable',
    run: async () => {
      const res = await fetch(OKX_MCP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'OK';
    },
  },
  {
    name: 'Facilitator reachable + HMAC auth valid',
    run: async () => {
      const { timestamp, signature } = signOkxRequest({
        method: 'GET',
        path: FACILITATOR_PATHS.supported,
        secretKey: process.env.OKX_SECRET_KEY!,
      });
      const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
        method: 'GET',
        headers: {
          'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': process.env.OKX_PASSPHRASE!,
        },
      });
      if (res.status === 401) throw new Error('HMAC auth failed (401)');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'OK';
    },
  },
  {
    name: 'Clock drift within tolerance',
    run: async () => {
      const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
        method: 'HEAD',
      });
      const serverDate = res.headers.get('Date');
      if (!serverDate) return 'WARN: no server Date header, drift not measured';
      const serverMs = new Date(serverDate).getTime();
      const drift = Math.abs(Date.now() - serverMs);
      if (drift > HMAC_CLOCK_SKEW_TOLERANCE_MS) {
        throw new Error(`drift ${drift}ms > ${HMAC_CLOCK_SKEW_TOLERANCE_MS}ms tolerance`);
      }
      return `drift ${drift}ms`;
    },
  },
  {
    name: 'Groq API key valid',
    run: async () => {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      });
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      return 'OK';
    },
  },
  {
    name: 'Wallet logged in + 2 accounts present',
    run: async () => {
      const client = new WalletClient();
      const status = await client.status();
      if (!status.loggedIn) throw new Error('not logged in');
      if (status.accountCount < 2) {
        throw new Error(
          `need 2 accounts, have ${status.accountCount}. Run: onchainos wallet add`
        );
      }
      return `logged in, ${status.accountCount} accounts`;
    },
  },
  {
    name: 'Producer + Consumer account IDs set in env',
    run: async () => {
      if (!process.env.PRODUCER_ACCOUNT_ID) {
        throw new Error('PRODUCER_ACCOUNT_ID not set in .env');
      }
      if (!process.env.CONSUMER_ACCOUNT_ID) {
        throw new Error('CONSUMER_ACCOUNT_ID not set in .env');
      }
      if (process.env.PRODUCER_ACCOUNT_ID === process.env.CONSUMER_ACCOUNT_ID) {
        throw new Error('PRODUCER_ACCOUNT_ID and CONSUMER_ACCOUNT_ID must differ');
      }
      return 'OK';
    },
  },
  {
    name: 'Producer address is valid 0x EVM address',
    run: async () => {
      const addr = process.env.PRODUCER_ADDRESS;
      if (!addr) throw new Error('PRODUCER_ADDRESS not set in .env');
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        throw new Error(`PRODUCER_ADDRESS ${addr} is not a valid 0x EVM address`);
      }
      return addr;
    },
  },
  {
    name: 'x402-payment CLI is callable (non-interactive in v2.2.8)',
    run: async () => {
      // v2.2.8 has no --force flag and is non-interactive by design.
      // Probe with an empty accepts array: the CLI should error fast without
      // prompting, confirming the command is callable.
      const r = await spawnCli('onchainos', ['payment', 'x402-pay', '--accepts', '[]']);
      // Expect exit 1 with a JSON error mentioning "empty" or similar.
      if (r.exitCode === 0) {
        return 'WARN: unexpected success on empty accepts';
      }
      if (!/accepts|empty|error/i.test(`${r.stdout}${r.stderr}`)) {
        throw new Error(`unexpected CLI output: ${r.stdout || r.stderr}`);
      }
      return 'OK (non-interactive)';
    },
  },
  {
    name: 'Consumer USDG balance >= 1 USDG',
    run: async () => {
      const consumerId = process.env.CONSUMER_ACCOUNT_ID;
      if (!consumerId) throw new Error('CONSUMER_ACCOUNT_ID not set');
      const client = new WalletClient();
      await client.switchAccount(consumerId);
      const balance = (await client.balance({
        chain: 'xlayer',
        tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      })) as { details?: Array<{ tokenAssets?: Array<{ balance?: string }> }> };
      const amount = Number(balance.details?.[0]?.tokenAssets?.[0]?.balance ?? '0');
      if (amount < 1) {
        throw new Error(
          `balance ${amount} USDG < 1 USDG minimum. Fund ${process.env.CONSUMER_ACCOUNT_ID} on X Layer.`
        );
      }
      return `${amount} USDG`;
    },
  },
  {
    name: 'SQLite database writable',
    run: async () => {
      const dbPath = process.env.APP_DB_PATH ?? path.join(repoRoot, 'data/app.db');
      mkdirSync(path.dirname(dbPath), { recursive: true });
      const db = new Database(dbPath);
      migrate(db);
      db.prepare(
        `INSERT INTO audit_events (timestamp, source, kind, cycle_number, payload) VALUES (?, ?, ?, ?, ?)`
      ).run(Date.now(), 'orchestrator', 'HEALTH_CHECK_PROBE', null, '{}');
      db.prepare(`DELETE FROM audit_events WHERE kind = ?`).run('HEALTH_CHECK_PROBE');
      db.close();
      return dbPath;
    },
  },
  {
    name: 'Ports 3000 + 3001 free',
    run: async () => {
      const net = await import('node:net');
      for (const port of [3000, 3001]) {
        try {
          await new Promise<void>((resolve, reject) => {
            const server = net.createServer();
            server.once('error', (err) => {
              server.close();
              reject(err);
            });
            server.once('listening', () => {
              server.close();
              resolve();
            });
            server.listen(port, '127.0.0.1');
          });
        } catch {
          throw new Error(`port ${port} already in use`);
        }
      }
      return 'OK';
    },
  },
];

async function main() {
  console.log('\nx402 Earn-Pay-Earn Pre-flight Health Check\n');
  const results: CheckResult[] = [];
  for (const check of checks) {
    process.stdout.write(`  ${check.name.padEnd(55, '.')} `);
    try {
      const message = await check.run();
      const prefix = message.startsWith('WARN') ? '[WARN]' : '[OK]';
      console.log(`${prefix} ${message}`);
      results.push({ name: check.name, ok: true, message });
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`[FAIL] ${msg}`);
      results.push({ name: check.name, ok: false, message: msg });
    }
  }
  console.log();
  const failed = results.filter((r) => !r.ok).length;
  const warned = results.filter((r) => r.ok && r.message.startsWith('WARN')).length;
  console.log(
    `Summary: ${results.length - failed}/${results.length} passed` +
      (warned ? `, ${warned} warning(s)` : '') +
      (failed ? `, ${failed} failed` : '')
  );
  if (failed > 0) {
    console.error('Fix blockers before running demo-runner.');
    process.exit(1);
  }
  console.log('All checks passed. Ready to run demo.');
}

main().catch((err) => {
  console.error('Health check crashed:', err);
  process.exit(1);
});
