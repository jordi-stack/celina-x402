# MCP Balance Spike Findings

**Run at:** 2026-04-14T14:03:52.481Z
**Endpoint:** https://web3.okx.com/api/v1/onchainos-mcp
**Chain:** X Layer (chain index 196)
**USDG contract:** 0x4ae46a509f6b1d9056937ba4500cb143933d2dc8
**Consumer address:** 0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25
**Producer address:** 0xdfe57c7775f09599d12d11370a0afcb27f6aadbc

## Purpose

Move 1 of the final score push adds a Live Balance card to the dashboard that
reads Consumer + Producer USDG balance directly from the OKX MCP Server so
the earn-pay-earn loop is visually obvious during the demo. Before writing
Zod schemas from assumed shape (which burned us with swapMode), capture the
real shape live.

## `dex-okx-balance-specific-token-balance` (plural-string-consumer)
- Status: 200
- Duration: 236ms
- OK: true

### Args
```json
{
  "chainIndex": "196",
  "address": "0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25",
  "tokenContractAddresses": "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8"
}
```

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 195911941,
  "result": {
    "content": [
      {
        "text": "Error: 400  on POST request for \"https://web3.okx.com/api/v6/dex/balance/token-balances-by-address\": \"{<EOL>  \"code\" : \"81001\",<EOL>  \"msg\" : \"JSON parse error: Cannot deserialize value of type `java.util.ArrayList<com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO$TokenContractAddressVO>` from String value (token `JsonToken.VALUE_STRING`); nested exception is com.fasterxml.jackson.databind.exc.MismatchedInputException: Cannot deserialize value of type `java.util.ArrayList<com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO$TokenContractAddressVO>` from String value (token `JsonToken.VALUE_STRING`)\\n at [Source: REDACTED (`StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION` disabled); line: 1, column: 101] (through reference chain: com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO[\\\"tokenContractAddresses\\\"])\",<EOL>  \"data\" : [ ]<EOL>}\"",
        "type": "text"
      }
    ]
  }
}
```

## `dex-okx-balance-specific-token-balance` (plural-string-producer)
- Status: 200
- Duration: 128ms
- OK: true

### Args
```json
{
  "chainIndex": "196",
  "address": "0xdfe57c7775f09599d12d11370a0afcb27f6aadbc",
  "tokenContractAddresses": "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8"
}
```

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 882957016,
  "result": {
    "content": [
      {
        "text": "Error: 400  on POST request for \"https://web3.okx.com/api/v6/dex/balance/token-balances-by-address\": \"{<EOL>  \"code\" : \"81001\",<EOL>  \"msg\" : \"JSON parse error: Cannot deserialize value of type `java.util.ArrayList<com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO$TokenContractAddressVO>` from String value (token `JsonToken.VALUE_STRING`); nested exception is com.fasterxml.jackson.databind.exc.MismatchedInputException: Cannot deserialize value of type `java.util.ArrayList<com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO$TokenContractAddressVO>` from String value (token `JsonToken.VALUE_STRING`)\\n at [Source: REDACTED (`StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION` disabled); line: 1, column: 101] (through reference chain: com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO[\\\"tokenContractAddresses\\\"])\",<EOL>  \"data\" : [ ]<EOL>}\"",
        "type": "text"
      }
    ]
  }
}
```

## `dex-okx-balance-specific-token-balance` (plural-array)
- Status: 200
- Duration: 117ms
- OK: true

