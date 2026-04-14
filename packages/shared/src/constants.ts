export const X_LAYER_CHAIN_ID = 196;
export const X_LAYER_CAIP2 = 'eip155:196' as const;
export const X_LAYER_RPC = 'https://rpc.xlayer.tech';
export const X_LAYER_EXPLORER = 'https://www.oklink.com/xlayer';

export const USDG_CONTRACT = '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8' as const;
export const USDT_CONTRACT = '0x779ded0c9e1022225f8e0630b35a9b54be713736' as const;
export const USDG_DECIMALS = 6;
export const USDT_DECIMALS = 6;

export const OKX_MCP_ENDPOINT = 'https://web3.okx.com/api/v1/onchainos-mcp';
export const OKX_FACILITATOR_BASE = 'https://web3.okx.com';

export const FACILITATOR_PATHS = {
  supported: '/api/v6/pay/x402/supported',
  verify: '/api/v6/pay/x402/verify',
  settle: '/api/v6/pay/x402/settle',
} as const;

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const GROQ_PRIMARY_MODEL = 'llama-3.3-70b-versatile' as const;
export const GROQ_FAST_MODEL = 'llama-3.1-8b-instant' as const;

export const HMAC_CLOCK_SKEW_TOLERANCE_MS = 30_000;
export const CYCLE_RETRY_MAX = 3;
export const STATE_RETRY_MAX = 1;

export const PRODUCER_PORT = 3001;
export const CONSUMER_API_PORT = 3002;
export const DASHBOARD_PORT = 3000;

// Research service catalog used by the Intelligence Agent. Prices are the
// minimal-unit USDG amounts declared on the Producer x402 gates — duplicated
// here so Consumer/Dashboard can reason about cost without hitting an API.
export const RESEARCH_SERVICE_CATALOG = {
  'research-token-report': {
    path: '/research/token-report',
    priceMinimal: '15000',
    priceUsdg: '0.015',
    summary:
      'Deep risk + fundamentals report on a token (security flags, dev history, holder concentration, price).',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'research-wallet-risk': {
    path: '/research/wallet-risk',
    priceMinimal: '10000',
    priceUsdg: '0.010',
    summary:
      'Wallet safety scan: portfolio value, risk-flagged token exposure, dangerous approvals.',
    argsHint: '{ address: 0x... }',
  },
  'research-liquidity-health': {
    path: '/research/liquidity-health',
    priceMinimal: '8000',
    priceUsdg: '0.008',
    summary:
      'Liquidity depth + 24h volatility for a token (price impact at $10/$100/$1000, candle-based range).',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'signal-whale-watch': {
    path: '/signal/whale-watch',
    priceMinimal: '5000',
    priceUsdg: '0.005',
    summary:
      'Who is moving a token right now: whale trade count + buy/sell pressure vs top holders.',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'signal-new-token-scout': {
    path: '/signal/new-token-scout',
    priceMinimal: '3000',
    priceUsdg: '0.003',
    summary:
      'Momentum + safety score for a newly-launched token (short-horizon candles, basic rug checks).',
    argsHint: '{ tokenAddress: 0x... }',
  },
} as const;

export type ResearchServiceCatalogEntry =
  (typeof RESEARCH_SERVICE_CATALOG)[keyof typeof RESEARCH_SERVICE_CATALOG];
