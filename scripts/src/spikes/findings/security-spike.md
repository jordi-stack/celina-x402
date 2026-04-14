# Security CLI Spike Findings

**Run at:** 2026-04-14T21:25:02.807Z
**Chain:** X Layer (chain index 196)
**USDG contract:** 0x4ae46a509f6b1d9056937ba4500cb143933d2dc8
**Consumer address:** 0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25
**Producer address:** 0xdfe57c7775f09599d12d11370a0afcb27f6aadbc

## Purpose

Pivot 2026-04-15: Celina becomes an Onchain Intelligence Agent. The Producer
will expose 5 research endpoints gated by x402, several of which call the
okx-security CLI suite. This spike captures the live response shape for the
4 security commands so Zod schemas are derived from reality, not docs.

## Commands under test

1. `security token-scan` (explicit + wallet-mode variants)
2. `security tx-scan` (EVM pre-execution simulator)
3. `security approvals` (permit2 / ERC-20 approvals list)
4. `security dapp-scan` (phishing / blacklist check)

## `security token-scan` (usdg-explicit)
- OK: true
- Exit code: 0
- Duration: 219ms

### Args
```
onchainos security token-scan --tokens 196:0x4ae46a509f6b1d9056937ba4500cb143933d2dc8
```

### Parsed Response
```json
{
  "ok": true,
  "data": [
    {
      "buyTaxes": "0",
      "chainId": "196",
      "isAirdropScam": false,
      "isChainSupported": true,
      "isCounterfeit": false,
      "isDumping": false,
      "isFakeLiquidity": false,
      "isFundLinkage": false,
      "isHasAssetEditAuth": false,
      "isHasBlockingHis": false,
      "isHasFrozenAuth": false,
      "isHoneypot": false,
      "isLiquidityRemoval": false,
      "isLowLiquidity": false,
      "isMintable": true,
      "isNotRenounced": false,
      "isOverIssued": false,
      "isPump": false,
      "isRiskToken": false,
      "isRubbishAirdrop": false,
      "isVeryHighLpHolderProp": false,
      "isVeryLowLpBurn": false,
      "isWash": false,
      "isWash2": false,
      "sellTaxes": "0",
      "tokenAddress": "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8"
    }
  ]
}
```

## `security token-scan` (wallet-consumer)
- OK: true
- Exit code: 0
- Duration: 216ms

### Args
```
onchainos security token-scan --address 0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25 --chain 196
```

### Parsed Response
```json
{
  "ok": true,
  "data": []
}
```

## `security tx-scan` (usdg-transfer)
- OK: true
- Exit code: 0
- Duration: 314ms

### Args
```
onchainos security tx-scan --from 0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25 --to 0x4ae46a509f6b1d9056937ba4500cb143933d2dc8 --chain 196 --data 0xa9059cbb000000000000000000000000dfe57c7775f09599d12d11370a0afcb27f6aadbc00000000000000000000000000000000000000000000000000038d7ea4c68000 --value 0x0
```

### Parsed Response
```json
{
  "ok": true,
  "data": {
    "action": "",
    "riskItemDetail": [],
    "simulator": {
      "gasLimit": null,
      "gasUsed": null,
      "revertReason": "execution reverted"
    },
    "warnings": null
  }
}
```

## `security approvals` (consumer)
- OK: true
- Exit code: 0
- Duration: 217ms

### Args
```
onchainos security approvals --address 0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25 --chain 196 --limit 10
```

### Parsed Response
```json
{
  "ok": true,
  "data": [
    {
      "cursor": 0,
      "dataList": [],
      "total": 0
    }
  ]
}
```

## `security dapp-scan` (okx)
- OK: true
- Exit code: 0
- Duration: 192ms

### Args
```
onchainos security dapp-scan --domain https://web3.okx.com
```

### Parsed Response
```json
{
  "ok": true,
  "data": {
    "isMalicious": false
  }
}
```

## `security dapp-scan` (suspicious-control)
- OK: true
- Exit code: 0
- Duration: 198ms

### Args
```
onchainos security dapp-scan --domain http://okx-airdrop-claim.net
```

### Parsed Response
```json
{
  "ok": true,
  "data": {
    "isMalicious": false
  }
}
```
