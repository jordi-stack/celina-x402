import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { createWalletHistoryFetcher } from '../src/recovery-adapter';

describe('createWalletHistoryFetcher', () => {
  it('fetches recent Producer-side history and maps to WalletHistoryEntry', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify([
        {
          orderList: [
            {
              txHash: '0xTX1',
              txTime: '1700000000000',
              direction: 'receive',
              from: '0xCONSUMER',
              to: '0xPRODUCER',
              coinSymbol: 'USDG',
              coinAmount: '0.01',
            },
          ],
        },
      ]),
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });

    const fetcher = createWalletHistoryFetcher({
      accountId: 'producer-account',
      chain: 'xlayer',
      nonceResolver: (entry) => `0xNONCE_${entry.txHash.slice(-4)}`,
    });

    const entries = await fetcher();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.txHash).toBe('0xTX1');
    expect(entries[0]?.nonce).toBe('0xNONCE_xTX1');
    expect(entries[0]?.timestamp).toBe(1700000000000);
  });

  it('returns empty array when no receive-direction entries exist', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify([{ orderList: [] }]),
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });

    const fetcher = createWalletHistoryFetcher({
      accountId: 'producer-account',
      chain: 'xlayer',
      nonceResolver: () => '',
    });
    const entries = await fetcher();
    expect(entries).toHaveLength(0);
  });
});
