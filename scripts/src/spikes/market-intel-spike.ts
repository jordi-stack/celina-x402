#!/usr/bin/env tsx
/**
 * Market Intel Spike: capture live response shape for 4 new MCP tools
 * used by the research + signal Producer routes after the 2026-04-15 pivot.
 *
 * Tools under test:
 * 1. dex-okx-market-candlesticks    (OHLCV data for liquidity-health + token-report)
 * 2. dex-okx-market-token-holder    (top holder concentration for token-report)
 * 3. dex-okx-market-trades          (recent trades for whale-watch + token-report)
 * 4. dex-okx-balance-total-value    (USD portfolio value for wallet-risk)
 *
 * Schemas in tools/list are the argument contract. This spike captures the
 * actual response payload shape for every tool so Zod schemas can be derived
 * from reality (z.default is doc-only, see project_x402_smoke_test_bugs_fixed).
 */
import { config as loadEnv } from 'dotenv';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OKX_MCP_ENDPOINT,
  USDG_CONTRACT,
  X_LAYER_CHAIN_ID,
} from '@x402/shared';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSUMER_ADDRESS = '0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25';

interface Probe {
  tool: string;
  variant: string;
  args: Record<string, unknown>;
  ok: boolean;
  status?: number;
  duration_ms: number;
  raw: unknown;
  error?: string;
}

async function callTool(
  tool: string,
  variant: string,
  args: Record<string, unknown>
): Promise<Probe> {
  const start = Date.now();
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: tool, arguments: args },
    id: Math.floor(Math.random() * 1e9),
  };
  try {
    const res = await fetch(OKX_MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
      },
      body: JSON.stringify(body),
    });
    const raw = (await res.json()) as { error?: unknown };
    return {
      tool,
      variant,
      args,
      ok: res.ok && !raw.error,
      status: res.status,
      duration_ms: Date.now() - start,
      raw,
    };
  } catch (e) {
    return {
      tool,
      variant,
      args,
      ok: false,
      duration_ms: Date.now() - start,
      raw: null,
      error: (e as Error).message,
    };
  }
}

async function run() {
  if (!process.env.OKX_API_KEY) {
    console.error('Missing OKX_API_KEY in .env');
    process.exit(1);
  }

  const chain = String(X_LAYER_CHAIN_ID);
  const probes: Probe[] = [];

  console.log('1/6 candlesticks 1m limit=5...');
  probes.push(
    await callTool('dex-okx-market-candlesticks', 'usdg-1m-5', {
      chainIndex: chain,
      tokenContractAddress: USDG_CONTRACT,
      bar: '1m',
      limit: '5',
    })
  );

  console.log('2/6 candlesticks 1H limit=3...');
  probes.push(
    await callTool('dex-okx-market-candlesticks', 'usdg-1H-3', {
      chainIndex: chain,
      tokenContractAddress: USDG_CONTRACT,
      bar: '1H',
      limit: '3',
    })
  );

  console.log('3/6 token-holder default...');
  probes.push(
    await callTool('dex-okx-market-token-holder', 'usdg-all', {
      chainIndex: chain,
      tokenContractAddress: USDG_CONTRACT,
    })
  );

  console.log('4/6 token-holder whale-filtered...');
  probes.push(
    await callTool('dex-okx-market-token-holder', 'usdg-whales', {
      chainIndex: chain,
      tokenContractAddress: USDG_CONTRACT,
      tagFilter: '4',
    })
  );

  console.log('5/6 market-trades recent...');
  probes.push(
    await callTool('dex-okx-market-trades', 'usdg-recent', {
      chainIndex: chain,
      tokenContractAddress: USDG_CONTRACT,
      limit: '10',
    })
  );

  console.log('6/6 balance-total-value Consumer...');
  probes.push(
    await callTool('dex-okx-balance-total-value', 'consumer', {
      address: CONSUMER_ADDRESS,
      chains: chain,
    })
  );

  console.log('\n--- Summary ---');
  for (const p of probes) {
    console.log(
      `[${p.ok ? 'OK' : 'FAIL'}] ${p.tool} (${p.variant}) ${p.duration_ms}ms status=${p.status ?? '-'}`
    );
  }

  const findingsDir = path.join(__dirname, 'findings');
  await mkdir(findingsDir, { recursive: true });
  const findingsPath = path.join(findingsDir, 'market-intel-spike.md');
  await writeFile(findingsPath, formatFindings(probes), 'utf8');
  console.log(`\nFindings: ${findingsPath}`);

  const allOk = probes.every((p) => p.ok);
  if (!allOk) process.exitCode = 1;
}

function formatFindings(probes: Probe[]): string {
  const lines: string[] = [
    '# Market Intel Spike Findings',
    '',
    `**Run at:** ${new Date().toISOString()}`,
    `**Endpoint:** ${OKX_MCP_ENDPOINT}`,
    `**Chain:** X Layer (chain index ${X_LAYER_CHAIN_ID})`,
    `**USDG contract:** ${USDG_CONTRACT}`,
    '',
    '## Purpose',
    '',
    'Pivot 2026-04-15: Celina becomes an Onchain Intelligence Agent. New Producer',
    'routes (token-report, wallet-risk, liquidity-health, whale-watch, new-token-scout)',
    'need these 4 additional MCP tools. This spike captures live response shapes so',
    'Zod schemas are derived from reality, not docs.',
    '',
  ];

  for (const p of probes) {
    lines.push(`## \`${p.tool}\` (${p.variant})`);
    lines.push(`- Status: ${p.status ?? '-'}`);
    lines.push(`- Duration: ${p.duration_ms}ms`);
    lines.push(`- OK: ${p.ok}`);
    if (p.error) lines.push(`- Error: ${p.error}`);
    lines.push('');
    lines.push('### Args');
    lines.push('```json');
    lines.push(JSON.stringify(p.args, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('### Raw Response');
    lines.push('```json');
    lines.push(JSON.stringify(p.raw, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

run();
