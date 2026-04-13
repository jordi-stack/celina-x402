import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OKXMCPClient } from '../src/client';

describe('OKXMCPClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('constructs JSON-RPC 2.0 tools/call request with correct headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { toTokenAmount: '999000' } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new OKXMCPClient({
      url: 'https://web3.okx.com/api/v1/onchainos-mcp',
      apiKey: 'TEST_KEY',
    });

    await client.callTool('dex-okx-dex-quote', { chainIndex: '196' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://web3.okx.com/api/v1/onchainos-mcp');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['OK-ACCESS-KEY']).toBe('TEST_KEY');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.method).toBe('tools/call');
    expect(body.params.name).toBe('dex-okx-dex-quote');
    expect(body.params.arguments).toEqual({ chainIndex: '196' });
    expect(typeof body.id).toBe('number');
  });

  it('callTool returns raw result on successful response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { fromToken: { symbol: 'USDG' } } }),
    }) as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    const result = await client.callTool('dex-okx-dex-quote', {});
    expect(result).toEqual({ fromToken: { symbol: 'USDG' } });
  });

  it('throws MCPError on JSON-RPC error field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'Invalid params', data: null },
      }),
    }) as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    await expect(client.callTool('dex-okx-dex-quote', {})).rejects.toThrow(/Invalid params/);
  });

  it('throws on HTTP non-2xx status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    await expect(client.callTool('dex-okx-dex-quote', {})).rejects.toThrow(/HTTP 500/);
  });

  it('getQuote unwraps result.content[0].text envelope and returns typed Quote', async () => {
    // Real-shape mock matching the Day-1 MCP spike findings: the actual OKX
    // MCP server wraps the payload as result.content[0].text which is a JSON
    // string containing { code: "0", data: [<quote>], msg: "" }.
    const innerEnvelope = {
      code: '0',
      msg: '',
      data: [
        {
          chainIndex: '196',
          contextSlot: 57336360,
          fromToken: {
            tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
            tokenSymbol: 'USDG',
            decimal: '6',
            tokenUnitPrice: '1',
            isHoneyPot: false,
            taxRate: '0',
          },
          toToken: {
            tokenContractAddress: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
            tokenSymbol: 'USDT',
            decimal: '6',
            tokenUnitPrice: '1.00027',
            isHoneyPot: false,
            taxRate: '0',
          },
          fromTokenAmount: '1000000',
          toTokenAmount: '999700',
          priceImpactPercent: '0',
          estimateGasFee: '288000',
          tradeFee: '0.00058614623606784',
          router:
            '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8--0x779ded0c9e1022225f8e0630b35a9b54be713736',
          swapMode: 'exactIn',
          dexRouterList: [
            {
              dexProtocol: { dexName: 'PotatoSwap V3', percent: '100' },
              fromToken: {
                tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
                tokenSymbol: 'USDG',
                decimal: '6',
                tokenUnitPrice: '1',
                isHoneyPot: false,
                taxRate: '0',
              },
              toToken: {
                tokenContractAddress: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
                tokenSymbol: 'USDT',
                decimal: '6',
                tokenUnitPrice: '1.00027',
                isHoneyPot: false,
                taxRate: '0',
              },
              fromTokenIndex: '0',
              toTokenIndex: '1',
            },
          ],
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: JSON.stringify(innerEnvelope) }],
        },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    const quote = await client.getQuote({
      chainIndex: '196',
      fromTokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      toTokenAddress: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
      amount: '1000000',
    });

    expect(quote.toTokenAmount).toBe('999700');
    expect(quote.fromToken.tokenSymbol).toBe('USDG');
    expect(quote.dexRouterList[0]?.dexProtocol.dexName).toBe('PotatoSwap V3');

    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.params.name).toBe('dex-okx-dex-quote');
    expect(body.params.arguments.chainIndex).toBe('196');
  });

  it('getTokenPriceInfo unwraps envelope and returns typed TokenPriceInfo', async () => {
    const innerEnvelope = {
      code: '0',
      msg: '',
      data: [
        {
          chainIndex: '196',
          tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
          price: '1.000154228079120269',
          priceChange24H: '-0.01',
          priceChange1H: '-0.01',
          priceChange4H: '-0.01',
          priceChange5M: '0',
          volume24H: '45719.43598002366',
          volume1H: '41559.37851448179',
          volume4H: '41661.05447410994',
          volume5M: '0',
          marketCap: '268491402.52783983621305',
          holders: '44574',
          circSupply: '268450000',
          liquidity: '2932526.655694034962437',
          maxPrice: '1.000415735203879056',
          minPrice: '0.998946800882515168',
          tradeNum: '45712.032687',
          txs24H: '90',
          txs1H: '10',
          txs4H: '13',
          txs5M: '0',
          time: '1776108728826',
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: JSON.stringify(innerEnvelope) }],
        },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    const info = await client.getTokenPriceInfo({
      items: [
        {
          chainIndex: '196',
          tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
        },
      ],
    });

    expect(info.price).toBe('1.000154228079120269');
    expect(info.holders).toBe('44574');

    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.params.name).toBe('dex-okx-market-token-price-info');
  });
});
