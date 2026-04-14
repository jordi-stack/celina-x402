#!/usr/bin/env tsx
/**
 * Security CLI Spike: capture live response shape for the 4 okx-security commands
 * used by the research-token-report, research-wallet-risk, and signal routes.
 *
 * Commands under test:
 * 1. onchainos security token-scan --tokens "196:0x..."       (risk flags for USDG)
 * 2. onchainos security tx-scan    --from --to --chain --data (USDG transfer pre-exec)
 * 3. onchainos security approvals  --address --chain          (permit2 / approvals list)
 * 4. onchainos security dapp-scan  --domain                   (phishing / blacklist)
 *
 * Schemas MUST be derived from this spike output, not from docs. `z.default` is
 * doc-only. See commit 4184072 + project_x402_smoke_test_bugs_fixed memory.
 */
import { execa } from 'execa';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { USDG_CONTRACT, X_LAYER_CHAIN_ID } from '@x402/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSUMER_ADDRESS = '0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25';
const PRODUCER_ADDRESS = '0xdfe57c7775f09599d12d11370a0afcb27f6aadbc';

// USDG.transfer(producer, 0.001 USDG) calldata
// selector a9059cbb + padded recipient + padded amount (1e15 wei)
const USDG_TRANSFER_CALLDATA =
  '0xa9059cbb' +
  '000000000000000000000000' +
  PRODUCER_ADDRESS.slice(2) +
  '00000000000000000000000000000000000000000000000000038d7ea4c68000';

interface Probe {
  command: string;
  variant: string;
  args: string[];
  ok: boolean;
  duration_ms: number;
  exit_code: number | null;
  stdout_raw: string;
  parsed: unknown;
  error?: string;
}

async function runCli(
  command: string,
  variant: string,
  args: string[]
): Promise<Probe> {
  const start = Date.now();
  try {
    const { stdout, exitCode } = await execa('onchainos', args, {
      reject: false,
    });
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = { _unparseable: true, preview: stdout.slice(0, 500) };
    }
    const envelope = parsed as { ok?: boolean };
    return {
      command,
      variant,
      args,
      ok: envelope?.ok === true,
      exit_code: exitCode ?? null,
      duration_ms: Date.now() - start,
      stdout_raw: stdout.slice(0, 4000),
      parsed,
    };
  } catch (e) {
    return {
      command,
      variant,
      args,
      ok: false,
      exit_code: null,
      duration_ms: Date.now() - start,
      stdout_raw: '',
      parsed: null,
      error: (e as Error).message,
    };
  }
}

async function run() {
  const chain = String(X_LAYER_CHAIN_ID);
  const probes: Probe[] = [];

  console.log('1/6 token-scan USDG explicit...');
  probes.push(
    await runCli('token-scan', 'usdg-explicit', [
      'security',
      'token-scan',
      '--tokens',
      `${chain}:${USDG_CONTRACT}`,
    ])
  );

  console.log('2/6 token-scan wallet-mode (Consumer)...');
  probes.push(
    await runCli('token-scan', 'wallet-consumer', [
      'security',
      'token-scan',
      '--address',
      CONSUMER_ADDRESS,
      '--chain',
      chain,
    ])
  );

  console.log('3/6 tx-scan USDG transfer...');
  probes.push(
    await runCli('tx-scan', 'usdg-transfer', [
      'security',
      'tx-scan',
      '--from',
      CONSUMER_ADDRESS,
      '--to',
      USDG_CONTRACT,
      '--chain',
      chain,
      '--data',
      USDG_TRANSFER_CALLDATA,
      '--value',
      '0x0',
    ])
  );

  console.log('4/6 approvals Consumer...');
  probes.push(
    await runCli('approvals', 'consumer', [
      'security',
      'approvals',
      '--address',
      CONSUMER_ADDRESS,
      '--chain',
      chain,
      '--limit',
      '10',
    ])
  );

  console.log('5/6 dapp-scan web3.okx.com...');
  probes.push(
    await runCli('dapp-scan', 'okx', [
      'security',
      'dapp-scan',
      '--domain',
      'https://web3.okx.com',
    ])
  );

  console.log('6/6 dapp-scan known-bad control (phishing-style domain)...');
  probes.push(
    await runCli('dapp-scan', 'suspicious-control', [
      'security',
      'dapp-scan',
      '--domain',
      'http://okx-airdrop-claim.net',
    ])
  );

  console.log('\n--- Summary ---');
  for (const p of probes) {
    console.log(
      `[${p.ok ? 'OK' : 'FAIL'}] ${p.command} (${p.variant}) ${p.duration_ms}ms exit=${p.exit_code ?? '-'}`
    );
  }

  const findingsDir = path.join(__dirname, 'findings');
  await mkdir(findingsDir, { recursive: true });
  const findingsPath = path.join(findingsDir, 'security-spike.md');
  await writeFile(findingsPath, formatFindings(probes), 'utf8');
  console.log(`\nFindings: ${findingsPath}`);

  const allOk = probes.every((p) => p.ok || p.command === 'dapp-scan'); // suspicious-control may still return ok=true
  if (!allOk) {
    process.exitCode = 1;
  }
}

function formatFindings(probes: Probe[]): string {
  const lines: string[] = [
    '# Security CLI Spike Findings',
    '',
    `**Run at:** ${new Date().toISOString()}`,
    `**Chain:** X Layer (chain index ${X_LAYER_CHAIN_ID})`,
    `**USDG contract:** ${USDG_CONTRACT}`,
    `**Consumer address:** ${CONSUMER_ADDRESS}`,
    `**Producer address:** ${PRODUCER_ADDRESS}`,
    '',
    '## Purpose',
    '',
    'Pivot 2026-04-15: Celina becomes an Onchain Intelligence Agent. The Producer',
    'will expose 5 research endpoints gated by x402, several of which call the',
    'okx-security CLI suite. This spike captures the live response shape for the',
    '4 security commands so Zod schemas are derived from reality, not docs.',
    '',
    '## Commands under test',
    '',
    '1. `security token-scan` (explicit + wallet-mode variants)',
    '2. `security tx-scan` (EVM pre-execution simulator)',
    '3. `security approvals` (permit2 / ERC-20 approvals list)',
    '4. `security dapp-scan` (phishing / blacklist check)',
    '',
  ];

  for (const p of probes) {
    lines.push(`## \`security ${p.command}\` (${p.variant})`);
    lines.push(`- OK: ${p.ok}`);
    lines.push(`- Exit code: ${p.exit_code ?? '-'}`);
    lines.push(`- Duration: ${p.duration_ms}ms`);
    if (p.error) lines.push(`- Error: ${p.error}`);
    lines.push('');
    lines.push('### Args');
    lines.push('```');
    lines.push(`onchainos ${p.args.join(' ')}`);
    lines.push('```');
    lines.push('');
    lines.push('### Parsed Response');
    lines.push('```json');
    lines.push(JSON.stringify(p.parsed, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

run();
