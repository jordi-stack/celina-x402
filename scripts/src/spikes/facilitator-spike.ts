#!/usr/bin/env tsx
/**
 * Day 1 Spike: OKX Facilitator API throughput + happy path
 *
 * Verifies:
 * 1. /api/v6/pay/x402/supported returns expected scheme+network list
 * 2. HMAC signing works against live API (no 401)
 * 3. Throughput: how many requests/min before 429?
 * 4. Latency distribution (p50, p99)
 */
import { config as loadEnv } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { signOkxRequest } from '@x402/okx-auth';
import {
  OKX_FACILITATOR_BASE,
  FACILITATOR_PATHS,
  SupportedResponseSchema,
  OkxApiEnvelopeSchema,
} from '@x402/shared';

loadEnv();

interface Finding {
  timestamp: string;
  supported_endpoint_ok: boolean;
  supported_response: unknown;
  hmac_auth_ok: boolean;
  throughput_rps_before_429: number | null;
  latency_p50_ms: number | null;
  latency_p99_ms: number | null;
  total_requests_sent: number;
  blockers: string[];
  recommendation: string;
}

async function callSupported(): Promise<{ status: number; body: unknown; latencyMs: number }> {
  const secretKey = process.env.OKX_SECRET_KEY!;
  const apiKey = process.env.OKX_API_KEY!;
  const passphrase = process.env.OKX_PASSPHRASE!;

  const { timestamp, signature } = signOkxRequest({
    method: 'GET',
    path: FACILITATOR_PATHS.supported,
    secretKey,
  });

  const start = Date.now();
  const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
    },
  });
  const latencyMs = Date.now() - start;
  const body = await res.json();
  return { status: res.status, body, latencyMs };
}

async function run() {
  const findings: Finding = {
    timestamp: new Date().toISOString(),
    supported_endpoint_ok: false,
    supported_response: null,
    hmac_auth_ok: false,
    throughput_rps_before_429: null,
    latency_p50_ms: null,
    latency_p99_ms: null,
    total_requests_sent: 0,
    blockers: [],
    recommendation: '',
  };

  const requiredEnv = ['OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE'];
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      findings.blockers.push(`Missing env var: ${key}`);
    }
  }
  if (findings.blockers.length > 0) {
    findings.recommendation = 'HALT - missing credentials in .env';
    await writeAndExit(findings);
    return;
  }

  try {
    const first = await callSupported();
    findings.total_requests_sent += 1;
    findings.supported_response = first.body;

    if (first.status === 200) {
      findings.supported_endpoint_ok = true;
      findings.hmac_auth_ok = true;

      try {
        const envelope = OkxApiEnvelopeSchema.parse(first.body);
        if (envelope.code === '0') {
          try {
            const parsed = SupportedResponseSchema.parse(envelope.data);
            console.log(`Supported parsed successfully: ${parsed.kinds?.length ?? 0} kinds`);
          } catch (e) {
            console.log(`SupportedResponseSchema parse failed (non-blocking): ${(e as Error).message}`);
            console.log('Raw supported data captured in findings.');
          }
        } else {
          findings.blockers.push(`API returned non-zero code: ${envelope.code} - ${envelope.msg}`);
        }
      } catch (e) {
        console.log(`Envelope parse failed (non-blocking): ${(e as Error).message}`);
        console.log('Raw response shape will be in findings for later schema refinement.');
      }
    } else if (first.status === 401) {
      findings.blockers.push('HMAC auth failed (401). Check signing algorithm + clock drift.');
    } else {
      findings.blockers.push(`Unexpected status: ${first.status}`);
    }
  } catch (e) {
    findings.blockers.push(`Happy path failed: ${(e as Error).message}`);
  }

  if (findings.blockers.length === 0) {
    console.log('Starting throughput test (max 120 requests)...');
    const latencies: number[] = [];
    let hit429 = false;
    let requestCount = 0;
    const startTs = Date.now();

    while (requestCount < 120 && !hit429 && Date.now() - startTs < 60_000) {
      try {
        const { status, latencyMs } = await callSupported();
        findings.total_requests_sent += 1;
        requestCount += 1;
        latencies.push(latencyMs);

        if (status === 429) {
          hit429 = true;
          findings.throughput_rps_before_429 = requestCount;
          console.log(`Hit 429 at request ${requestCount}`);
        }
        if (requestCount % 20 === 0) {
          console.log(`Progress: ${requestCount} requests...`);
        }
      } catch (e) {
        latencies.push(-1);
      }
    }

    if (!hit429) {
      findings.throughput_rps_before_429 = null;
      console.log(`Reached ${requestCount} requests without 429`);
    }

    const okLatencies = latencies.filter((l) => l > 0).sort((a, b) => a - b);
    if (okLatencies.length > 0) {
      findings.latency_p50_ms = okLatencies[Math.floor(okLatencies.length * 0.5)] ?? null;
      findings.latency_p99_ms = okLatencies[Math.floor(okLatencies.length * 0.99)] ?? null;
    }
  }

  findings.recommendation =
    findings.blockers.length === 0
      ? `PROCEED - Facilitator responsive. Throughput: ${findings.throughput_rps_before_429 ?? '>120'} req before 429. P50: ${findings.latency_p50_ms}ms, P99: ${findings.latency_p99_ms}ms.`
      : `HALT - ${findings.blockers.length} blocker(s).`;

  await writeAndExit(findings);
}

async function writeAndExit(f: Finding) {
  const md = `# Facilitator Spike Findings

**Run at:** ${f.timestamp}
**Total requests sent:** ${f.total_requests_sent}
**Happy path OK:** ${f.supported_endpoint_ok}
**HMAC auth OK:** ${f.hmac_auth_ok}

## Throughput
- First 429 at request: ${f.throughput_rps_before_429 ?? '_not reached within 120 requests / 60s_'}
- Latency P50: ${f.latency_p50_ms ?? '_n/a_'} ms
- Latency P99: ${f.latency_p99_ms ?? '_n/a_'} ms

## Supported Response
\`\`\`json
${JSON.stringify(f.supported_response, null, 2)}
\`\`\`

## Blockers
${f.blockers.length === 0 ? '_None_' : f.blockers.map((b) => `- ${b}`).join('\n')}

## Recommendation
${f.recommendation}
`;
  const findingsPath = path.join('scripts', 'src', 'spikes', 'findings', 'facilitator-spike.md');
  await writeFile(findingsPath, md, 'utf8');
  console.log(`\nFindings: ${findingsPath}\n${f.recommendation}`);
  if (f.blockers.length > 0) process.exitCode = 1;
}

run();
