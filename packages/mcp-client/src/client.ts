import type {
  Quote,
  TokenPriceInfo,
  TotalTokenBalances,
} from '@x402/shared';
import {
  QuoteSchema,
  QuoteParamsSchema,
  TokenPriceInfoSchema,
  TokenPriceInfoParamsSchema,
  TotalTokenBalancesSchema,
  TotalTokenBalancesParamsSchema,
  McpToolEnvelopeSchema,
} from '@x402/shared';
import { z } from 'zod';

export interface MCPClientConfig {
  url: string;
  apiKey: string;
  timeoutMs?: number;
}

export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// MCP tool-call result shape: always wraps data in result.content[0].text
// as a JSON-encoded envelope string. Captured from live OKX MCP spike.
const ContentEnvelopeSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string(),
    })
  ),
});

/**
 * OKX OnchainOS MCP Server HTTP JSON-RPC client.
 * Endpoint: https://web3.okx.com/api/v1/onchainos-mcp
 * Auth: OK-ACCESS-KEY header (no HMAC required for MCP itself).
 *
 * Typed helpers (getQuote, getTokenPriceInfo) automatically unwrap the
 * result.content[0].text JSON envelope observed in the Day-1 spike.
 */
export class OKXMCPClient {
  private readonly timeoutMs: number;

  constructor(private readonly config: MCPClientConfig) {
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const body = {
      jsonrpc: '2.0' as const,
      method: 'tools/call' as const,
      params: { name, arguments: args },
      id: Math.floor(Math.random() * 1e9),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': this.config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new MCPError(`HTTP ${res.status} ${res.statusText ?? ''}`.trim());
      }

      const json = (await res.json()) as {
        jsonrpc: string;
        id: number;
        result?: T;
        error?: { code: number; message: string; data?: unknown };
      };

      if (json.error) {
        throw new MCPError(json.error.message, json.error.code, json.error.data);
      }

      return json.result as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Unwrap the MCP tool response envelope.
   * 1. callTool returns JSON-RPC `result` (arbitrary shape).
   * 2. Real MCP responses wrap payload as `result.content[0].text` JSON string.
   * 3. That JSON string decodes to `{ code, data: T[], msg }`.
   * 4. Return `data[0]` typed via the provided Zod schema.
   */
  private async unwrapToolResult<T>(
    toolName: string,
    args: Record<string, unknown>,
    dataSchema: z.ZodTypeAny
  ): Promise<T> {
    const raw = await this.callTool<unknown>(toolName, args);
    const content = ContentEnvelopeSchema.parse(raw);
    const first = content.content[0];
    if (!first) {
      throw new MCPError(`Tool ${toolName} returned empty content array`);
    }
    const parsedText = JSON.parse(first.text) as unknown;
    const envelope = McpToolEnvelopeSchema(dataSchema).parse(parsedText);
    if (envelope.code !== '0') {
      throw new MCPError(
        `Tool ${toolName} returned error code ${envelope.code}: ${envelope.msg}`
      );
    }
    const item = envelope.data[0];
    if (!item) {
      throw new MCPError(`Tool ${toolName} returned empty data array`);
    }
    return item as T;
  }

  async getQuote(params: z.input<typeof QuoteParamsSchema>): Promise<Quote> {
    return this.unwrapToolResult<Quote>('dex-okx-dex-quote', params, QuoteSchema);
  }

  async getTokenPriceInfo(params: z.input<typeof TokenPriceInfoParamsSchema>): Promise<TokenPriceInfo> {
    return this.unwrapToolResult<TokenPriceInfo>(
      'dex-okx-market-token-price-info',
      params,
      TokenPriceInfoSchema
    );
  }

  async getTotalTokenBalances(
    params: z.input<typeof TotalTokenBalancesParamsSchema>
  ): Promise<TotalTokenBalances> {
    return this.unwrapToolResult<TotalTokenBalances>(
      'dex-okx-balance-total-token-balances',
      params,
      TotalTokenBalancesSchema
    );
  }
}
