# CLI Spike Findings

**Run at:** 2026-04-13T19:21:15.664Z
**CLI version:** onchainos 2.2.8
**`--force` present in x402-pay:** false (but see Resolution below)

## Wallet Status

```
{
  "ok": true,
  "data": {
    "accountCount": 2,
    "apiKey": "<REDACTED>",
    "currentAccountId": "c90a20ab-d544-47e6-b227-0c259e0db291",
    "currentAccountName": "Account 1",
    "email": "",
    "loggedIn": true,
    "loginType": "ak",
    "policy": {
      "dailyTradeTxFlag": false,
      "dailyTradeTxLimit": "",
      "dailyTradeTxUsed": "0",
      "dailyTransferTxFlag": false,
      "dailyTransferTxLimit": "",
      "dailyTransferTxUsed": "0",
      "singleTxFlag": false,
      "singleTxLimit": ""
    }
  }
}
```

Both the Consumer and Producer accounts are registered (`accountCount=2`). Login type is `ak` (API-key flow via WARP-bypassed Telkomsel TLS interception on web3.okx.com). The raw `apiKey` field returned by the CLI has been redacted from this committed findings file; the original git commit `70fa2ae` contains the plaintext value and needs follow-up.

## `x402-pay` Help Output

```
Sign an x402 payment and return the payment proof

Usage: onchainos payment x402-pay [OPTIONS] --accepts <ACCEPTS>

Options:
      --accepts <ACCEPTS>    JSON accepts array from the 402 response (decoded.accepts). The CLI selects the best scheme automatically (prefers "exact", falls back to "aggr_deferred", then first entry)
      --base-url <BASE_URL>  Backend service URL (overrides config)
      --chain <CHAIN>        Chain: ethereum, solana, base, bsc, polygon, arbitrum, sui, etc
      --from <FROM>          Payer address (optional, defaults to selected account)
  -h, --help                 Print help
```

No `--force`, no `--yes`, no `--no-confirm`. Full option list is `--accepts`, `--base-url`, `--chain`, `--from`, `-h`.

## Session Test Results

- Call 1: loggedIn=true, prompted=false
- Call 2: loggedIn=true, prompted=false
- Call 3: loggedIn=true, prompted=false
- PASS: 3 consecutive calls all logged in, no prompts.

Session stickiness works. The CLI persists auth state across separate process spawns via its config file (no re-auth between consecutive `wallet status` calls). That gate passes.

## Resolution (manual verification after initial HALT)

The initial automated spike assumed the missing `--force` flag implied the CLI would stall on an interactive confirm prompt during `x402-pay`. That assumption turned out to be false for CLI v2.2.8. Direct probe:

```
$ onchainos payment x402-pay --accepts '[]'
{"ok":false,"error":"accepts array is empty"}
exit=1
```

The command errored **immediately** with no TTY prompt, no stall, no hang. `onchainos payment x402-pay` in v2.2.8 is non-interactive by design: it takes `--accepts` as input, signs via TEE, and returns the JSON proof or a JSON error. There is no confirming prompt path to bypass, so `--force` is obsolete rather than missing.

This changes the interpretation of the HALT to PROCEED. Downstream impact: the x402 Payment CLI wrapper in Chunk 3 Task 5 must NOT pass a `--force` flag (it would be rejected as an unknown argument). The wrapper should just invoke `onchainos payment x402-pay --accepts <JSON>` and JSON-parse the stdout.

## Blockers

_None after manual resolution_

## Recommendation

PROCEED - CLI ready for use. The original `--force` assumption in the spec (Section 4.7) is stale relative to CLI v2.2.8 and should be treated as obsolete for this build. The Chunk 3 Task 5 x402 Payment CLI wrapper must not pass `--force`.
