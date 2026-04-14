import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { SecurityClient } from '@x402/onchain-clients';
import type { Store } from '@x402/orchestrator';
import type {
  ApprovalsPage,
  BalanceTotalValue,
  TokenAsset,
  TotalTokenBalances,
} from '@x402/shared';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  securityClient: SecurityClient;
  store: Store;
}

type Verdict = 'healthy' | 'caution' | 'dangerous';

interface WalletRiskData {
  address: string;
  chainIndex: '196';
  totalValueUsd: string | null;
  assetCount: number;
  riskAssetCount: number;
  riskAssets: Array<{ symbol: string; balance: string; priceUsd: string }>;
  approvals: {
    total: number;
    sampleSize: number;
    entries: unknown[];
  };
  signals: {
    riskScore: number;
    verdict: Verdict;
    reasons: string[];
  };
}

export const researchWalletRiskRoute: FastifyPluginAsync<PluginOpts> = async (
  fastify,
  opts
) => {
  fastify.post(
    '/research/wallet-risk',
    {
      config: {
        // 10000 minimal units = 0.010 USDG
        x402: { amount: '10000', service: 'research-wallet-risk' },
      },
      schema: {
        body: {
          type: 'object',
          required: ['address'],
          properties: {
            address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as { address: string };
      const address = body.address.toLowerCase();
      const start = Date.now();

      const [totalValueRes, balancesRes, approvalsRes] = await Promise.allSettled([
        opts.mcpClient.getBalanceTotalValue({ chains: '196', address }),
        opts.mcpClient.getTotalTokenBalances({ chains: '196', address }),
        opts.securityClient.approvals({ address, chain: '196', limit: 50 }),
      ]);

      const totalValue = unwrap(totalValueRes);
      const balances = unwrap(balancesRes);
      const approvals = unwrap(approvalsRes);

      logCall(opts.store, 'dex-okx-balance-total-value', body, totalValueRes, start);
      logCall(opts.store, 'dex-okx-balance-total-token-balances', body, balancesRes, start);
      logCall(opts.store, 'security-approvals', body, approvalsRes, start);

      const riskSummary = summarizeRiskAssets(balances);
      const { riskScore, verdict, reasons } = score({
        totalValue,
        riskCount: riskSummary.riskAssets.length,
        approvals,
      });

      const data: WalletRiskData = {
        address,
        chainIndex: '196',
        totalValueUsd: totalValue?.totalValue ?? null,
        assetCount: balances?.tokenAssets.length ?? 0,
        riskAssetCount: riskSummary.riskAssets.length,
        riskAssets: riskSummary.riskAssets,
        approvals: {
          total: approvals?.total ?? 0,
          sampleSize: approvals?.dataList.length ?? 0,
          entries: approvals?.dataList ?? [],
        },
        signals: { riskScore, verdict, reasons },
      };

      return { service: 'research-wallet-risk', data, servedAt: Date.now() };
    }
  );
};

function unwrap<T>(res: PromiseSettledResult<T>): T | null {
  return res.status === 'fulfilled' ? res.value : null;
}

function logCall(
  store: Store,
  tool: string,
  args: Record<string, unknown>,
  res: PromiseSettledResult<unknown>,
  start: number
) {
  store.logMcpCall({
    timestamp: Date.now(),
    tool,
    args,
    result:
      res.status === 'fulfilled'
        ? res.value
        : { error: (res.reason as Error)?.message ?? String(res.reason) },
    durationMs: Date.now() - start,
    success: res.status === 'fulfilled',
  });
}

function summarizeRiskAssets(balances: TotalTokenBalances | null) {
  if (!balances) return { riskAssets: [] as WalletRiskData['riskAssets'] };
  const riskAssets = balances.tokenAssets
    .filter((a: TokenAsset) => a.isRiskToken)
    .map((a) => ({
      symbol: a.symbol,
      balance: a.balance,
      priceUsd: a.tokenPrice,
    }));
  return { riskAssets };
}

function score(input: {
  totalValue: BalanceTotalValue | null;
  riskCount: number;
  approvals: ApprovalsPage | null;
}): { riskScore: number; verdict: Verdict; reasons: string[] } {
  let s = 0;
  const reasons: string[] = [];

  if (input.riskCount > 0) {
    s += Math.min(40, input.riskCount * 15);
    reasons.push(`${input.riskCount} risk token(s) held`);
  }

  const approvalTotal = input.approvals?.total ?? 0;
  if (approvalTotal >= 20) {
    s += 30;
    reasons.push(`${approvalTotal} outstanding approvals (high attack surface)`);
  } else if (approvalTotal >= 5) {
    s += 15;
    reasons.push(`${approvalTotal} outstanding approvals`);
  }

  const total = Number(input.totalValue?.totalValue ?? '0');
  if (Number.isFinite(total) && total < 1 && approvalTotal === 0 && input.riskCount === 0) {
    reasons.push('wallet appears empty and unused');
  }

  const clamped = Math.min(100, s);
  const verdict: Verdict =
    clamped >= 50 ? 'dangerous' : clamped >= 20 ? 'caution' : 'healthy';
  return { riskScore: clamped, verdict, reasons };
}
