# MCP Spike Findings

**Run at:** 2026-04-13T19:32:08.828Z
**Endpoint:** https://web3.okx.com/api/v1/onchainos-mcp
**Tools tested:** 3
**All OK:** true

## `dex-okx-dex-aggregator-supported-chains`
- Status: 200
- Duration: 210ms
- OK: true

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 597730574,
  "result": {
    "content": [
      {
        "text": "{\n  \"code\" : \"0\",\n  \"data\" : [ {\n    \"chainId\" : 137,\n    \"chainIndex\" : 137,\n    \"chainName\" : \"Polygon\",\n    \"dexTokenApproveAddress\" : \"0x3B86917369B83a6892f553609F3c2F439C184e31\"\n  }, {\n    \"chainId\" : 195,\n    \"chainIndex\" : 195,\n    \"chainName\" : \"TRON\",\n    \"dexTokenApproveAddress\" : \"THRAE2VhGNAcvPKtT96AqyXtSQwhiU1XL8\"\n  }, {\n    \"chainId\" : 43114,\n    \"chainIndex\" : 43114,\n    \"chainName\" : \"Avalanche C\",\n    \"dexTokenApproveAddress\" : \"0x40aA958dd87FC8305b97f2BA922CDdCa374bcD7f\"\n  }, {\n    \"chainId\" : 1,\n    \"chainIndex\" : 1,\n    \"chainName\" : \"Ethereum\",\n    \"dexTokenApproveAddress\" : \"0x40aA958dd87FC8305b97f2BA922CDdCa374bcD7f\"\n  }, {\n    \"chainId\" : 66,\n    \"chainIndex\" : 66,\n    \"chainName\" : \"OKTC\",\n    \"dexTokenApproveAddress\" : \"0x70cBb871E8f30Fc8Ce23609E9E0Ea87B6b222F58\"\n  }, {\n    \"chainId\" : 56,\n    \"chainIndex\" : 56,\n    \"chainName\" : \"BNB chain\",\n    \"dexTokenApproveAddress\" : \"0x2c34A2Fb1d0b4f55de51E1d0bDEfaDDce6b7cDD6\"\n  }, {\n    \"chainId\" : 250,\n    \"chainIndex\" : 250,\n    \"chainName\" : \"Fantom\",\n    \"dexTokenApproveAddress\" : \"0x70cBb871E8f30Fc8Ce23609E9E0Ea87B6b222F58\"\n  }, {\n    \"chainId\" : 42161,\n    \"chainIndex\" : 42161,\n    \"chainName\" : \"Arbitrum\",\n    \"dexTokenApproveAddress\" : \"0x70cBb871E8f30Fc8Ce23609E9E0Ea87B6b222F58\"\n  }, {\n    \"chainId\" : 10,\n    \"chainIndex\" : 10,\n    \"chainName\" : \"Optimism\",\n    \"dexTokenApproveAddress\" : \"0x68D6B739D2020067D1e2F713b999dA97E4d54812\"\n  }, {\n    \"chainId\" : 25,\n    \"chainIndex\" : 25,\n    \"chainName\" : \"Cronos\",\n    \"dexTokenApproveAddress\" : \"0x70cbb871e8f30fc8ce23609e9e0ea87b6b222f58\"\n  }, {\n    \"chainId\" : 501,\n    \"chainIndex\" : 501,\n    \"chainName\" : \"Solana\",\n    \"dexTokenApproveAddress\" : \"\"\n  }, {\n    \"chainId\" : 324,\n    \"chainIndex\" : 324,\n    \"chainName\" : \"zkSync Era\",\n    \"dexTokenApproveAddress\" : \"0xc67879F4065d3B9fe1C09EE990B891Aa8E3a4c2f\"\n  }, {\n    \"chainId\" : 1030,\n    \"chainIndex\" : 1030,\n    \"chainName\" : \"Conflux eSpace\",\n    \"dexTokenApproveAddress\" : \"0x68D6B739D2020067D1e2F713b999dA97E4d54812\"\n  }, {\n    \"chainId\" : 784,\n    \"chainIndex\" : 784,\n    \"chainName\" : \"SUI\",\n    \"dexTokenApproveAddress\" : \"\"\n  }, {\n    \"chainId\" : 1101,\n    \"chainIndex\" : 1101,\n    \"chainName\" : \"Polygon zkEvm\",\n    \"dexTokenApproveAddress\" : \"0x57df6092665eb6058DE53939612413ff4B09114E\"\n  }, {\n    \"chainId\" : 59144,\n    \"chainIndex\" : 59144,\n    \"chainName\" : \"Linea\",\n    \"dexTokenApproveAddress\" : \"0x57df6092665eb6058DE53939612413ff4B09114E\"\n  }, {\n    \"chainId\" : 5000,\n    \"chainIndex\" : 5000,\n    \"chainName\" : \"Mantle\",\n    \"dexTokenApproveAddress\" : \"0x57df6092665eb6058DE53939612413ff4B09114E\"\n  }, {\n    \"chainId\" : 8453,\n    \"chainIndex\" : 8453,\n    \"chainName\" : \"Base\",\n    \"dexTokenApproveAddress\" : \"0x57df6092665eb6058DE53939612413ff4B09114E\"\n  }, {\n    \"chainId\" : 534352,\n    \"chainIndex\" : 534352,\n    \"chainName\" : \"Scroll\",\n    \"dexTokenApproveAddress\" : \"0x57df6092665eb6058DE53939612413ff4B09114E\"\n  }, {\n    \"chainId\" : 196,\n    \"chainIndex\" : 196,\n    \"chainName\" : \"X Layer\",\n    \"dexTokenApproveAddress\" : \"0x8b773D83bc66Be128c60e07E17C8901f7a64F000\"\n  }, {\n    \"chainId\" : 169,\n    \"chainIndex\" : 169,\n    \"chainName\" : \"Manta Pacific\",\n    \"dexTokenApproveAddress\" : \"0x57df6092665eb6058DE53939612413ff4B09114E\"\n  }, {\n    \"chainId\" : 1088,\n    \"chainIndex\" : 1088,\n    \"chainName\" : \"Metis\",\n    \"dexTokenApproveAddress\" : \"0x57df6092665eb6058DE53939612413ff4B09114E\"\n  }, {\n    \"chainId\" : 7000,\n    \"chainIndex\" : 7000,\n    \"chainName\" : \"Zeta\",\n    \"dexTokenApproveAddress\" : \"0x03B5ACdA01207824cc7Bc21783Ee5aa2B8d1D2fE\"\n  }, {\n    \"chainId\" : 4200,\n    \"chainIndex\" : 4200,\n    \"chainName\" : \"Merlin\",\n    \"dexTokenApproveAddress\" : \"0x8b773D83bc66Be128c60e07E17C8901f7a64F000\"\n  }, {\n    \"chainId\" : 81457,\n    \"chainIndex\" : 81457,\n    \"chainName\" : \"Blast\",\n    \"dexTokenApproveAddress\" : \"0x5fD2Dc91FF1dE7FF4AEB1CACeF8E9911bAAECa68\"\n  }, {\n    \"chainId\" : 607,\n    \"chainIndex\" : 607,\n    \"chainName\" : \"TON\",\n    \"dexTokenApproveAddress\" : \"\"\n  }, {\n    \"chainId\" : 146,\n    \"chainIndex\" : 146,\n    \"chainName\" : \"Sonic\",\n    \"dexTokenApproveAddress\" : \"0xd321ab5589d3e8fa5df985ccfef625022e2dd910\"\n  }, {\n    \"chainId\" : 130,\n    \"chainIndex\" : 130,\n    \"chainName\" : \"Unichain\",\n    \"dexTokenApproveAddress\" : \"0x2e28281Cf3D58f475cebE27bec4B8a23dFC7782c\"\n  }, {\n    \"chainId\" : 9745,\n    \"chainIndex\" : 9745,\n    \"chainName\" : \"Plasma\",\n    \"dexTokenApproveAddress\" : \"0x9FD43F5E4c24543b2eBC807321E58e6D350d6a5A\"\n  }, {\n    \"chainId\" : 143,\n    \"chainIndex\" : 143,\n    \"chainName\" : \"Monad\",\n    \"dexTokenApproveAddress\" : \"0xf534A8a1CAD0543Cd6438f7534CA3486c01998d4\"\n  } ],\n  \"msg\" : \"\"\n}",
        "type": "text"
      }
    ]
  }
}
```

## `dex-okx-dex-quote`
- Status: 200
- Duration: 129ms
- OK: true

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 594008174,
  "result": {
    "content": [
      {
        "text": "{\n  \"code\" : \"0\",\n  \"data\" : [ {\n    \"chainIndex\" : \"196\",\n    \"contextSlot\" : 57336360,\n    \"dexRouterList\" : [ {\n      \"dexProtocol\" : {\n        \"dexName\" : \"PotatoSwap V3\",\n        \"percent\" : \"100\"\n      },\n      \"fromToken\" : {\n        \"decimal\" : \"6\",\n        \"isHoneyPot\" : false,\n        \"taxRate\" : \"0\",\n        \"tokenContractAddress\" : \"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8\",\n        \"tokenSymbol\" : \"USDG\",\n        \"tokenUnitPrice\" : \"1\"\n      },\n      \"fromTokenIndex\" : \"0\",\n      \"toToken\" : {\n        \"decimal\" : \"6\",\n        \"isHoneyPot\" : false,\n        \"taxRate\" : \"0\",\n        \"tokenContractAddress\" : \"0x779ded0c9e1022225f8e0630b35a9b54be713736\",\n        \"tokenSymbol\" : \"USDT\",\n        \"tokenUnitPrice\" : \"1.00027\"\n      },\n      \"toTokenIndex\" : \"1\"\n    } ],\n    \"estimateGasFee\" : \"288000\",\n    \"fromToken\" : {\n      \"decimal\" : \"6\",\n      \"isHoneyPot\" : false,\n      \"taxRate\" : \"0\",\n      \"tokenContractAddress\" : \"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8\",\n      \"tokenSymbol\" : \"USDG\",\n      \"tokenUnitPrice\" : \"1\"\n    },\n    \"fromTokenAmount\" : \"1000000\",\n    \"priceImpactPercent\" : \"0\",\n    \"router\" : \"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8--0x779ded0c9e1022225f8e0630b35a9b54be713736\",\n    \"swapMode\" : \"exactIn\",\n    \"toToken\" : {\n      \"decimal\" : \"6\",\n      \"isHoneyPot\" : false,\n      \"taxRate\" : \"0\",\n      \"tokenContractAddress\" : \"0x779ded0c9e1022225f8e0630b35a9b54be713736\",\n      \"tokenSymbol\" : \"USDT\",\n      \"tokenUnitPrice\" : \"1.00027\"\n    },\n    \"toTokenAmount\" : \"999700\",\n    \"tradeFee\" : \"0.00058614623606784\"\n  } ],\n  \"msg\" : \"\"\n}",
        "type": "text"
      }
    ]
  }
}
```

