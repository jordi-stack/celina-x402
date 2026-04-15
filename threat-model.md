# Threat Model: Celina x402 Onchain Intelligence Agent

This document covers the principal threat scenarios for Celina's three-process architecture (Producer, Consumer, Dashboard) and how each is mitigated. The goal is to let a judge or security reviewer understand what Celina trusts, what it does not, and where the residual risk lies.

## System boundary

```
User browser
    │
    ▼
Dashboard (Next.js :3000)  ─── API routes ──► Consumer (:3002)
                                                    │
                                              Groq LLM (HTTPS)
                                                    │
                                              Producer (:3001)
                                                    │
                                    ┌───────────────┼───────────────┐
                                OKX MCP           Security       Trenches
                                Server             module          module
                                    └───────────────┴───────────────┘
                                              OKX Facilitator
                                              (verify + settle)
                                                    │
                                           X Layer chain 196
```

Shared state: one SQLite file (`data/app.db`, WAL mode). All three processes open it read/write.

---

## Threat 1 — Malicious or buggy Producer

**Scenario.** The Producer process is compromised or returns fabricated data. An attacker could serve false token risk verdicts, inflated whale counts, or invented liquidity numbers to manipulate Celina's synthesis.

**How Celina handles it.**
- Consumer treats Producer responses as untrusted input. The Groq synthesizer is instructed to flag contradictions when two services disagree (e.g., MCP price says market cap $1M but Security says no liquidity found).
- Each paid call's raw `data` blob is logged in `query_sessions.calls` and surfaced on the Dashboard `/mcp` page. A judge can compare what the Producer returned against the raw OKX API directly.
- The x402 payment proof is signed by the Consumer's OKX Agentic Wallet TEE, not by the Producer. The Producer can refuse to serve data, but cannot forge a payment proof that debits the Consumer's balance without a real Facilitator verify/settle round trip.
- Service grades (`grade.usefulness`) are retrospective: after synthesis the LLM scores each call 0–1. Low-scoring calls reduce the service's weight in future sessions via `service_performance`. A consistently lying Producer service degrades its own selection probability.

**Residual risk.** The Consumer cannot cryptographically verify that the Producer fetched fresh OKX data rather than returning a cached or fabricated payload. This is an inherent limitation of the current protocol. A future mitigation would be requiring the Producer to include a signed OKX response envelope so the Consumer can check the OKX API key signature.

---

## Threat 2 — Consumer wallet key leaked

**Scenario.** An attacker obtains the OKX API key and passphrase from the `.env` file (e.g., via a misconfigured server, a leaked git commit, or process memory access).

**How Celina handles it.**
- No private key ever enters application memory. All signing goes through the `onchainos` CLI, which keeps keys inside the OKX Agentic Wallet's TEE. Leaking the API key/passphrase from `.env` gives an attacker the ability to call `onchainos wallet` commands, not to exfiltrate raw key material.
- The `.env` file is `.gitignore`-d. The project git history was scrubbed via `git filter-repo` after an early API key briefly appeared in a spike findings file.
- The Consumer has a per-session budget cap (`SESSION_BUDGET_USDG`, default 0.10 USDG) and a call-count cap (`MAX_CALLS_PER_SESSION`, default 4). Even if an attacker can trigger `/ask` calls, each session is bounded, and the total balance in the Consumer wallet is limited to the demo float (typically 1–5 USDG).
- The attacker cannot replay a signed `transferWithAuthorization` because the OKX Facilitator enforces nonce uniqueness: each payment proof's nonce must be fresh and unused. A captured proof cannot be submitted twice.

**Residual risk.** An attacker with the API key and CLI access on the same machine could call `onchainos payment x402-pay` to drain the Consumer balance up to the float ceiling. Mitigation: run the Consumer in a dedicated VM or container with network egress limited to the Producer URL and OKX endpoints. Rotate the API key if the host is compromised.

---

## Threat 3 — MCP server returns malicious data

**Scenario.** The OKX MCP Server (or a man-in-the-middle between the Producer and OKX) returns JSON designed to inject prompt content into Celina's LLM context — a prompt injection attack via the data plane.

**How Celina handles it.**
- The Producer's route handlers extract specific fields from MCP responses using Zod schemas (`McpToolEnvelopeSchema`, per-tool response shapes). Only the fields named in the schema reach the Consumer. Unexpected fields are stripped at the Zod parse boundary.
- The Consumer's synthesize prompt instructs the LLM to treat `calls[*].data` as raw onchain data, not as instructions. The system prompt explicitly names the LLM's role and limits its actions to reasoning, not execution.
- The Consumer has no write path back to any external service during synthesis. The only write after synthesis is `insertMemory` (local SQLite) and `attest()` (fixed-ABI contract call). Neither path accepts free-form text as a code or command.

