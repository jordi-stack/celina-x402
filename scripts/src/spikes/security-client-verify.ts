#!/usr/bin/env tsx
/**
 * Live verification that SecurityClient helper methods parse the real CLI
 * responses under the new Zod schemas. Not tracked as a schema-capture spike
 * (shape already captured in security-spike.md); this is a contract test.
 */
import { SecurityClient } from '@x402/onchain-clients';
import { USDG_CONTRACT } from '@x402/shared';

const CONSUMER_ADDRESS = '0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25';

async function main() {
  const sc = new SecurityClient();

  console.log('1/3 tokenScan USDG...');
  const scan = await sc.tokenScan({
    chainId: '196',
    tokenAddress: USDG_CONTRACT,
  });
  console.log(
    `  isHoneypot=${scan?.isHoneypot} isRiskToken=${scan?.isRiskToken} buyTaxes=${scan?.buyTaxes} sellTaxes=${scan?.sellTaxes}`
  );

  console.log('2/3 dappScan web3.okx.com...');
  const dapp = await sc.dappScan('https://web3.okx.com');
  console.log(`  isMalicious=${dapp.isMalicious}`);

  console.log('3/3 approvals Consumer...');
  const app = await sc.approvals({
    address: CONSUMER_ADDRESS,
    chain: '196',
    limit: 5,
  });
  console.log(`  total=${app.total} entries=${app.dataList.length}`);

  console.log('\nAll 3 SecurityClient calls parsed under Zod schemas.');
}

main().catch((e) => {
  console.error('VERIFY FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
