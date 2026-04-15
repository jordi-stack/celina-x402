#!/usr/bin/env tsx
// Compile CelinaAttestation.sol via solc-js and write ABI + bytecode to
// artifacts/CelinaAttestation.json. Run via `pnpm -F @x402/contracts compile`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// solc has no first-class ESM types; import via default + cast.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import solcModule from 'solc';

const solc = solcModule as unknown as {
  compile: (input: string) => string;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const source = readFileSync(
  path.join(pkgRoot, 'src', 'CelinaAttestation.sol'),
  'utf8'
);

const input = {
  language: 'Solidity',
  sources: {
    'CelinaAttestation.sol': { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
      },
    },
  },
} as const;

const out = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: Array<{ severity: 'error' | 'warning'; formattedMessage: string }>;
  contracts?: Record<
    string,
    Record<
      string,
      {
        abi: unknown[];
        evm: {
          bytecode: { object: string };
          deployedBytecode: { object: string };
        };
      }
    >
  >;
};

const errors = (out.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length > 0) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}

const contract = out.contracts?.['CelinaAttestation.sol']?.['CelinaAttestation'];
if (!contract) {
  console.error('compile output missing CelinaAttestation');
  process.exit(1);
}

const artifact = {
  contractName: 'CelinaAttestation',
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
  compiledAt: new Date().toISOString(),
  compiler: '0.8.24',
};

const artifactsDir = path.join(pkgRoot, 'artifacts');
mkdirSync(artifactsDir, { recursive: true });
writeFileSync(
  path.join(artifactsDir, 'CelinaAttestation.json'),
  JSON.stringify(artifact, null, 2)
);

console.log('Compiled:');
console.log(`  bytecode: ${artifact.bytecode.length / 2 - 1} bytes`);
console.log(`  deployed: ${artifact.deployedBytecode.length / 2 - 1} bytes`);
console.log(
  `  artifact: ${path.relative(process.cwd(), path.join(artifactsDir, 'CelinaAttestation.json'))}`
);
