#!/usr/bin/env tsx
/**
 * Smoke test for the 5 new Producer research/signal routes.
 *
 * Each route is an aggregation of OnchainOS client calls plus synthesis
 * logic. This script bypasses Fastify + x402 gate and drives the same
 * Promise.allSettled call patterns directly, then prints a compact
 * verdict preview so the scoring heuristics can be eyeballed on real
 * X Layer data before the Consumer + /ask flow goes on top.
 *
 * Not a replacement for end-to-end HTTP smoke — that comes after the
 * Consumer rewrite.  Goal here: confirm live data parses under the
 * new schemas and the synthesis produces sensible verdicts for
 * known-good tokens (USDG, USDT).
 */
import { config as loadEnv } from 'dotenv';
import {
  OKX_MCP_ENDPOINT,
  USDG_CONTRACT,
  USDT_CONTRACT,
  type TokenRiskReport,
  type TokenHolder,
  type TokenPriceInfo,
  type Candlestick,
  type MarketTrade,
  type BalanceTotalValue,
  type TotalTokenBalances,
  type ApprovalsPage,
} from '@x402/shared';
import { OKXMCPClient } from '@x402/mcp-client';
import { SecurityClient, TrenchesClient } from '@x402/onchain-clients';

loadEnv();

const CONSUMER_ADDRESS = '0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25';

function unwrap<T>(res: PromiseSettledResult<T>): T | null {
  return res.status === 'fulfilled' ? res.value : null;
}

function reason(res: PromiseSettledResult<unknown>): string {
  return res.status === 'rejected'
    ? `FAIL: ${(res.reason as Error)?.message ?? String(res.reason)}`
    : 'OK';
}

async function runTokenReport(
  label: string,
  token: string,
  mcp: OKXMCPClient,
  security: SecurityClient,
  trenches: TrenchesClient
) {
  console.log(`\n--- token-report: ${label} ${token} ---`);
  const [priceRes, scanRes, devRes, bundleRes, holdersRes] = await Promise.allSettled([
    mcp.getTokenPriceInfo({
      items: [{ chainIndex: '196', tokenContractAddress: token }],
    }),
    security.tokenScan({ chainId: '196', tokenAddress: token }),
    trenches.tokenDevInfo(token),
    trenches.bundleInfo(token),
    mcp.getTokenHolders({ chainIndex: '196', tokenContractAddress: token }),
  ]);

  console.log(`  price:   ${reason(priceRes)}`);
  console.log(`  scan:    ${reason(scanRes)}`);
  console.log(`  dev:     ${reason(devRes)}`);
  console.log(`  bundle:  ${reason(bundleRes)}`);
  console.log(`  holders: ${reason(holdersRes)}`);

  const price = unwrap(priceRes) as TokenPriceInfo | null;
  const sec = unwrap(scanRes) as TokenRiskReport | null;
  const dev = unwrap(devRes);
  const bundle = unwrap(bundleRes);
  const holders = unwrap(holdersRes) as TokenHolder[] | null;

  const redFlags = collectRedFlags(sec);
  const top10 = holders
    ? holders.slice(0, 10).reduce((s, h) => s + (Number(h.holdPercent) || 0), 0)
    : 0;
  const top1 = holders ? Number(holders[0]?.holdPercent) || 0 : 0;

  const { riskScore, verdict } = scoreTokenReport({
    sec,
    redFlags,
    dev: {
      rugPullCount: dev?.devHoldingInfo?.rugPullCount ?? 0,
      bundleDetected: bundle?.bundleDetected ?? false,
      sniperCount: bundle?.sniperCount ?? 0,
    },
    top1Percent: top1,
    top10Percent: top10,
  });

  console.log(`  => price=$${price?.price ?? '?'} holders=${price?.holders ?? '?'}`);
  console.log(`  => redFlags=[${redFlags.join(', ') || 'none'}]`);
  console.log(`  => top1=${top1.toFixed(2)}%  top10=${top10.toFixed(2)}%`);
  console.log(`  => riskScore=${riskScore} verdict=${verdict}`);
}

