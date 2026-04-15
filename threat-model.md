# Threat Model: Celina x402 Onchain Intelligence Agent

This document covers the principal threat scenarios for Celina's four-process architecture (Producer, Consumer, Sub-agent, Dashboard) and how each is mitigated. The goal is to let a judge or security reviewer understand what Celina trusts, what it does not, and where the residual risk lies.

## System boundary

```
User browser
    │
    ▼
Dashboard (Next.js :3000)  ─── API routes ──► Consumer (:3002)
                                                    │
                                              Groq LLM (HTTPS)
                                                    │
                         ┌──────────────────────────┴──────────────────────────┐
                         ▼                                                     ▼
                   Producer (:3001)                                  Sub-agent (:3003)
                         │                                                     │
                         │◄──── x402 payment (Sub-agent pays Producer) ────────┤
                         │                                                     │
             ┌───────────┼───────────┐                                         │
         OKX MCP       Security   Trenches                                     │
         Server        module     module                                       │
             └───────────┴───────────┘                                         │
                         │                                                     │
                         └─────────────►  OKX Facilitator  ◄───────────────────┘
                                          (verify + settle)
                                                    │
                                           X Layer chain 196
                                     + CelinaAttestation.sol
```

Shared state: one SQLite file (`data/app.db`, WAL mode). All four processes open it — Producer, Consumer, and Sub-agent write; Dashboard reads.

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

## Threat 2 — Consumer or Sub-agent wallet key leaked

**Scenario.** An attacker obtains the OKX API key and passphrase from the `.env` file (e.g., via a misconfigured server, a leaked git commit, or process memory access). The same scenario applies to the Sub-agent's wallet state, which lives under the same AK login.

**How Celina handles it.**
- No private key ever enters application memory. All signing goes through the `onchainos` CLI, which keeps keys inside the OKX Agentic Wallet's TEE. Leaking the API key/passphrase from `.env` gives an attacker the ability to call `onchainos wallet` commands, not to exfiltrate raw key material.
- The `.env` file is `.gitignore`-d. The project git history was scrubbed via `git filter-repo` after an early API key briefly appeared in a spike findings file.
- The Consumer has a hard call-count cap (`MAX_CALLS_PER_SESSION`, default 4) enforced inside `session-runner.ts`. A `SESSION_BUDGET_USDG` value (default 0.10 USDG) is also passed to the Groq planner as a prompt hint so the LLM can avoid over-spending, but it is advisory, not runtime-enforced. The hard cap is the call count plus the total float in the wallet (typically 1–5 USDG for the demo, ~1 USDG for the Sub-agent).
- The attacker cannot replay a signed `transferWithAuthorization` because the OKX Facilitator enforces nonce uniqueness: each payment proof's nonce must be fresh and unused. A captured proof cannot be submitted twice.

**Residual risk.** An attacker with the API key and CLI access on the same machine could call `onchainos payment x402-pay` to drain the Consumer or Sub-agent balance up to the float ceiling, limited only by the 4-call cap per session and the total balance. Mitigation: run each agent in a dedicated VM or container with network egress limited to the known upstream URLs and OKX endpoints. Rotate the API key if the host is compromised.

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
- The dashboard is mostly read-only. The user-facing AskBox posts to the Dashboard's own `/api/ask` route which proxies to the Consumer, but no route directly mutates payment state — all USDG transfers are driven by the session runner inside the Consumer.
- The `/api/live-balance` route returns only the USDG balance of the Consumer and Producer wallet addresses. Those addresses are already public on-chain; the account IDs (UUIDs issued by the OKX Agentic Wallet) are never returned to the browser.
- The Dashboard's Next.js API routes run server-side only. `OKX_API_KEY` is loaded into the Dashboard process via the symlinked `apps/dashboard/.env` file and used inside `/api/live-balance` to call the OKX MCP Server, but it is never exposed to the browser bundle — Next.js only ships variables prefixed with `NEXT_PUBLIC_` to the client, and none of the OKX or Groq keys use that prefix. Any request from a browser that touches `OKX_API_KEY` is executed server-side in the Next.js runtime.
- `GROQ_API_KEY` is not touched by the Dashboard at all; it only lives inside the Consumer process.

**Residual risk.** If the dashboard is deployed on a public host, session verdicts and wallet addresses are visible to anyone with the URL, and the Dashboard process carries `OKX_API_KEY` in its runtime env. A compromised Dashboard host leaks the same key that the Producer and Consumer hold. Production deployments should put the Dashboard behind authentication middleware and, if strict isolation is required, split the balance lookup into a Consumer-side endpoint so the Dashboard never needs `OKX_API_KEY` at all.

---

## Threat 6 — On-chain attestation impersonation

**Scenario.** `CelinaAttestation.sol` has no owner check: anyone with gas on X Layer can call `attest(sessionHash, verdictHash, verdict)`. An attacker could try to front-run Celina's own attestation for a known session id, or try to attest a fake verdict under an unknown session id in a way that looks like it came from Celina.

**How Celina handles it.**
- The contract is intentionally permissionless but write-once per `sessionHash`. The first caller wins: a second `attest()` with the same session hash reverts with `AlreadyAttested(sessionHash)` ([packages/contracts/src/CelinaAttestation.sol](packages/contracts/src/CelinaAttestation.sol)). To impersonate a specific Celina session, an attacker would have to predict `keccak256(session.id)` before Celina completes that session, where `session.id` is a random `q_<uuidv4>` generated client-side at the start of each `/ask` call. Guessing a UUID v4 is 2^122 work.
- Every attestation records `msg.sender` as the `attester` field and emits it in the `Attested` event. A verifier checks the on-chain row against the Consumer's known address (`0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25`); any attestation from a different address is not Celina's. The `/verify/:sessionHash` endpoint on the Consumer API surfaces this field directly.
- The `verdictHash` stored on-chain is `keccak256(canonicalJson)`, where `canonicalJson` is deterministically serialized from the session data via `canonicalStringify` in `@x402/shared`. A reviewer can recompute the hash from the verdict text and confirm it matches the on-chain record.
- Before attesting, the Consumer also signs the canonical payload with `onchainos wallet sign-message --type personal` and stores the signature in `session.attestation.signature`. This gives a second verification path: recover the signer from the signature, compare against the on-chain `attester`, confirm they match.

**Residual risk.** If Celina's session id generator ever becomes predictable (e.g., a weak RNG swap), the front-running attack becomes cheap. If the Consumer key is compromised (see Threat 2) an attacker can publish valid-looking attestations under Celina's address; only off-chain controls (rotating the Consumer key and republishing its canonical address) can recover from that. The contract itself has no admin; a breach would require deploying a new contract and updating `CELINA_ATTESTATION_ADDRESS` in `.env`.

---

## Summary

| Threat | Mitigation | Residual |
|---|---|---|
| Malicious Producer | Payment flow independent of data; contradiction detection; call grading | Producer can serve stale/fake data |
| Consumer / Sub-agent key leaked | Keys in TEE; 4-call hard cap per session; nonce uniqueness | CLI access on same host could drain float up to cap |
| MCP prompt injection | Zod schema stripping; data-vs-instruction prompt separation | LLM verdict text not output-validated |
| Replay / double-spend | Facilitator nonce enforcement; expiry window | Wide `validUntil` windows (OKX's scope) |
| Dashboard data exposure | Server-side only; session data intentionally public for demo; `OKX_API_KEY` never in browser bundle | `OKX_API_KEY` still lives in Dashboard runtime env |
| Attestation impersonation | Write-once per session hash; attester = `msg.sender`; off-chain signature cross-check | Compromise of Consumer key; session id RNG weakness |
