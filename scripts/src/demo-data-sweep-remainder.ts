#!/usr/bin/env tsx
/**
 * Runs the 4 remaining questions that hit Groq TPD limit during the main sweep.
 */
export {};

const CONSUMER_URL = process.env.CONSUMER_URL ?? 'http://localhost:3002';

const TOKENS = {
  WOKB:         '0xe538905cf8410324e03a5a23c1c177a474d59b2b',
  WETH:         '0x5a77f1443d16ee5761d310e38b62f77f726bc71c',
  XLAYER_USDT:  '0x1e4a5963abfd975d8c9021ce480b41188849d41d',
  USDG:         '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
};

const QUESTIONS: string[] = [
  `Full analysis of XLAYER_USDT (${TOKENS.XLAYER_USDT}): security, liquidity, and dev history.`,
  `Is USDG (${TOKENS.USDG}) on X Layer safe and well-distributed? Honeypot check and holder analysis.`,
  `Analyze USDG (${TOKENS.USDG}) liquidity health on X Layer DEXs. Is it liquid enough for large swaps?`,
  `Between WOKB (${TOKENS.WOKB}) and WETH (${TOKENS.WETH}) on X Layer, which has better liquidity and lower risk for a $200 position?`,
];

async function main() {
  console.log('\n=== Celina Demo Sweep (Remainder) ===\n');
  let total = 0n;
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i]!;
    process.stdout.write(`[${i + 1}/${QUESTIONS.length}] ${q.slice(0, 70)}...`);
    try {
      const res = await fetch(`${CONSUMER_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, wait: true }),
      });
      const s = await res.json() as { status?: string; synthesis?: { verdict?: string } | null; totalSpent?: string; calls?: unknown[]; attestation?: unknown; error?: string | null };
      total += BigInt(s.totalSpent ?? '0');
      const ok = s.status === 'done' ? 'OK' : 'FAIL';
      const att = s.attestation ? ' ATT' : '';
      console.log(` ${ok} [${s.calls?.length ?? 0} calls, ${(Number(s.totalSpent ?? '0') / 1e6).toFixed(4)} USDG${att}]`);
      if (s.synthesis?.verdict) console.log(`    verdict: ${s.synthesis.verdict}`);
      if (s.error) console.log(`    error: ${s.error}`);
    } catch (err) {
      console.log(` ERR: ${(err as Error).message}`);
    }
  }
  console.log(`\nTotal USDG: ${(Number(total) / 1e6).toFixed(4)}`);
}

main().catch(console.error);