## `dex-okx-market-token-price-info`
- Status: 200
- Duration: 103ms
- OK: true

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 49789554,
  "result": {
    "content": [
      {
        "text": "{\n  \"code\" : \"0\",\n  \"data\" : [ {\n    \"chainIndex\" : \"196\",\n    \"circSupply\" : \"268450000\",\n    \"holders\" : \"44574\",\n    \"liquidity\" : \"2932526.655694034962437\",\n    \"marketCap\" : \"268491402.52783983621305\",\n    \"maxPrice\" : \"1.000415735203879056\",\n    \"minPrice\" : \"0.998946800882515168\",\n    \"price\" : \"1.000154228079120269\",\n    \"priceChange1H\" : \"-0.01\",\n    \"priceChange24H\" : \"-0.01\",\n    \"priceChange4H\" : \"-0.01\",\n    \"priceChange5M\" : \"0\",\n    \"time\" : \"1776108728826\",\n    \"tokenContractAddress\" : \"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8\",\n    \"tradeNum\" : \"45712.032687\",\n    \"txs1H\" : \"10\",\n    \"txs24H\" : \"90\",\n    \"txs4H\" : \"13\",\n    \"txs5M\" : \"0\",\n    \"volume1H\" : \"41559.37851448179\",\n    \"volume24H\" : \"45719.43598002366\",\n    \"volume4H\" : \"41661.05447410994\",\n    \"volume5M\" : \"0\"\n  } ],\n  \"msg\" : \"\"\n}",
        "type": "text"
      }
    ]
  }
}
```

## Schema Analysis

### dex-okx-dex-quote - Actual vs Pre-Spike Assumptions

All tool responses are wrapped: `result.content[0].text` is a JSON string containing `{ code, data: [...], msg }`.

Pre-spike `QuoteSchema` had wrong field names. Actual quote object (inside `data[0]`):

| Field | Type | Note |
|---|---|---|
| `chainIndex` | `string` | was assumed, confirmed |
| `contextSlot` | `number` | new - not in pre-spike schema |
| `fromTokenAmount` | `string` | confirmed |
| `toTokenAmount` | `string` | confirmed |
| `priceImpactPercent` | `string` | pre-spike had `priceImpactPercentage` (wrong) |
| `estimateGasFee` | `string` | confirmed |
| `tradeFee` | `string` | new - not in pre-spike schema |
| `router` | `string` | new - not in pre-spike schema |
| `swapMode` | `string` | new - not in pre-spike schema |
| `fromToken.tokenContractAddress` | `string` | pre-spike had `address` (wrong) |
| `fromToken.tokenSymbol` | `string` | pre-spike had `symbol` (wrong) |
| `fromToken.decimal` | `string` | confirmed |
| `fromToken.isHoneyPot` | `boolean` | new |
| `fromToken.taxRate` | `string` | new |
| `fromToken.tokenUnitPrice` | `string` | new |
| `toToken.*` | same shape as fromToken | same corrections |
| `dexRouterList[].dexProtocol` | `{ dexName: string, percent: string }` | pre-spike had flat `dexName` and `ratio` (both wrong) |
| `dexRouterList[].fromToken` | same token shape | new |
| `dexRouterList[].toToken` | same token shape | new |
| `dexRouterList[].fromTokenIndex` | `string` | new |
| `dexRouterList[].toTokenIndex` | `string` | new |

Also: `QuoteParamsSchema` was missing `swapMode` (required). `slippage` is not a valid param; correct optional params include `dexIds`, `directRoute`, `priceImpactProtectionPercent`, `feePercent`.

### dex-okx-market-token-price-info - Actual vs Pre-Spike Assumptions

Tool takes `{ items: [{ chainIndex, tokenContractAddress }] }` - not flat params. Pre-spike `TokenPriceInfoParamsSchema` was wrong shape.

Actual token price object (inside `data[0]`):

| Field | Type | Note |
|---|---|---|
| `chainIndex` | `string` | confirmed |
| `tokenContractAddress` | `string` | pre-spike had `tokenAddress` OR `tokenContractAddress` (both listed) |
| `price` | `string` | confirmed |
| `priceChange24H` | `string` | pre-spike had `priceChange24h` (wrong case) |
| `priceChange1H` | `string` | new |
| `priceChange4H` | `string` | new |
| `priceChange5M` | `string` | new |
| `volume24H` | `string` | pre-spike had `volume24h` (wrong case) |
| `volume1H` | `string` | new |
| `volume4H` | `string` | new |
| `volume5M` | `string` | new |
| `marketCap` | `string` | confirmed |
| `holders` | `string` | pre-spike had `holderCount` (wrong name) |
| `circSupply` | `string` | new |
| `liquidity` | `string` | new |
| `maxPrice` | `string` | new |
| `minPrice` | `string` | new |
| `tradeNum` | `string` | new |
| `txs24H` | `string` | new |
| `txs1H` | `string` | new |
| `txs4H` | `string` | new |
| `txs5M` | `string` | new |
| `time` | `string` | new (unix ms as string) |
| `symbol` | absent | pre-spike assumed; not present in response |

### dex-okx-dex-aggregator-supported-chains

X Layer (chainId 196, chainIndex 196) confirmed present. `dexTokenApproveAddress` is `0x8b773D83bc66Be128c60e07E17C8901f7a64F000`.

## Action Items

1. Update `QuoteParamsSchema`: add required `swapMode`, remove `slippage`, add optional DEX params.
2. Rewrite `QuoteSchema` token sub-object with correct field names (`tokenContractAddress`, `tokenSymbol`, `tokenUnitPrice`, `isHoneyPot`, `taxRate`).
3. Fix `priceImpactPercentage` -> `priceImpactPercent` in `QuoteSchema`.
4. Update `dexRouterList` items: use `dexProtocol` object instead of flat `dexName`/`ratio`.
5. Update `TokenPriceInfoParamsSchema`: wrap in `{ items: [...] }` shape.
6. Rewrite `TokenPriceInfoSchema` with correct field names (24H not 24h, `holders` not `holderCount`, etc.).
7. Remove `.passthrough()` from both schemas once fields are pinned.
8. Update callers of `TokenPriceInfoParamsSchema` to pass `items` wrapper.