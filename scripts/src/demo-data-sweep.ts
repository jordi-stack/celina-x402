#!/usr/bin/env tsx
/**
 * Pre-populate Celina dashboard with real research sessions across
 * X Layer tokens. Fires questions to Consumer /ask sequentially,
 * logs each result, and writes a summary at the end.
 *
 * Run: pnpm --filter @x402/scripts demo-sweep
 * Prerequisite: Producer (3001) and Consumer (3002) must be running.
 */
export {};

const CONSUMER_URL = process.env.CONSUMER_URL ?? 'http://localhost:3002';

// All tokens with confirmed DEX liquidity on X Layer (chain 196)
const TOKENS = {
  WOKB:         '0xe538905cf8410324e03a5a23c1c177a474d59b2b',
  WETH:         '0x5a77f1443d16ee5761d310e38b62f77f726bc71c',
  USDT:         '0x779ded0c9e1022225f8e0630b35a9b54be713736',
  USDC:         '0x74b7f16337b8972027f6196a17a631ac6de26d22',
  XLAYER_USDT:  '0x1e4a5963abfd975d8c9021ce480b42188849d41d',
  USDG:         '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
};

const QUESTIONS: string[] = [
  // WOKB - OKB wrapped, native X Layer token
  `Is WOKB (${TOKENS.WOKB}) safe to hold on X Layer? Full risk and liquidity analysis.`,
  `Who are the top whale holders of WOKB (${TOKENS.WOKB}) on X Layer? Any concentration risk?`,
  `What is the price impact of swapping 1000 USDG to WOKB (${TOKENS.WOKB})? Is liquidity deep enough?`,

  // WETH - Bridged ETH
  `Analyze WETH (${TOKENS.WETH}) security and liquidity on X Layer. Safe to use in DeFi?`,
  `Is there unusual whale activity around WETH (${TOKENS.WETH}) on X Layer recently?`,
  `Compare WETH (${TOKENS.WETH}) liquidity depth on X Layer - can I swap $500 without major slippage?`,

  // USDT - Bridged stablecoin
  `Is USDT (${TOKENS.USDT}) on X Layer legitimate and safe? Any honeypot or rug pull flags?`,
  `Full security scan of USDT (${TOKENS.USDT}) on X Layer including dev history and holder distribution.`,

  // USDC - Bridged stablecoin
  `Is USDC (${TOKENS.USDC}) properly collateralized and safe on X Layer? Security and liquidity report.`,
  `Analyze USDC (${TOKENS.USDC}) holder concentration and whale risk on X Layer.`,

  // XLAYER_USDT - X Layer native stablecoin
  `What is the risk profile of XLAYER_USDT (${TOKENS.XLAYER_USDT})? Is it safe compared to bridged USDT?`,
  `Full analysis of XLAYER_USDT (${TOKENS.XLAYER_USDT}): security, liquidity, and dev history.`,

  // USDG - Paxos Global Dollar
  `Is USDG (${TOKENS.USDG}) on X Layer safe and well-distributed? Honeypot check and holder analysis.`,
  `Analyze USDG (${TOKENS.USDG}) liquidity health on X Layer DEXs. Is it liquid enough for large swaps?`,

  // Cross-token comparison
  `Between WOKB (${TOKENS.WOKB}) and WETH (${TOKENS.WETH}) on X Layer, which has better liquidity and lower risk for a $200 position?`,
];

interface SessionResult {
  question: string;
  status: string;
  verdict: string | null;
  confidence: string | null;
  totalSpent: string;
  calls: number;
  attestation: boolean;
  sessionId: string;
  durationMs: number;
  error: string | null;
}

async function askQuestion(question: string): Promise<SessionResult> {
  const start = Date.now();
  const res = await fetch(`${CONSUMER_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, wait: true }),
  });
  const session = await res.json() as {
    id?: string;
    status?: string;
    synthesis?: { verdict?: string; confidence?: string } | null;
    totalSpent?: string;
    calls?: unknown[];
    attestation?: unknown;
    error?: string | null;
  };
  return {
    question: question.slice(0, 80) + (question.length > 80 ? '...' : ''),
    status: session.status ?? 'unknown',
    verdict: session.synthesis?.verdict ?? null,
    confidence: session.synthesis?.confidence ?? null,
    totalSpent: session.totalSpent ?? '0',
    calls: session.calls?.length ?? 0,
    attestation: session.attestation !== null && session.attestation !== undefined,
    sessionId: session.id ?? '',
    durationMs: Date.now() - start,
    error: session.error ?? null,
  };
}

function usdg(minimal: string): string {
  return (Number(minimal) / 1_000_000).toFixed(4);
}

async function main() {
  console.log('\n=== Celina Demo Data Sweep ===');
  console.log(`Target: ${CONSUMER_URL}`);
  console.log(`Questions: ${QUESTIONS.length}`);
  console.log('---\n');

  // Quick pre-flight check
  try {
    const h = await fetch(`${CONSUMER_URL}/health`);
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
    console.log('Consumer: OK\n');
  } catch (err) {
    console.error('Consumer not reachable:', err);
    process.exit(1);
  }

  const results: SessionResult[] = [];
  let totalSpentMinimal = 0n;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i]!;
    process.stdout.write(`[${i + 1}/${QUESTIONS.length}] ${q.slice(0, 70)}...`);
    try {
      const r = await askQuestion(q);
      results.push(r);
      totalSpentMinimal += BigInt(r.totalSpent ?? '0');
      const flag = r.status === 'done' ? 'OK' : 'FAIL';
      const attFlag = r.attestation ? ' ATT' : '';
      console.log(` ${flag} [${r.calls} calls, ${usdg(r.totalSpent)} USDG, ${(r.durationMs / 1000).toFixed(1)}s${attFlag}]`);
      if (r.verdict) console.log(`    verdict: ${r.verdict}`);
      if (r.error) console.log(`    error: ${r.error}`);
    } catch (err) {
      console.log(` ERR: ${(err as Error).message}`);
      results.push({
        question: q.slice(0, 80),
        status: 'error',
        verdict: null,
        confidence: null,
        totalSpent: '0',
        calls: 0,
        attestation: false,
        sessionId: '',
        durationMs: 0,
        error: (err as Error).message,
      });
    }
  }

  const done = results.filter((r) => r.status === 'done').length;
  const attested = results.filter((r) => r.attestation).length;

  console.log('\n=== Summary ===');
  console.log(`Completed:  ${done}/${results.length}`);
  console.log(`Attested:   ${attested}/${done}`);
  console.log(`Total USDG: ${usdg(totalSpentMinimal.toString())}`);
  console.log('\nDashboard: http://localhost:3000');
}

main().catch((err) => {
  console.error('Sweep failed:', err);
  process.exit(1);
});
