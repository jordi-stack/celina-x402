import { spawnCli } from './util/spawn-cli';
import type { Accept } from '@x402/shared';

export interface SignPaymentOptions {
  accepts: Accept[];
  from?: string;
}

export interface PaymentProof {
  signature: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
  };
  sessionCert?: string;
}

/**
 * Wrapper for `onchainos payment x402-pay` CLI command.
 *
 * CLI v2.2.8 is non-interactive by design (verified via Day-1 CLI spike):
 * no TTY prompts, no --force flag, no confirming response. This wrapper is
 * correspondingly simple: invoke spawnCli with --accepts (optionally --from),
 * throw on any non-zero exit, parse JSON on success.
 */
export class X402PaymentClient {
  async signPayment(opts: SignPaymentOptions): Promise<PaymentProof> {
    const acceptsJson = JSON.stringify(opts.accepts);
    const args: string[] = ['payment', 'x402-pay', '--accepts', acceptsJson];
    if (opts.from) args.push('--from', opts.from);

    const result = await spawnCli('onchainos', args, {});
    if (result.exitCode !== 0) {
      throw new Error(`x402-pay failed: ${result.stderr || result.stdout || 'unknown error'}`);
    }
    return result.parseJson<PaymentProof>();
  }
}
