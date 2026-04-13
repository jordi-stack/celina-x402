# Facilitator Spike Findings

**Run at:** 2026-04-13T19:27:01.861Z
**Total requests sent:** 4
**Happy path OK:** true
**HMAC auth OK:** true

## Throughput
- First 429 at request: 3 (within throughput loop; 4th total including happy-path call)
- Latency P50: 79 ms
- Latency P99: 81 ms

## Rate Limit Analysis
The `/supported` endpoint returns HTTP 429 (code `50011 Too Many Requests`) after 3 rapid-fire requests. No rate-limit headers are returned (`x-ratelimit-limit`, `x-ratelimit-remaining`, `retry-after` all absent). A second probe run from a clean start succeeds for requests 1-3 before hitting 429 again, indicating the window resets between runs - consistent with a ~1 req/s sustained rate or a 3-burst-per-window policy. For the earn-pay-earn demo (1 `/verify` + 1 `/settle` per cycle at human speed), this limit is not a concern in practice.

## Schema Notes
- `OkxApiEnvelopeSchema` expects `code: string` but the API returns `code: number` (value `0`). This is a schema mismatch to fix in `packages/shared/src/types/facilitator.ts`. The spike handles this as non-blocking. Recommend updating schema to `z.union([z.string(), z.number()])` or `z.coerce.string()`.
- `SupportedResponseSchema.kinds` shape matches (`network`, `scheme`, `x402Version` all present). Minor: `extra: null` is not in current schema - non-blocking.

## Supported Response
```json
{
  "code": 0,
  "data": {
    "extensions": [],
    "kinds": [
      {
        "extra": null,
        "network": "eip155:196",
        "scheme": "exact",
        "x402Version": 2
      },
      {
        "extra": null,
        "network": "eip155:196",
        "scheme": "aggr_deferred",
        "x402Version": 2
      }
    ],
    "signers": {}
  },
  "detailMsg": "",
  "error_code": "0",
  "error_message": "",
  "msg": ""
}
```

## Blockers
_None_

## Recommendation
PROCEED - Facilitator responsive. Throughput: 3 req before 429 (burst limit, window resets; safe for demo cadence). P50: 79ms, P99: 81ms. Fix `OkxApiEnvelopeSchema.code` to accept number (non-blocking for this spike).
