#!/usr/bin/env tsx
/**
 * Orchestrates the full demo scenario:
 * 1. Runs health check (exits if fails)
 * 2. Instructs user to start Producer, Consumer, Dashboard in separate terminals
 *
 * This script does NOT spawn Producer/Consumer/Dashboard itself. Those are
 * long-running processes that the user should run in separate terminals for
 * clean log visibility during demo recording.
 */
import { execa } from 'execa';

const BORDER = '='.repeat(60);

async function main() {
  console.log(`\n${BORDER}`);
  console.log('   x402 Earn-Pay-Earn Demo Runner');
  console.log(`${BORDER}\n`);

  console.log('Step 1: Running pre-flight health check...\n');
  try {
    await execa('pnpm', ['health-check'], { stdio: 'inherit' });
  } catch {
    console.error('\nHealth check failed. Fix blockers and retry.\n');
    process.exit(1);
  }

  console.log(`\n${BORDER}`);
  console.log('   Ready to run. Open 3 terminals and run:');
  console.log(`${BORDER}`);
  console.log();
  console.log('  Terminal 1 (Producer):');
  console.log('    pnpm dev:producer');
  console.log();
  console.log('  Terminal 2 (Consumer):');
  console.log('    pnpm --filter consumer start');
  console.log();
  console.log('  Terminal 3 (Dashboard):');
  console.log('    pnpm dev:dashboard');
  console.log();
  console.log('  Then open: http://localhost:3000');
  console.log();
  console.log(`${BORDER}`);
  console.log('   Aria is about to wake up. Watch her earn and pay.');
  console.log(`${BORDER}\n`);
}

main().catch((err) => {
  console.error('Demo runner error:', err);
  process.exit(1);
});
