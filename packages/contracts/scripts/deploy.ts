#!/usr/bin/env tsx
// Deploy CelinaAttestation.sol to X Layer chain 196 via the Arachnid
// CREATE2 factory at 0x4e59b44847b379578588920cA78FbF26c0B4956C. The
// factory is keyless and deployed on chain 196 (verified via
// eth_getCode). We use it because the onchainos CLI only exposes
// wallet contract-call (not contract create), and because CREATE2
// gives us a deterministic address we can hard-code into the shared
// constants without a discovery step.
//
// Run via:
//   pnpm -F @x402/contracts deploy
//
// The Consumer wallet (Account 1) is the sender, so msg.sender in
// CelinaAttestation.attest() will be the Consumer's address. The
// factory is the sender of the CREATE2 tx, not the deployed contract,
// so that's irrelevant to attestation auth.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { getContractAddress, keccak256, stringToBytes, type Hex } from 'viem';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const repoRoot = path.resolve(pkgRoot, '..', '..');

loadEnv({ path: path.join(repoRoot, '.env') });

const CONSUMER_ACCOUNT_ID = process.env.CONSUMER_ACCOUNT_ID;
if (!CONSUMER_ACCOUNT_ID) {
  console.error('CONSUMER_ACCOUNT_ID missing from .env');
  process.exit(1);
}

const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C' as const;
const SALT_SOURCE = 'celina-attestation-v1';
const SALT = keccak256(stringToBytes(SALT_SOURCE));

const artifactPath = path.join(pkgRoot, 'artifacts', 'CelinaAttestation.json');
if (!existsSync(artifactPath)) {
  console.error(`Artifact missing. Run: pnpm -F @x402/contracts compile`);
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as {
  contractName: string;
  abi: unknown[];
  bytecode: string;
};

const bytecode = artifact.bytecode as Hex;
const initCodeHash = keccak256(bytecode);

// Compute CREATE2 address deterministically so we know where the
// contract WILL be, even before the deploy tx is mined.
const predictedAddress = getContractAddress({
  from: FACTORY,
  salt: SALT,
  bytecodeHash: initCodeHash,
  opcode: 'CREATE2',
});

console.log('CelinaAttestation deploy plan');
console.log(`  factory:   ${FACTORY}`);
console.log(`  salt src:  "${SALT_SOURCE}"`);
console.log(`  salt:      ${SALT}`);
console.log(`  init hash: ${initCodeHash}`);
console.log(`  predicted: ${predictedAddress}`);
console.log(`  bytecode:  ${(bytecode.length - 2) / 2} bytes`);

// Check if already deployed at the predicted address. If so, skip.
async function isDeployed(addr: string): Promise<boolean> {
  try {
    const res = await fetch('https://rpc.xlayer.tech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [addr, 'latest'],
      }),
    });
    const json = (await res.json()) as { result?: string };
    return typeof json.result === 'string' && json.result !== '0x' && json.result.length > 2;
  } catch {
    return false;
  }
}

async function main() {
  const alreadyDeployed = await isDeployed(predictedAddress);
  if (alreadyDeployed) {
    console.log(`\nAlready deployed at ${predictedAddress}. Skipping.`);
    writeDeploymentArtifact({
      address: predictedAddress,
      txHash: null,
      deployer: 'unknown (already deployed)',
      salt: SALT,
      chainId: 196,
      contractName: artifact.contractName,
      deployedAt: new Date().toISOString(),
    });
    return;
  }

  // Switch to Consumer wallet so the CREATE2 call comes from Account 1.
  console.log('\nSwitching wallet to Consumer (Account 1)...');
  const switchRes = spawnSync(
    'onchainos',
    ['wallet', 'switch', CONSUMER_ACCOUNT_ID!],
    { stdio: 'pipe', encoding: 'utf8' }
  );
  if (switchRes.status !== 0) {
    console.error('wallet switch failed:', switchRes.stderr || switchRes.stdout);
    process.exit(1);
  }

  // Arachnid factory takes RAW calldata: first 32 bytes = salt, rest =
  // initCode (creation bytecode). No ABI encoding. That's why it's so
  // small (~70 bytes of deployer code).
  const calldata = ('0x' + SALT.slice(2) + bytecode.slice(2)) as Hex;
  console.log(`  calldata bytes: ${(calldata.length - 2) / 2}`);

  console.log('\nCalling CREATE2 factory via onchainos wallet contract-call...');
  const callRes = spawnSync(
    'onchainos',
    [
      'wallet',
      'contract-call',
      '--chain',
      'xlayer',
      '--to',
      FACTORY,
      '--input-data',
      calldata,
      '--force',
    ],
    { stdio: 'pipe', encoding: 'utf8' }
  );

  if (callRes.status !== 0) {
    console.error('contract-call failed:', callRes.stderr || callRes.stdout);
    process.exit(1);
  }

  const envelope = JSON.parse(callRes.stdout) as {
    ok: boolean;
    data?: { txHash?: string };
    error?: string;
  };
  if (!envelope.ok || !envelope.data?.txHash) {
    console.error('contract-call returned error:', envelope.error ?? callRes.stdout);
    process.exit(1);
  }

  const txHash = envelope.data.txHash;
  console.log(`\nDeploy tx: ${txHash}`);
  console.log(`Explorer: https://www.oklink.com/xlayer/tx/${txHash}`);

  // Wait for the receipt so we can confirm the contract is live before
  // writing the artifact.
  console.log('\nWaiting for contract bytecode to appear...');
  const start = Date.now();
  let deployed = false;
  while (Date.now() - start < 60_000) {
    if (await isDeployed(predictedAddress)) {
      deployed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  if (!deployed) {
    console.error(
      `Contract still not visible at ${predictedAddress} after 60s. ` +
        'Check tx hash on OKLink manually.'
    );
    process.exit(1);
  }

  console.log(`\nContract live at ${predictedAddress}`);

  writeDeploymentArtifact({
    address: predictedAddress,
    txHash,
    deployer: CONSUMER_ACCOUNT_ID!,
    salt: SALT,
    chainId: 196,
    contractName: artifact.contractName,
    deployedAt: new Date().toISOString(),
  });
}

function writeDeploymentArtifact(data: {
  address: string;
  txHash: string | null;
  deployer: string;
  salt: string;
  chainId: number;
  contractName: string;
  deployedAt: string;
}) {
  const outPath = path.join(pkgRoot, 'artifacts', 'deployment.json');
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
