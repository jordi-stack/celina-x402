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
export const SUBAGENT_PORT = 3003;
export const DASHBOARD_PORT = 3000;

// CelinaAttestation.sol deployed on X Layer chain 196 via the Arachnid
// CREATE2 factory (0x4e59b44847b379578588920cA78FbF26c0B4956C) with
// salt = keccak256('celina-attestation-v1'). Consumer wallet calls
// attest() after every synthesize to anchor the verdict on-chain.
// Deploy tx: 0x429b2676cd38d973ffecff1f3616d71d4ea5a9a63c6d6d03c2b75d9fb5d6671c
export const CELINA_ATTESTATION_ADDRESS =
  '0x3d3AA2fad1a36fCe912f1c17F588270C5bEb810B' as const;

// Research service catalog used by the Intelligence Agent. Prices are the
// minimal-unit USDG amounts declared on the x402 gates. `provider` tells
// the Consumer's session runner which upstream URL to hit:
//   'producer'  — served by apps/producer on PRODUCER_PORT (raw OKX tools)
//   'subagent'  — served by apps/subagent on SUBAGENT_PORT (composed research
//                 where the Sub-agent itself pays the Producer via x402,
//                 i.e. the agent-to-agent x402 chain Celina demonstrates)
export const RESEARCH_SERVICE_CATALOG = {
  'research-token-report': {
    provider: 'producer',
    path: '/research/token-report',
    priceMinimal: '15000',
    priceUsdg: '0.015',
    summary:
      'Deep risk + fundamentals report on a token (security flags, dev history, holder concentration, price).',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'research-wallet-risk': {
    provider: 'producer',
    path: '/research/wallet-risk',
    priceMinimal: '10000',
    priceUsdg: '0.010',
    summary:
      'Wallet safety scan: portfolio value, risk-flagged token exposure, dangerous approvals.',
    argsHint: '{ address: 0x... }',
  },
  'research-liquidity-health': {
    provider: 'producer',
    path: '/research/liquidity-health',
    priceMinimal: '8000',
    priceUsdg: '0.008',
    summary:
      'Liquidity depth + 24h volatility for a token (price impact at $10/$100/$1000, candle-based range).',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'signal-whale-watch': {
    provider: 'producer',
    path: '/signal/whale-watch',
    priceMinimal: '5000',
    priceUsdg: '0.005',
    summary:
      'Who is moving a token right now: whale trade count + buy/sell pressure vs top holders.',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'signal-new-token-scout': {
    provider: 'producer',
    path: '/signal/new-token-scout',
    priceMinimal: '3000',
    priceUsdg: '0.003',
    summary:
      'Momentum + safety score for a newly-launched token (short-horizon candles, basic rug checks).',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'research-deep-dive': {
    provider: 'subagent',
    path: '/research/deep-dive',
    priceMinimal: '30000',
    priceUsdg: '0.030',
    summary:
      'Deep-dive correlation (served by Celina sub-agent, which itself pays the Producer via x402 for research-token-report + research-liquidity-health and correlates them). Picks this when a token question is important enough to warrant a second-hop agent paying for its own inputs.',
    argsHint: '{ tokenAddress: 0x... }',
  },
  'action-swap-exec': {
    provider: 'producer',
    path: '/action/swap-exec',
    priceMinimal: '20000',
    priceUsdg: '0.020',
    summary:
      'Execute a real DEX swap on X Layer via OKX aggregator (routes through Uniswap V4 + Revoswap for best price). Provide fromToken + toToken contract addresses and readableAmount (e.g. "0.005"). Returns txHash and execution route. Only use when the user explicitly asks to execute a trade.',
    argsHint: '{ fromToken: 0x..., toToken: 0x..., readableAmount: "0.005" }',
  },
} as const;

export type ResearchServiceCatalogEntry =
  (typeof RESEARCH_SERVICE_CATALOG)[keyof typeof RESEARCH_SERVICE_CATALOG];
