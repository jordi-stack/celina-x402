import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { WalletClient } from '../src/wallet';

describe('WalletClient', () => {
  it('status() returns parsed loggedIn + accountCount', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout:
        '{"email":"test@example.com","loggedIn":true,"currentAccountId":"acct-1","currentAccountName":"Wallet 1","accountCount":2,"policy":null}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    const status = await client.status();
    expect(status.loggedIn).toBe(true);
    expect(status.accountCount).toBe(2);
    expect(status.currentAccountId).toBe('acct-1');
  });

  it('switchAccount invokes wallet switch with accountId', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '{"ok":true}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await client.switchAccount('acct-2');
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['wallet', 'switch', 'acct-2'],
      expect.any(Object)
    );
  });

  it('balance(chain, tokenAddress) invokes wallet balance with correct flags', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '{"details":[]}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await client.balance({
      chain: 'xlayer',
      tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    });
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      [
        'wallet',
        'balance',
        '--chain',
        'xlayer',
        '--token-address',
        '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      ],
      expect.any(Object)
    );
  });

  it('sendToken invokes wallet send with --contract-token', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '{"txHash":"0xTXHASH"}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    const result = await client.sendToken({
      chain: 'xlayer',
      recipient: '0xRECIPIENT',
      readableAmount: '0.01',
      contractToken: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    });
    expect(result.txHash).toBe('0xTXHASH');
    expect(spy).toHaveBeenCalled();
  });

  it('getHistory invokes wallet history with --account-id', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '[{"cursor":"","orderList":[]}]',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await client.getHistory({ accountId: 'acct-1', chain: 'xlayer' });
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      expect.arrayContaining(['wallet', 'history', '--account-id', 'acct-1']),
      expect.any(Object)
    );
  });

  it('throws on non-zero exit code', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error: not logged in',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await expect(client.status()).rejects.toThrow(/not logged in/);
  });
});
