import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate, Store, EventBus } from '@x402/orchestrator';
import { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import { config } from './config';
import { ReasonerClient } from './reasoner/client';
import { ModelThrottler } from './reasoner/throttler';
import { BudgetTracker } from './agent/budget';
import { runLoop } from './agent/loop';

async function main() {
  mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  migrate(db);

  const store = new Store(db);
  const eventBus = new EventBus(db, 'consumer');
  const walletClient = new WalletClient();

  // Note: reconcileOnBoot is Producer-side. Consumer only observes settlement
  // via SQLite payments table polling inside the loop.

  const throttler = new ModelThrottler({
    primary: config.groqPrimaryModel,
    fast: config.groqFastModel,
    upgradeBackAfterMs: 60_000,
  });

  const reasoner = new ReasonerClient({
    apiKey: config.groqApiKey,
    baseUrl: config.groqBaseUrl,
    model: throttler.currentModel(),
  });

  const budget = new BudgetTracker({ minBalanceUsdg: config.minBalanceUsdg });
  const paymentClient = new X402PaymentClient();

  // Earnings watcher: tail audit_events for Producer-side SETTLEMENT_COMPLETED.
  // Feeds the BudgetTracker so the reasoner sees earn+spend history each cycle.
  let lastEventId = 0;
  setInterval(() => {
    const events = eventBus.replay({ sinceId: lastEventId, limit: 100 });
    for (const event of events) {
      lastEventId = Math.max(lastEventId, event.id);
      if (event.source === 'producer' && event.kind === 'SETTLEMENT_COMPLETED') {
        const amount = event.payload.amount as string | undefined;
        const service = event.payload.service as string | undefined;
        if (amount && service) {
          budget.addEarning(service, amount, event.timestamp);
        }
      }
    }
  }, 1000);

  await runLoop({
    db,
    store,
    eventBus,
    reasoner,
    throttler,
    budget,
    walletClient,
    paymentClient,
  });
}

main().catch((err) => {
  console.error('Consumer loop fatal error:', err);
  process.exit(1);
});