async function runWalletRisk(
  label: string,
  address: string,
  mcp: OKXMCPClient,
  security: SecurityClient
) {
  console.log(`\n--- wallet-risk: ${label} ${address} ---`);
  const [totalRes, balRes, apprRes] = await Promise.allSettled([
    mcp.getBalanceTotalValue({ chains: '196', address }),
    mcp.getTotalTokenBalances({ chains: '196', address }),
    security.approvals({ address, chain: '196', limit: 50 }),
  ]);

  console.log(`  total:     ${reason(totalRes)}`);
  console.log(`  balances:  ${reason(balRes)}`);
  console.log(`  approvals: ${reason(apprRes)}`);

  const total = unwrap(totalRes) as BalanceTotalValue | null;
  const balances = unwrap(balRes) as TotalTokenBalances | null;
  const approvals = unwrap(apprRes) as ApprovalsPage | null;

  const riskCount = balances?.tokenAssets.filter((a) => a.isRiskToken).length ?? 0;
  const assetCount = balances?.tokenAssets.length ?? 0;
  const approvalCount = approvals?.total ?? 0;

  const { riskScore, verdict } = scoreWalletRisk({
    riskCount,
    approvalCount,
  });

  console.log(
    `  => totalUsd=${total?.totalValue ?? '?'}  assets=${assetCount}  risky=${riskCount}  approvals=${approvalCount}`
  );
  console.log(`  => riskScore=${riskScore} verdict=${verdict}`);
}

async function runLiquidityHealth(
  label: string,
  token: string,
  mcp: OKXMCPClient
) {
  console.log(`\n--- liquidity-health: ${label} ${token} ---`);
  const probes = [
    { size: '10', amount: '10000000' },
    { size: '100', amount: '100000000' },
    { size: '1000', amount: '1000000000' },
  ];
  const tasks = probes.map((p) =>
    mcp.getQuote({
      chainIndex: '196',
      fromTokenAddress: USDG_CONTRACT,
      toTokenAddress: token,
      amount: p.amount,
      swapMode: 'exactIn',
    })
  );
  const candlesTask = mcp.getCandlesticks({
    chainIndex: '196',
    tokenContractAddress: token,
    bar: '1H',
    limit: '24',
  });

  const results = await Promise.allSettled([...tasks, candlesTask]);
  results.slice(0, 3).forEach((r, i) => {
    console.log(`  quote@${probes[i]!.size} USDG: ${reason(r)}`);
  });
  console.log(`  candles 1H x24: ${reason(results[3]!)}`);

  const impacts = results.slice(0, 3).map((r) => {
    if (r.status !== 'fulfilled') return null;
    const q = (r as PromiseFulfilledResult<{ priceImpactPercent: string }>).value;
    const n = Number(q.priceImpactPercent);
    return Number.isFinite(n) ? n : null;
  });
  const candles =
    results[3]!.status === 'fulfilled'
      ? ((results[3]! as PromiseFulfilledResult<Candlestick[]>).value)
      : null;

  const closes = (candles ?? [])
    .map((c) => Number(c.close))
    .filter((n) => Number.isFinite(n));
  const range =
    closes.length > 0
      ? (Math.max(...closes) - Math.min(...closes)) /
        (closes.reduce((a, b) => a + b, 0) / closes.length)
      : null;

  const { health } = classifyLiquidity({
    impactAt100: impacts[1] ?? null,
    impactAt1000: impacts[2] ?? null,
    range,
  });

  console.log(
    `  => impacts 10/100/1000: ${impacts.map((n) => n?.toFixed(6) ?? 'null').join(' / ')}`
  );
  console.log(`  => range24h=${range != null ? (range * 100).toFixed(2) + '%' : 'null'}`);
  console.log(`  => health=${health}`);
}

async function runWhaleWatch(label: string, token: string, mcp: OKXMCPClient) {
  console.log(`\n--- whale-watch: ${label} ${token} ---`);
  const [tradesRes, holdersRes] = await Promise.allSettled([
    mcp.getMarketTrades({
      chainIndex: '196',
      tokenContractAddress: token,
      limit: '100',
    }),
    mcp.getTokenHolders({ chainIndex: '196', tokenContractAddress: token }),
  ]);

  console.log(`  trades:  ${reason(tradesRes)}`);
  console.log(`  holders: ${reason(holdersRes)}`);

  const trades = (unwrap(tradesRes) as MarketTrade[] | null) ?? [];
  const holders = (unwrap(holdersRes) as TokenHolder[] | null) ?? [];

  const whales = trades.filter((t) => {
    const qty = Number(t.volume);
    const price = Number(t.price);
    return Number.isFinite(qty) && Number.isFinite(price) && qty * price >= 1000;
  });

  let buyUsd = 0;
  let sellUsd = 0;
  for (const t of whales) {
    const usd = Number(t.volume) * Number(t.price);
    if (t.type.toLowerCase() === 'buy') buyUsd += usd;
    else if (t.type.toLowerCase() === 'sell') sellUsd += usd;
  }

  const { sentiment } = classifyWhale(buyUsd, sellUsd);

  console.log(
    `  => trades=${trades.length}  whales>=$1k=${whales.length}  holders=${holders.length}`
  );
  console.log(
    `  => whaleBuyUsd=${buyUsd.toFixed(0)}  whaleSellUsd=${sellUsd.toFixed(0)}  sentiment=${sentiment}`
  );
}

