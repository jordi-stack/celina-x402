#!/usr/bin/env tsx
/**
 * Day 1 Spike: OKX MCP Server schema capture
 *
 * Calls real MCP tools and captures response shapes so we can
 * refine Zod schemas in @x402/shared.
 *
 * Tools tested:
 * - dex-okx-dex-aggregator-supported-chains (sanity)
 * - dex-okx-dex-quote (swap-quote service backend)
 * - dex-okx-market-token-price-info (market-snapshot service backend)
 */
import { config as loadEnv } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  OKX_MCP_ENDPOINT,
  USDG_CONTRACT,
  USDT_CONTRACT,
  X_LAYER_CHAIN_ID,
} from '@x402/shared';

loadEnv();

interface ToolResult {
  tool: string;
  ok: boolean;
  status?: number;
  duration_ms: number;
  raw_response: unknown;
  error?: string;
}

async function callMcpTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
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
    const raw = await res.json();
    return {
      tool: name,
      ok: res.ok && !(raw as { error?: unknown }).error,
      status: res.status,
      duration_ms: Date.now() - start,
      raw_response: raw,
    };
  } catch (e) {
    return {
      tool: name,
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

  console.log('Calling dex-okx-dex-aggregator-supported-chains...');
  results.push(await callMcpTool('dex-okx-dex-aggregator-supported-chains', {}));

  console.log('Calling dex-okx-dex-quote...');
  results.push(
    await callMcpTool('dex-okx-dex-quote', {
      chainIndex: String(X_LAYER_CHAIN_ID),
      fromTokenAddress: USDG_CONTRACT,
      toTokenAddress: USDT_CONTRACT,
      amount: '1000000',
      slippage: '0.005',
    })
  );

  console.log('Calling dex-okx-market-token-price-info...');
  results.push(
    await callMcpTool('dex-okx-market-token-price-info', {
      chainIndex: String(X_LAYER_CHAIN_ID),
      tokenContractAddress: USDG_CONTRACT,
    })
  );

  for (const r of results) {
    console.log(
      `\n[${r.ok ? 'OK' : 'FAIL'}] ${r.tool} (${r.duration_ms}ms, status=${r.status ?? '-'})`
    );
  }

  const md = formatFindings(results);
  const findingsPath = path.join('scripts', 'src', 'spikes', 'findings', 'mcp-spike.md');
  await writeFile(findingsPath, md, 'utf8');
  console.log(`\nFindings: ${findingsPath}`);

  const allOk = results.every((r) => r.ok);
  if (!allOk) process.exitCode = 1;
}

function formatFindings(results: ToolResult[]): string {
  const lines: string[] = [
    '# MCP Spike Findings',
    '',
    `**Run at:** ${new Date().toISOString()}`,
    `**Endpoint:** ${OKX_MCP_ENDPOINT}`,
    `**Tools tested:** ${results.length}`,
    `**All OK:** ${results.every((r) => r.ok)}`,
    '',
  ];
  for (const r of results) {
    lines.push(`## \`${r.tool}\``);
    lines.push(`- Status: ${r.status ?? '-'}`);
    lines.push(`- Duration: ${r.duration_ms}ms`);
    lines.push(`- OK: ${r.ok}`);
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push('');
    lines.push('### Raw Response');
    lines.push('```json');
    lines.push(JSON.stringify(r.raw_response, null, 2));
    lines.push('```');
    lines.push('');
  }
  lines.push('## Action Items');
  lines.push('');
  lines.push(
    '1. Review response shapes above and update packages/shared/src/types/mcp.ts with strict Zod schemas matching actual data.'
  );
  lines.push('2. Remove .passthrough() from QuoteSchema and TokenPriceInfoSchema once fields are pinned.');
  lines.push('3. Document any unexpected fields or missing fields.');
  return lines.join('\n');
}

run();
