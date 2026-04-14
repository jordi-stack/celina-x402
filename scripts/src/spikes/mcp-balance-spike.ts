#!/usr/bin/env tsx
/**
 * Move 1 Spike: capture live response shape for MCP balance tool
 *
 * Tool under test: dex-okx-balance-specific-token-balance
 *
 * Also probes dex-okx-balance-chains (no-arg sanity check) and
 * dex-okx-balance-total-token-balances as a fallback candidate.
 *
 * Writes findings to scripts/src/spikes/findings/mcp-balance-spike.md
 * so the shape lives in git history for future schema audits.
 */
import { config as loadEnv } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  OKX_MCP_ENDPOINT,
  USDG_CONTRACT,
  X_LAYER_CHAIN_ID,
} from '@x402/shared';

loadEnv();

const CONSUMER_ADDRESS = '0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25';
const PRODUCER_ADDRESS = '0xdfe57c7775f09599d12d11370a0afcb27f6aadbc';

interface ToolResult {
  tool: string;
  variant: string;
  args: Record<string, unknown>;
  ok: boolean;
  status?: number;
  duration_ms: number;
  raw_response: unknown;
  error?: string;
}

async function callMcpTool(
  name: string,
  variant: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const start = Date.now();
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name, arguments: args },
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
      tool: name,
      variant,
      args,
      ok: res.ok && !raw.error,
      status: res.status,
      duration_ms: Date.now() - start,
      raw_response: raw,
    };
  } catch (e) {
    return {
      tool: name,
      variant,
      args,
      ok: false,
      duration_ms: Date.now() - start,
      raw_response: null,
      error: (e as Error).message,
    };
  }
}

async function run() {
  if (!process.env.OKX_API_KEY) {
    console.error('Missing OKX_API_KEY in .env');
    process.exit(1);
  }

  const results: ToolResult[] = [];
  const chain = String(X_LAYER_CHAIN_ID);

  console.log('1/6 specific plural-string (Consumer)...');
  results.push(
    await callMcpTool('dex-okx-balance-specific-token-balance', 'plural-string-consumer', {
      chainIndex: chain,
      address: CONSUMER_ADDRESS,
      tokenContractAddresses: USDG_CONTRACT,
    })
  );

  console.log('2/6 specific plural-string (Producer)...');
  results.push(
    await callMcpTool('dex-okx-balance-specific-token-balance', 'plural-string-producer', {
      chainIndex: chain,
      address: PRODUCER_ADDRESS,
      tokenContractAddresses: USDG_CONTRACT,
    })
  );

  console.log('3/6 specific plural-array...');
  results.push(
    await callMcpTool('dex-okx-balance-specific-token-balance', 'plural-array', {
      chainIndex: chain,
      address: CONSUMER_ADDRESS,
      tokenContractAddresses: [USDG_CONTRACT],
    })
  );

  console.log('4/6 specific plural-with-chains...');
  results.push(
    await callMcpTool('dex-okx-balance-specific-token-balance', 'chains-plural', {
      chains: chain,
      address: CONSUMER_ADDRESS,
      tokenContractAddresses: USDG_CONTRACT,
    })
  );

  console.log('5/6 total-token-balances chains-string (Consumer)...');
  results.push(
    await callMcpTool('dex-okx-balance-total-token-balances', 'chains-string-consumer', {
      chains: chain,
      address: CONSUMER_ADDRESS,
    })
  );

  console.log('6/6 total-token-balances chains-string (Producer)...');
  results.push(
    await callMcpTool('dex-okx-balance-total-token-balances', 'chains-string-producer', {
      chains: chain,
      address: PRODUCER_ADDRESS,
    })
  );

  console.log('\n--- Summary ---');
  for (const r of results) {
    console.log(
      `[${r.ok ? 'OK' : 'FAIL'}] ${r.tool} (${r.variant}) ${r.duration_ms}ms status=${r.status ?? '-'}`
    );
  }

  const md = formatFindings(results);
  const findingsPath = path.join('src', 'spikes', 'findings', 'mcp-balance-spike.md');
  await writeFile(findingsPath, md, 'utf8');
  console.log(`\nFindings: ${findingsPath}`);
}

function formatFindings(results: ToolResult[]): string {
  const lines: string[] = [
    '# MCP Balance Spike Findings',
    '',
    `**Run at:** ${new Date().toISOString()}`,
    `**Endpoint:** ${OKX_MCP_ENDPOINT}`,
    `**Chain:** X Layer (chain index ${X_LAYER_CHAIN_ID})`,
    `**USDG contract:** ${USDG_CONTRACT}`,
    `**Consumer address:** ${CONSUMER_ADDRESS}`,
    `**Producer address:** ${PRODUCER_ADDRESS}`,
    '',
    '## Purpose',
    '',
    'Move 1 of the final score push adds a Live Balance card to the dashboard that',
    'reads Consumer + Producer USDG balance directly from the OKX MCP Server so',
    'the earn-pay-earn loop is visually obvious during the demo. Before writing',
    'Zod schemas from assumed shape (which burned us with swapMode), capture the',
    'real shape live.',
    '',
  ];

  for (const r of results) {
    lines.push(`## \`${r.tool}\` (${r.variant})`);
    lines.push(`- Status: ${r.status ?? '-'}`);
    lines.push(`- Duration: ${r.duration_ms}ms`);
    lines.push(`- OK: ${r.ok}`);
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push('');
    lines.push('### Args');
    lines.push('```json');
    lines.push(JSON.stringify(r.args, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('### Raw Response');
    lines.push('```json');
    lines.push(JSON.stringify(r.raw_response, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

run();
