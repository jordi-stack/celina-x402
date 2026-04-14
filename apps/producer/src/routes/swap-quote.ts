import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { Store } from '@x402/orchestrator';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  store: Store;
}

export const swapQuoteRoute: FastifyPluginAsync<PluginOpts> = async (fastify, opts) => {
  fastify.post(
    '/v1/swap-quote',
    {
      config: {
        x402: { amount: '1500', service: 'swap-quote' },
      },
      schema: {
        body: {
          type: 'object',
          required: ['fromTokenAddress', 'toTokenAddress', 'amount'],
          properties: {
            fromTokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            toTokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            amount: { type: 'string', pattern: '^[0-9]+$' },
            // slippage accepted for forward compatibility but ignored by MCP tool.
            slippage: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as {
        fromTokenAddress: string;
        toTokenAddress: string;
        amount: string;
        slippage?: string;
      };
      const start = Date.now();
      try {
        const quote = await opts.mcpClient.getQuote({
          chainIndex: '196',
          fromTokenAddress: body.fromTokenAddress,
          toTokenAddress: body.toTokenAddress,
          amount: body.amount,
          swapMode: 'exactIn',
        });
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-dex-quote',
          args: body,
          result: quote,
          durationMs: Date.now() - start,
          success: true,
        });
        return { service: 'swap-quote', data: quote, servedAt: Date.now() };
      } catch (err) {
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-dex-quote',
          args: body,
          result: { error: (err as Error).message },
          durationMs: Date.now() - start,
          success: false,
        });
        throw err;
      }
    }
  );
};
