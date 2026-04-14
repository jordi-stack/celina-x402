import type { FastifyPluginAsync } from 'fastify';
import type { TrenchesClient } from '@x402/onchain-clients';

interface PluginOpts {
  trenchesClient: TrenchesClient;
}

export const trenchScanRoute: FastifyPluginAsync<PluginOpts> = async (fastify, opts) => {
  fastify.post(
    '/v1/trench-scan',
    {
      config: {
        x402: { amount: '2000', service: 'trench-scan' },
      },
      schema: {
        body: {
          type: 'object',
          required: ['tokenAddress'],
          properties: {
            tokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as { tokenAddress: string };
      const [devInfo, bundleInfo] = await Promise.all([
        opts.trenchesClient.tokenDevInfo(body.tokenAddress),
        opts.trenchesClient.bundleInfo(body.tokenAddress),
      ]);
      return {
        service: 'trench-scan',
        data: {
          dev: devInfo.devHoldingInfo,
          bundle: bundleInfo,
          riskLevel: computeRiskLevel(devInfo, bundleInfo),
        },
        servedAt: Date.now(),
      };
    }
  );
};

function computeRiskLevel(
  devInfo: { devHoldingInfo: { rugPullCount: number } | null },
  bundleInfo: { bundleDetected: boolean; sniperCount: number }
): 'low' | 'medium' | 'high' {
  const rugCount = devInfo.devHoldingInfo?.rugPullCount ?? 0;
  if (rugCount >= 3 || bundleInfo.sniperCount > 10) return 'high';
  if (rugCount >= 1 || bundleInfo.bundleDetected) return 'medium';
  return 'low';
}
