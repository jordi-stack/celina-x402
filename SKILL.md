# SKILL: celina-onchain-research

Celina is an x402 Onchain Intelligence Agent on X Layer (chain 196). You give it a natural-language question about a token or wallet, and it answers by paying for the data it needs through the x402 HTTP payment protocol. Every data purchase settles as a real `transferWithAuthorization` on chain 196. Each verdict is signed and anchored to `CelinaAttestation.sol`.

## Discovery endpoint

```
GET http://<host>:3002/capabilities
```

Returns the full JSON capability manifest: all services, prices, input schemas, payment details, and attestation contract.

## Ask endpoint

```
POST http://<host>:3002/ask
Content-Type: application/json

{ "question": "Is 0x4ae46a509f6b1d9056937ba4500cb143933d2dc8 safe?" }
```

Returns `202` immediately with `{ "id": "q_...", "status": "planning" }`. Poll `GET /sessions/:id` until `status` is `done`, `aborted`, or `failed`.

The caller pays nothing. Celina's Consumer wallet pays the Producer on each research step via x402 and returns a fully-synthesized verdict.

## Available services

Each service is an x402-gated HTTP endpoint on the Producer (`:3001`). Celina's LLM planner selects services automatically, but any x402-capable caller can hit them directly.

| Service | Route | Price | Input | What it returns |
|---|---|---|---|---|
| `research-token-report` | `POST /research/token-report` | 0.015 USDG | `{ tokenAddress }` | Risk + fundamentals: security flags, dev history, holder concentration, price |
| `research-wallet-risk` | `POST /research/wallet-risk` | 0.010 USDG | `{ address }` | Wallet health: portfolio value, risky tokens, dangerous approvals |
| `research-liquidity-health` | `POST /research/liquidity-health` | 0.008 USDG | `{ tokenAddress }` | Slippage curve at 10/100/1000 USDG + 24h volatility range |
| `signal-whale-watch` | `POST /signal/whale-watch` | 0.005 USDG | `{ tokenAddress }` | Whale trade sentiment: buy/sell pressure from wallets above $1000 |
| `signal-new-token-scout` | `POST /signal/new-token-scout` | 0.003 USDG | `{ tokenAddress }` | Launch momentum + rug-check for new tokens |
| `research-deep-dive` | `POST /research/deep-dive` | 0.030 USDG | `{ tokenAddress }` | Agent-to-agent composed analysis: Sub-agent pays Producer for token-report + liquidity-health and correlates results |
| `action-swap-exec` | `POST /action/swap-exec` | 0.020 USDG | `{ fromToken, toToken, readableAmount }` | Execute a real DEX swap on X Layer via OKX aggregator |

## Payment details

```
network:          eip155:196  (X Layer)
payment token:    0x4ae46a509f6b1d9056937ba4500cb143933d2dc8  (USDG, 6 decimals)
payment method:   EIP-3009 transferWithAuthorization
facilitator:      https://web3.okx.com/api/v6/pay/x402
protocol:         x402 v2
```

To call a Producer route from outside Celina:

1. `POST /research/<name>` — expect `402 + PAYMENT-REQUIRED` header (base64-encoded x402 v2 challenge).
2. Sign via `onchainos payment x402-pay` or any EIP-3009-compatible signer.
3. Replay the same `POST` with `PAYMENT-SIGNATURE: <base64-proof>`.
4. On success, receive `200 + { service, data, servedAt }`.

## Attestation

After each session, Celina hashes the canonical verdict JSON and calls `attest(bytes32 sessionHash, bytes32 verdictHash, string verdict)` on `CelinaAttestation.sol`.

```
contract:  0x3d3AA2fad1a36fCe912f1c17F588270C5bEb810B
network:   eip155:196
explorer:  https://www.oklink.com/xlayer/address/0x3d3AA2fad1a36fCe912f1c17F588270C5bEb810B
```

Verify any verdict without trusting Celina:

```
GET http://<host>:3002/verify/:sessionHash
```

Returns the on-chain `{ verdictHash, verdict, attestedAt }` row directly from the contract.

## Memory and dedup

Celina caches completed session verdicts in a 24-hour rolling window. On a new question it embeds the text with `all-MiniLM-L6-v2` (384-dim) and checks cosine similarity against all active memories. Similarity >= 0.85 returns the cached verdict at zero cost. Falls back to address-based matching when the model is unavailable.

## Onchain identity

| Role | Address |
|---|---|
| Consumer (buyer) | `0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25` |
| Producer (seller) | `0xdfe57c7775f09599d12d11370a0afcb27f6aadbc` |
| Sub-agent | separate wallet, pays Producer under Account 3 |

## Session response shape

```json
{
  "id": "q_...",
  "question": "...",
  "status": "done",
  "calls": [
    {
      "service": "research-token-report",
      "amountSpent": "15000",
      "txHash": "0x...",
      "data": { ... },
      "planReason": "...",
      "grade": { "service": "research-token-report", "usefulness": 0.9, "reason": "..." }
    }
  ],
  "totalSpent": "15000",
  "synthesis": {
    "verdict": "...",
    "confidence": "high",
    "confidenceScore": 0.87,
    "summary": "...",
    "keyFacts": ["...", "..."],
    "contradictions": []
  },
  "attestation": {
    "sessionHash": "0x...",
    "verdictHash": "0x...",
    "txHash": "0x...",
    "contractAddress": "0x3d3AA2fad1a36fCe912f1c17F588270C5bEb810B",
    "attestedAt": 1776251704123
  }
}
```
