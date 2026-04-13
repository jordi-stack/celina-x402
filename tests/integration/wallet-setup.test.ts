import { describe, it, expect } from 'vitest';
import { WalletClient } from '../../packages/onchain-clients/src/wallet';

const SKIP = process.env.RUN_INTEGRATION !== '1';

describe.skipIf(SKIP)('wallet-setup integration', () => {
  it('wallet status returns loggedIn with >=2 accounts', async () => {
    const client = new WalletClient();
    const status = await client.status();
    expect(status.loggedIn).toBe(true);
    expect(status.accountCount).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('can switch to current account (idempotent)', async () => {
    const client = new WalletClient();
    const status = await client.status();
    const originalId = status.currentAccountId;
    await client.switchAccount(originalId);
    const after = await client.status();
    expect(after.currentAccountId).toBe(originalId);
  }, 30_000);

  it('consumer balance call returns without error', async () => {
    const consumerId = process.env.CONSUMER_ACCOUNT_ID;
    if (!consumerId) throw new Error('CONSUMER_ACCOUNT_ID not set');
    const client = new WalletClient();
    await client.switchAccount(consumerId);
    const balance = await client.balance({
      chain: 'xlayer',
      tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    });
    expect(balance).toBeDefined();
  }, 30_000);
});
