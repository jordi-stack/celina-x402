# Day 1 Mandatory Spikes

These spikes must run successfully before any heavy build work begins. Each spike produces findings written to `scripts/src/spikes/findings/<spike-name>.md`.

## 1. CLI Spike (`spike:cli`)

Verifies `onchainos payment x402-pay` CLI behavior:
- Does `--force` flag exist?
- Does it bypass confirming prompts?
- Does session persist across back-to-back calls?

## 2. Facilitator Throughput Spike (`spike:facilitator`)

Measures OKX Facilitator API:
- First 429 threshold (requests/min until rate limited)
- Latency distribution (p50, p99)
- Error recovery behavior
- Verify happy path works with HMAC

## 3. MCP Schema Spike (`spike:mcp`)

Captures real response shapes from OKX MCP Server for:
- `dex-okx-dex-quote`
- `dex-okx-market-token-price-info`

Output used to refine Zod schemas in `@x402/shared`.

## Running

Prerequisites: `.env` with OKX credentials, `onchainos` CLI installed.

```bash
pnpm install
pnpm spike:all
```

Findings saved to `scripts/src/spikes/findings/`.
