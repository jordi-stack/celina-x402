import type { FastifyPluginAsync } from 'fastify';
import type { SwapClient } from '@x402/onchain-clients';
import { RESEARCH_SERVICE_CATALOG } from '@x402/shared';

interface PluginOpts {
  swapClient: SwapClient;
  producerAddress: string;
}

const MAX_READABLE_AMOUNT = 0.1; // Hard cap: 0.1 USDG-equivalent per call, demo safety guard
const DEFAULT_READABLE_AMOUNT = '0.005';

export const actionSwapExecRoute: FastifyPluginAsync<PluginOpts> = async (fastify, opts) => {
  const meta = RESEARCH_SERVICE_CATALOG['action-swap-exec'];

  fastify.post(
    meta.path,
    {
      config: {
        x402: {
          amount: meta.priceMinimal,
          service: 'action-swap-exec',
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        fromToken?: unknown;
        toToken?: unknown;
        readableAmount?: unknown;
        slippage?: unknown;
      };

      // Validate required fields
      if (typeof body?.fromToken !== 'string' || !body.fromToken.startsWith('0x')) {
        reply.code(400);
        return { error: 'fromToken (0x address) required' };
      }
      if (typeof body?.toToken !== 'string' || !body.toToken.startsWith('0x')) {
        reply.code(400);
        return { error: 'toToken (0x address) required' };
      }

      // Parse and cap readableAmount
      const rawAmount =
        typeof body.readableAmount === 'string' || typeof body.readableAmount === 'number'
          ? String(body.readableAmount)
          : DEFAULT_READABLE_AMOUNT;
      const parsedAmount = parseFloat(rawAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        reply.code(400);
        return { error: 'readableAmount must be a positive number' };
      }
      const readableAmount = Math.min(parsedAmount, MAX_READABLE_AMOUNT).toString();

      const slippage =
        typeof body.slippage === 'string' || typeof body.slippage === 'number'
          ? String(body.slippage)
          : undefined;

      try {
        const result = await opts.swapClient.execute({
          chain: 'xlayer',
          fromToken: body.fromToken,
          toToken: body.toToken,
          readableAmount,
          walletAddress: opts.producerAddress,
          slippage,
        });

        return {
          txHash: result.txHash,
          fromToken: body.fromToken,
          toToken: body.toToken,
          fromTokenSymbol: result.fromTokenSymbol,
          toTokenSymbol: result.toTokenSymbol,
          fromAmount: result.fromAmount,
          toAmount: result.toAmount,
          priceImpactPercent: result.priceImpactPercent,
          router: result.router,
          explorerUrl: `https://www.oklink.com/xlayer/tx/${result.txHash}`,
        };
      } catch (err) {
        const msg = (err as Error).message;
        request.log.error({ err }, 'action-swap-exec failed');
        reply.code(502);
        return { error: `swap execution failed: ${msg}` };
      }
    }
  );
};