async function runNewTokenScout(
  label: string,
  token: string,
  mcp: OKXMCPClient,
  security: SecurityClient,
  trenches: TrenchesClient
) {
  console.log(`\n--- new-token-scout: ${label} ${token} ---`);
  const [priceRes, candlesRes, scanRes, devRes, bundleRes] = await Promise.allSettled([
    mcp.getTokenPriceInfo({
      items: [{ chainIndex: '196', tokenContractAddress: token }],
    }),
    mcp.getCandlesticks({
      chainIndex: '196',
      tokenContractAddress: token,
      bar: '1m',
      limit: '60',
    }),
    security.tokenScan({ chainId: '196', tokenAddress: token }),
    trenches.tokenDevInfo(token),
    trenches.bundleInfo(token),
  ]);

  console.log(`  price:   ${reason(priceRes)}`);
  console.log(`  candles: ${reason(candlesRes)}`);
  console.log(`  scan:    ${reason(scanRes)}`);
  console.log(`  dev:     ${reason(devRes)}`);
  console.log(`  bundle:  ${reason(bundleRes)}`);

  const price = unwrap(priceRes) as TokenPriceInfo | null;
  const candles = unwrap(candlesRes) as Candlestick[] | null;
  const sec = unwrap(scanRes) as TokenRiskReport | null;
  const dev = unwrap(devRes);
  const bundle = unwrap(bundleRes);

  const blocking = sec
    ? [
        'isHoneypot',
        'isRiskToken',
        'isAirdropScam',
        'isCounterfeit',
        'isLiquidityRemoval',
        'isHasFrozenAuth',
      ].filter((f) => (sec as unknown as Record<string, boolean>)[f])
    : [];

  const ordered = candles ? [...candles].reverse() : [];
  const first = ordered.length > 0 ? Number(ordered[0]!.close) : NaN;
  const last = ordered.length > 0 ? Number(ordered[ordered.length - 1]!.close) : NaN;
  const slope =
    Number.isFinite(first) && Number.isFinite(last) && first !== 0
      ? (last - first) / first
      : null;

  const { score, verdict } = scoreOpportunity({
    price,
    slope,
    dev: {
      rugPullCount: dev?.devHoldingInfo?.rugPullCount ?? 0,
      bundleDetected: bundle?.bundleDetected ?? false,
      sniperCount: bundle?.sniperCount ?? 0,
    },
    blocking,
  });

  console.log(
    `  => price=${price?.price ?? '?'}  24h=${price?.priceChange24H ?? '?'}  1h=${price?.priceChange1H ?? '?'}`
  );
  console.log(
    `  => slope60m=${slope != null ? (slope * 100).toFixed(2) + '%' : 'null'}  blocking=[${blocking.join(',') || 'none'}]`
  );
  console.log(`  => score=${score} verdict=${verdict}`);
}

// ---- Inlined scoring (duplicates route logic for spike purposes) ----

function collectRedFlags(sec: TokenRiskReport | null): string[] {
  if (!sec) return [];
  const keys: (keyof TokenRiskReport)[] = [
    'isHoneypot', 'isRiskToken', 'isMintable', 'isAirdropScam', 'isCounterfeit',
    'isDumping', 'isFakeLiquidity', 'isHasAssetEditAuth', 'isHasFrozenAuth',
    'isLiquidityRemoval', 'isLowLiquidity', 'isNotRenounced', 'isOverIssued',
    'isRubbishAirdrop', 'isVeryHighLpHolderProp', 'isVeryLowLpBurn', 'isWash',
  ];
  const flags: string[] = [];
  for (const k of keys) if (sec[k]) flags.push(k);
  const buyTax = Number(sec.buyTaxes);
  const sellTax = Number(sec.sellTaxes);
  if (Number.isFinite(buyTax) && buyTax >= 0.1) flags.push('highBuyTax');
  if (Number.isFinite(sellTax) && sellTax >= 0.1) flags.push('highSellTax');
  return flags;
}