### Args
```json
{
  "chainIndex": "196",
  "address": "0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25",
  "tokenContractAddresses": [
    "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8"
  ]
}
```

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 642997199,
  "result": {
    "content": [
      {
        "text": "Error: 400  on POST request for \"https://web3.okx.com/api/v6/dex/balance/token-balances-by-address\": \"{<EOL>  \"code\" : \"81001\",<EOL>  \"msg\" : \"JSON parse error: Cannot construct instance of `com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO$TokenContractAddressVO` (although at least one Creator exists): no String-argument constructor/factory method to deserialize from String value ('0x4ae46a509f6b1d9056937ba4500cb143933d2dc8'); nested exception is com.fasterxml.jackson.databind.exc.MismatchedInputException: Cannot construct instance of `com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO$TokenContractAddressVO` (although at least one Creator exists): no String-argument constructor/factory method to deserialize from String value ('0x4ae46a509f6b1d9056937ba4500cb143933d2dc8')\\n at [Source: REDACTED (`StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION` disabled); line: 1, column: 102] (through reference chain: com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO[\\\"tokenContractAddresses\\\"]->java.util.ArrayList[0])\",<EOL>  \"data\" : [ ]<EOL>}\"",
        "type": "text"
      }
    ]
  }
}
```

## `dex-okx-balance-specific-token-balance` (chains-plural)
- Status: 200
- Duration: 119ms
- OK: true

### Args
```json
{
  "chains": "196",
  "address": "0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25",
  "tokenContractAddresses": "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8"
}
```

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 501860949,
  "result": {
    "content": [
      {
        "text": "Error: 400  on POST request for \"https://web3.okx.com/api/v6/dex/balance/token-balances-by-address\": \"{<EOL>  \"code\" : \"81001\",<EOL>  \"msg\" : \"JSON parse error: Cannot deserialize value of type `java.util.ArrayList<java.lang.Integer>` from String value (token `JsonToken.VALUE_STRING`); nested exception is com.fasterxml.jackson.databind.exc.MismatchedInputException: Cannot deserialize value of type `java.util.ArrayList<java.lang.Integer>` from String value (token `JsonToken.VALUE_STRING`)\\n at [Source: REDACTED (`StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION` disabled); line: 1, column: 11] (through reference chain: com.okcoin.wallet.ocos.api.vo.asset.AddressAndTokenAddressesAssetsVO[\\\"chains\\\"])\",<EOL>  \"data\" : [ ]<EOL>}\"",
        "type": "text"
      }
    ]
  }
}
```

## `dex-okx-balance-total-token-balances` (chains-string-consumer)
- Status: 200
- Duration: 114ms
- OK: true

### Args
```json
{
  "chains": "196",
  "address": "0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25"
}
```

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 257237719,
  "result": {
    "content": [
      {
        "text": "{\n  \"code\" : \"0\",\n  \"msg\" : \"success\",\n  \"data\" : [ {\n    \"tokenAssets\" : [ {\n      \"chainIndex\" : \"196\",\n      \"symbol\" : \"USDG\",\n      \"balance\" : \"1.940611\",\n      \"tokenPrice\" : \"1\",\n      \"isRiskToken\" : false,\n      \"rawBalance\" : \"1940611\",\n      \"address\" : \"0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25\",\n      \"tokenContractAddress\" : \"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8\"\n    } ]\n  } ]\n}",
        "type": "text"
      }
    ]
  }
}
```

## `dex-okx-balance-total-token-balances` (chains-string-producer)
- Status: 200
- Duration: 131ms
- OK: true

### Args
```json
{
  "chains": "196",
  "address": "0xdfe57c7775f09599d12d11370a0afcb27f6aadbc"
}
```

### Raw Response
```json
{
  "jsonrpc": "2.0",
  "id": 245700359,
  "result": {
    "content": [
      {
        "text": "{\n  \"code\" : \"0\",\n  \"msg\" : \"success\",\n  \"data\" : [ {\n    \"tokenAssets\" : [ {\n      \"chainIndex\" : \"196\",\n      \"symbol\" : \"USDG\",\n      \"balance\" : \"0.0345\",\n      \"tokenPrice\" : \"1\",\n      \"isRiskToken\" : false,\n      \"rawBalance\" : \"34500\",\n      \"address\" : \"0xdfe57c7775f09599d12d11370a0afcb27f6aadbc\",\n      \"tokenContractAddress\" : \"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8\"\n    } ]\n  } ]\n}",
        "type": "text"
      }
    ]
  }
}
```
