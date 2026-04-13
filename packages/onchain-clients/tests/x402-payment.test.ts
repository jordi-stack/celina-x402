import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { X402PaymentClient } from '../src/x402-payment';

const mockResult = (stdout: string, exitCode = 0, stderr = '') => ({
  exitCode,
  stdout,
  stderr,
  parseJson<T>() {
    return JSON.parse(this.stdout) as T;
  },
});

describe('X402PaymentClient', () => {
  it('signPayment invokes x402-pay with accepts JSON and returns proof', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult(
        '{"signature":"0xSIG","authorization":{"from":"0xA","to":"0xB","value":"10000","validAfter":"0","validBefore":"1000","nonce":"0xNONCE"}}'
      )
    );

    const client = new X402PaymentClient();
    const accepts = [
      {
        scheme: 'exact' as const,
        network: 'eip155:196' as const,
        amount: '10000',
        asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
        payTo: '0xTO',
        maxTimeoutSeconds: 60,
        extra: { name: 'USDG', version: '2' },
      },
    ];
    const proof = await client.signPayment({ accepts });

    expect(proof.signature).toBe('0xSIG');
    expect(proof.authorization.nonce).toBe('0xNONCE');
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['payment', 'x402-pay', '--accepts', JSON.stringify(accepts)],
      expect.any(Object)
    );
    // Verify no --force flag passed (obsolete in v2.2.8)
    const calledArgs = spy.mock.calls[0]![1] as string[];
    expect(calledArgs).not.toContain('--force');
  });

  it('passes --from flag when opts.from is provided', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult(
        '{"signature":"0xSIG","authorization":{"from":"0xA","to":"0xB","value":"10000","validAfter":"0","validBefore":"1000","nonce":"0xN"}}'
      )
    );
    const client = new X402PaymentClient();
    await client.signPayment({ accepts: [], from: '0xPAYER' });
    const args = spy.mock.calls[0]![1] as string[];
    expect(args).toContain('--from');
    expect(args).toContain('0xPAYER');
  });

  it('throws on non-zero exit code', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult('', 1, 'error: signing failed')
    );
    const client = new X402PaymentClient();
    await expect(client.signPayment({ accepts: [] })).rejects.toThrow(/signing failed/);
  });
});