function scoreTokenReport(input: {
  sec: TokenRiskReport | null;
  redFlags: string[];
  dev: { rugPullCount: number; bundleDetected: boolean; sniperCount: number };
  top1Percent: number;
  top10Percent: number;
}): { riskScore: number; verdict: 'safe' | 'caution' | 'avoid' } {
  let s = 0;
  if (input.sec?.isHoneypot) s += 100;
  if (input.sec?.isRiskToken) s += 40;
  const nonBase = input.redFlags.filter((f) => f !== 'isHoneypot' && f !== 'isRiskToken');
  s += nonBase.length * 8;
  if (input.dev.rugPullCount >= 3) s += 60;
  else if (input.dev.rugPullCount >= 1) s += 25;
  if (input.dev.bundleDetected) s += 15;
  if (input.dev.sniperCount > 10) s += 15;
  if (input.top1Percent >= 70) s += 30;
  else if (input.top10Percent >= 80) s += 15;
  const clamped = Math.min(100, s);
  const verdict = clamped >= 60 ? 'avoid' : clamped >= 25 ? 'caution' : 'safe';
  return { riskScore: clamped, verdict };
}

function scoreWalletRisk(input: {
  riskCount: number;
  approvalCount: number;
}): { riskScore: number; verdict: 'healthy' | 'caution' | 'dangerous' } {
  let s = 0;
  if (input.riskCount > 0) s += Math.min(40, input.riskCount * 15);
  if (input.approvalCount >= 20) s += 30;
  else if (input.approvalCount >= 5) s += 15;
  const clamped = Math.min(100, s);
  const verdict = clamped >= 50 ? 'dangerous' : clamped >= 20 ? 'caution' : 'healthy';
  return { riskScore: clamped, verdict };
}

function classifyLiquidity(input: {
  impactAt100: number | null;
  impactAt1000: number | null;
  range: number | null;
}): { health: 'deep' | 'thin' | 'fragile' } {
  let health: 'deep' | 'thin' | 'fragile' = 'deep';
  if (input.impactAt1000 != null && input.impactAt1000 >= 0.05) health = 'fragile';
  else if (input.impactAt100 != null && input.impactAt100 >= 0.02) health = 'thin';
  if (input.range != null && input.range >= 0.2 && health === 'deep') health = 'thin';
  return { health };
}

function classifyWhale(
  buyUsd: number,
  sellUsd: number
): { sentiment: 'accumulating' | 'distributing' | 'neutral' } {
  const total = buyUsd + sellUsd;
  if (total === 0) return { sentiment: 'neutral' };
  const share = buyUsd / total;
  if (share >= 0.65) return { sentiment: 'accumulating' };
  if (share <= 0.35) return { sentiment: 'distributing' };
  return { sentiment: 'neutral' };
}

function scoreOpportunity(input: {
  price: TokenPriceInfo | null;
  slope: number | null;
  dev: { rugPullCount: number; bundleDetected: boolean; sniperCount: number };
  blocking: string[];
}): { score: number; verdict: 'promising' | 'mixed' | 'skip' } {
  if (input.blocking.length > 0) return { score: 0, verdict: 'skip' };
  let s = 0;
  const c24 = Number(input.price?.priceChange24H ?? '');
  if (Number.isFinite(c24)) {
    if (c24 >= 0.2) s += 20;
    else if (c24 <= -0.3) s -= 15;
  }
  const c1 = Number(input.price?.priceChange1H ?? '');
  if (Number.isFinite(c1) && c1 >= 0.05) s += 15;
  if (input.slope != null) {
    if (input.slope >= 0.02) s += 15;
    else if (input.slope <= -0.02) s -= 10;
  }
  const txs = Number(input.price?.txs1H ?? '');
  if (Number.isFinite(txs) && txs >= 50) s += 10;
  if (input.dev.rugPullCount >= 1) s -= 25;
  if (input.dev.bundleDetected) s -= 10;
  if (input.dev.sniperCount > 10) s -= 10;
  const clamped = Math.max(0, Math.min(100, s));
  const verdict = clamped >= 40 ? 'promising' : clamped >= 15 ? 'mixed' : 'skip';
  return { score: clamped, verdict };
}

// ---- Driver ----

async function main() {
  if (!process.env.OKX_API_KEY) {
    console.error('Missing OKX_API_KEY in .env');
    process.exit(1);
  }

  const mcp = new OKXMCPClient({
    url: OKX_MCP_ENDPOINT,
    apiKey: process.env.OKX_API_KEY,
  });
  const security = new SecurityClient();
  const trenches = new TrenchesClient();

  await runTokenReport('USDG', USDG_CONTRACT, mcp, security, trenches);
  await runTokenReport('USDT', USDT_CONTRACT, mcp, security, trenches);

  await runWalletRisk('consumer', CONSUMER_ADDRESS, mcp, security);

  await runLiquidityHealth('USDT', USDT_CONTRACT, mcp);

  await runWhaleWatch('USDG', USDG_CONTRACT, mcp);
  await runWhaleWatch('USDT', USDT_CONTRACT, mcp);

  await runNewTokenScout('USDG', USDG_CONTRACT, mcp, security, trenches);

  console.log('\nAll smoke tests dispatched.');
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
