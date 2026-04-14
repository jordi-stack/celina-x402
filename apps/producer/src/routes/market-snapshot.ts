import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { Store } from '@x402/orchestrator';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  store: Store;
}

export const marketSnapshotRoute: FastifyPluginAsync<PluginOpts> = async (fastify, opts) => {
  fastify.post(
    '/v1/market-snapshot',
    {
      config: {
        x402: { amount: '1000', service: 'market-snapshot' },
      },
      schema: {
        body: {
          type: 'object',
          required: ['tokenContractAddress'],
          properties: {
            tokenContractAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
            },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as { tokenContractAddress: string };
      const start = Date.now();
      try {
        // Refined schema from Day-1 MCP spike: batch format with items: [...]
        const info = await opts.mcpClient.getTokenPriceInfo({
          items: [
            {
              chainIndex: '196',
              tokenContractAddress: body.tokenContractAddress,
            },
          ],
        });
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-market-token-price-info',
          args: body,
          result: info,
          durationMs: Date.now() - start,
          success: true,
        });
        return { service: 'market-snapshot', data: info, servedAt: Date.now() };
      } catch (err) {
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-market-token-price-info',
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
