import { execa, type Options } from 'execa';

export interface SpawnCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  parseJson<T = unknown>(): T;
}

export interface SpawnCliOptions {
  timeoutMs?: number;
  env?: Record<string, string>;
}

/**
 * Thin wrapper around execa that normalizes output shape for CLI wrappers.
 * Uses execFile semantics (no shell injection).
 * Never throws on non-zero exit (caller decides).
 * Provides .parseJson() helper for CLI commands that output JSON.
 */
export async function spawnCli(
  command: string,
  args: readonly string[],
  options: SpawnCliOptions = {}
): Promise<SpawnCliResult> {
  const execaOpts: Options = {
    reject: false,
    timeout: options.timeoutMs ?? 30_000,
    ...(options.env ? { env: { ...process.env, ...options.env } } : {}),
  };
  const result = await execa(command, args, execaOpts);

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  const exitCode = result.exitCode ?? -1;

  return {
    exitCode,
    stdout,
    stderr,
    parseJson<T = unknown>(): T {
      return JSON.parse(stdout) as T;
    },
  };
}
