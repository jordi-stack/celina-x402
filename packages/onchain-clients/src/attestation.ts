import {
  encodeFunctionData,
  keccak256,
  stringToBytes,
  toHex,
  type Hex,
} from 'viem';
import { spawnCli } from './util/spawn-cli';
import { unwrapEnvelope } from './wallet';

// Minimal ABI fragment for CelinaAttestation.sol. We only need the
// write method (attest) for client-side encoding; read paths go via
// eth_call on the RPC directly (see getAttestationFromChain below).
export const CELINA_ATTESTATION_ABI = [
  {
    type: 'function',
    name: 'attest',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionHash', type: 'bytes32' },
      { name: 'verdictHash', type: 'bytes32' },
      { name: 'verdict', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getAttestation',
    stateMutability: 'view',
    inputs: [{ name: 'sessionHash', type: 'bytes32' }],
    outputs: [
      { name: 'attester', type: 'address' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'verdictHash', type: 'bytes32' },
      { name: 'verdict', type: 'string' },
    ],
  },
  {
    type: 'function',
    name: 'totalAttestations',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export interface AttestationClientConfig {
  contractAddress: Hex;
  chain: string;
  accountAddress: string;
}

export interface AttestationResult {
  sessionHash: Hex;
  verdictHash: Hex;
  txHash: string;
}

export interface MessageSignature {
  signature: string;
  signer: string;
}

/**
 * Wrapper around onchainos `wallet contract-call` targeted at the
 * deployed CelinaAttestation contract on X Layer chain 196.
 *
 * attest(): signs + broadcasts a `attest(bytes32,bytes32,string)` tx
 * using the currently-selected account in the onchainos wallet. The
 * caller is responsible for switching to the Consumer account first
 * via WalletClient.switchAccount() because the onchainos CLI is
 * stateful across processes.
 *
 * signVerdict(): calls onchainos `wallet sign-message --type personal`
 * to produce an EIP-191 signature over the canonical verdict bytes.
 * Combined with the on-chain attestation, this gives a trust chain a
 * verifier can walk: recompute canonical bytes -> check signature
 * recovers the signer -> compare signer address to the on-chain
 * attester -> hash canonical bytes -> compare to on-chain verdictHash.
 */
export class AttestationClient {
  constructor(private readonly config: AttestationClientConfig) {}

  /**
   * Derive the session hash used as the primary key on-chain. Keccak256
   * of the session id bytes so every session maps to a unique slot.
   */
  hashSessionId(sessionId: string): Hex {
    return keccak256(stringToBytes(sessionId));
  }

  /**
   * Derive the verdict hash from a canonical verdict string. The caller
   * produces the canonical bytes via shared.canonicalStringify() so the
   * same hash is computable off-chain and re-verifiable later.
   */
  hashVerdictPayload(canonicalJson: string): Hex {
    return keccak256(stringToBytes(canonicalJson));
  }

  async signVerdict(canonicalJson: string): Promise<MessageSignature> {
    // onchainos wallet sign-message prints a JSON envelope with
    // `data.signature` + `data.signer` (in recent CLI versions). We
    // pass the full canonical JSON as the message and use personal
    // signing so any viem-compatible verifier can recover the signer.
    const result = await spawnCli(
      'onchainos',
      [
        'wallet',
        'sign-message',
        '--type',
        'personal',
        '--message',
        canonicalJson,
        '--chain',
        this.config.chain,
        '--from',
        this.config.accountAddress,
        '--force',
      ],
      {}
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `sign-message failed: ${result.stderr || result.stdout || 'unknown'}`
      );
    }
    const data = unwrapEnvelope<unknown>(result, 'sign-message');
    // The CLI returns either { signature } or { signature, signer }
    // depending on version; fall back to our configured signer address
    // because in personalSign the signer is whatever the selected
    // account is, which we already know.
    const maybeObj = data as { signature?: string; signer?: string } | string;
    if (typeof maybeObj === 'string') {
      return { signature: maybeObj, signer: this.config.accountAddress };
    }
    if (!maybeObj?.signature) {
      throw new Error(`sign-message returned no signature: ${JSON.stringify(data)}`);
    }
    return {
      signature: maybeObj.signature,
      signer: maybeObj.signer ?? this.config.accountAddress,
    };
  }

  async attest(input: {
    sessionHash: Hex;
    verdictHash: Hex;
    verdict: string;
  }): Promise<AttestationResult> {
    const calldata = encodeFunctionData({
      abi: CELINA_ATTESTATION_ABI,
      functionName: 'attest',
      args: [input.sessionHash, input.verdictHash, input.verdict],
    });

    const result = await spawnCli(
      'onchainos',
      [
        'wallet',
        'contract-call',
        '--chain',
        this.config.chain,
        '--to',
        this.config.contractAddress,
        '--input-data',
        calldata,
        '--force',
      ],
      {}
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `contract-call failed: ${result.stderr || result.stdout || 'unknown'}`
      );
    }
    const data = unwrapEnvelope<{ txHash?: string }>(result, 'contract-call');
    if (!data.txHash) {
      throw new Error(`contract-call returned no txHash: ${JSON.stringify(data)}`);
    }

    return {
      sessionHash: input.sessionHash,
      verdictHash: input.verdictHash,
      txHash: data.txHash,
    };
  }
}

// Minimal typed helper for reading an attestation from chain via
// eth_call on any public RPC. Kept here as a standalone function so
// the Consumer /verify endpoint doesn't need a full AttestationClient
// instance to answer a read. Returns null when the attestation row
// is empty (timestamp == 0) which is how the contract signals "not
// attested yet".
export async function getAttestationFromChain(input: {
  rpcUrl: string;
  contractAddress: Hex;
  sessionHash: Hex;
}): Promise<{
  attester: string;
  timestamp: number;
  verdictHash: string;
  verdict: string;
} | null> {
  const calldata = encodeFunctionData({
    abi: CELINA_ATTESTATION_ABI,
    functionName: 'getAttestation',
    args: [input.sessionHash],
  });
  const res = await fetch(input.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        { to: input.contractAddress, data: calldata },
        'latest',
      ],
    }),
  });
  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (json.error) throw new Error(`eth_call error: ${json.error.message}`);
  if (!json.result || json.result === '0x') return null;

  // Manual decode of (address, uint64, bytes32, string) return tuple.
  // The tuple lives inside a single ABI head block: address (32 bytes),
  // uint64 (32 bytes), bytes32 (32 bytes), string offset (32 bytes,
  // points to tail). For a fresh contract with no attestation the
  // values are all zero, which is how we detect "not attested".
  const hex = json.result.slice(2);
  const addrWord = hex.slice(0, 64);
  const tsWord = hex.slice(64, 128);
  const verdictHashWord = hex.slice(128, 192);

  const address = '0x' + addrWord.slice(24);
  const timestamp = Number(BigInt('0x' + tsWord));
  if (timestamp === 0) return null;

  const verdictHash = '0x' + verdictHashWord;
  // String tail: offset word at positions 192..256 points to [length, data].
  const stringOffset = Number(BigInt('0x' + hex.slice(192, 256)));
  const lenStart = stringOffset * 2;
  const lenWord = hex.slice(lenStart, lenStart + 64);
  const strLen = Number(BigInt('0x' + lenWord));
  const strHex = hex.slice(lenStart + 64, lenStart + 64 + strLen * 2);
  const verdict = new TextDecoder().decode(hexToBytes(strHex));

  return {
    attester: address.toLowerCase(),
    timestamp,
    verdictHash,
    verdict,
  };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Re-export viem helpers the session-runner also needs (toHex for
// debugging, stringToBytes for the canonicalized payload -> bytes
// conversion that we hash).
export { toHex, stringToBytes };
