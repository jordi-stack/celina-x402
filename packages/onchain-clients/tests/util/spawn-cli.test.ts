import { describe, it, expect } from 'vitest';
import { spawnCli } from '../../src/util/spawn-cli';

// Uses real `echo` and `sh` as stand-ins for onchainos CLI in tests.
describe('spawnCli', () => {
  it('resolves with stdout on success', async () => {
    const result = await spawnCli('echo', ['hello']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('captures stdout and stderr separately', async () => {
    const result = await spawnCli('sh', ['-c', 'echo out; echo err 1>&2']);
    expect(result.stdout.trim()).toBe('out');
    expect(result.stderr.trim()).toBe('err');
  });

  it('returns non-zero exitCode without throwing by default', async () => {
    const result = await spawnCli('sh', ['-c', 'exit 2']);
    expect(result.exitCode).toBe(2);
  });

  it('parseJson returns parsed stdout when command outputs JSON', async () => {
    const result = await spawnCli('sh', ['-c', 'echo \'{"ok":true,"value":42}\'']);
    expect(result.exitCode).toBe(0);
    const parsed = result.parseJson<{ ok: boolean; value: number }>();
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toBe(42);
  });

  it('parseJson throws on invalid JSON', async () => {
    const result = await spawnCli('echo', ['not-json']);
    expect(() => result.parseJson()).toThrow();
  });
});
