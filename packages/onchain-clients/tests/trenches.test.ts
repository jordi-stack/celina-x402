import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { TrenchesClient } from '../src/trenches';

const mockResult = (stdout: string) => ({
  exitCode: 0,
  stdout,
  stderr: '',
  parseJson<T>() {
    return JSON.parse(this.stdout) as T;
  },
});

describe('TrenchesClient', () => {
  it('tokenDevInfo invokes memepump token-dev-info with address', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult('{"devHoldingInfo":{"address":"0xDEV","rugPullCount":3}}')
    );
    const client = new TrenchesClient();
    const info = await client.tokenDevInfo('0xTOKEN');
    expect(info.devHoldingInfo?.rugPullCount).toBe(3);
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['memepump', 'token-dev-info', '--address', '0xTOKEN'],
      expect.any(Object)
    );
  });

  it('bundleInfo invokes memepump token-bundle-info', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult('{"bundleDetected":false,"sniperCount":0}')
    );
    const client = new TrenchesClient();
    await client.bundleInfo('0xTOKEN');
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['memepump', 'token-bundle-info', '--address', '0xTOKEN'],
      expect.any(Object)
    );
  });
});