**Residual risk.** A sufficiently adversarial string embedded in an OKX market data field could still influence the LLM's verdict text. Celina does not currently run a secondary validation pass on synthesized text. Mitigation: add an output-guard prompt that checks the verdict for instructions or anomalous patterns before persisting to memory or attestation.

---

## Threat 4 — Replay or double-spend of x402 proof

**Scenario.** An attacker captures a valid `PAYMENT-SIGNATURE` header from an in-flight request and replays it to receive a second response without paying again.

**How Celina handles it.**
- The OKX Facilitator enforces nonce uniqueness at the protocol level. The x402 v2 challenge includes a server-generated `nonce` and a `validUntil` expiry. The signed proof binds the nonce, amount, recipient, and expiry. Presenting the same nonce twice returns a 4xx from `/verify`.
- The Producer's x402-gate plugin (in `packages/x402-server`) calls `/verify` before executing any route logic. If verify fails the gate returns `402` without running the handler.
- All proofs are logged to `payments` with a `status` field. A `settled` row means the nonce has been consumed on-chain. The Consumer polls this table for the tx hash and does not retry on a consumed nonce.

**Residual risk.** The `validUntil` window is set by the challenge. If the window is wide (e.g., 10 minutes) and the Facilitator's nonce store has a gap at restart, a replay within the window is theoretically possible. OKX controls the Facilitator, so this is OKX's responsibility to mitigate.

---

## Threat 5 — Dashboard exposes sensitive data

**Scenario.** The Next.js dashboard is publicly accessible and leaks wallet balances, session history, or API keys to unauthorized viewers.

**How Celina handles it.**
- The dashboard is read-only. No route on it can trigger a payment or session start (those go to the Consumer's Fastify server on port 3002, which is not exposed to the public internet).
- The `/api/live-balance` route returns only the USDG and USDT balances of the Consumer wallet address — already public on-chain. It does not expose the account ID or API key.
- API keys (`OKX_API_KEY`, `GROQ_API_KEY`, etc.) are loaded by the Producer and Consumer processes via `dotenv` at startup and never forwarded to the Dashboard. The Dashboard's Next.js API routes do not import `config.ts` from the Consumer or Producer packages.
- The dashboard `.env` is a symlink to the repo-root `.env` but Next.js only exposes variables prefixed with `NEXT_PUBLIC_` to the browser bundle. None of the variables in `.env.example` use that prefix.

**Residual risk.** If the dashboard is deployed on a public host, session verdicts and wallet addresses are visible to anyone with the URL. This is intentional for the demo (judge visibility), but production use would require authentication middleware.

---

## Threat 6 — On-chain attestation manipulated

**Scenario.** An attacker submits a false `attest()` call to `CelinaAttestation.sol` to forge a verdict anchored to Celina's Consumer address.

**How Celina handles it.**
- `CelinaAttestation.sol` is a single-owner registry: only the deployer address (Consumer `0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25`) can write attestations via `attest()`. Any call from a different address reverts with `NotOwner`.
- The `verdictHash` stored on-chain is `keccak256(canonicalJson)` where `canonicalJson` is deterministically serialized from the session data. A reviewer can recompute the hash from the verdict text and confirm it matches the on-chain record.
- The Consumer signs the canonical payload before calling `attest()`. The `signature` field in `session.attestation` lets any verifier confirm the Consumer wallet signed that exact payload.

**Residual risk.** The Consumer's OKX Agentic Wallet controls the private key that owns the contract. If the Consumer key is compromised (see Threat 2), an attacker could submit false attestations. Key rotation would require redeploying the contract with a new owner.

---

## Summary

| Threat | Mitigation | Residual |
|---|---|---|
| Malicious Producer | Payment flow independent of data; contradiction detection; call grading | Producer can serve stale/fake data |
| Consumer key leaked | Keys in TEE; session budget cap; nonce uniqueness | CLI access on same host could drain float |
| MCP prompt injection | Zod schema stripping; data-vs-instruction prompt separation | LLM verdict text not output-validated |
| Replay / double-spend | Facilitator nonce enforcement; expiry window | Wide `validUntil` windows (OKX's scope) |
| Dashboard data exposure | Read-only; no API keys to browser; session data intentionally public for demo | Auth required for production |
| Attestation forgery | Owner-only contract; canonical hash; Consumer signature | Compromise of Consumer key |
