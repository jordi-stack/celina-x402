import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate, Store, EventBus } from '@x402/orchestrator';
import { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import { CONSUMER_API_PORT } from '@x402/shared';
import { config } from './config';
import { ReasonerClient } from './reasoner/client';
import { buildAskServer } from './api/ask-server';

async function main() {
  mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  migrate(db);

  const store = new Store(db);
  const eventBus = new EventBus(db, 'consumer');
  const walletClient = new WalletClient();
  const paymentClient = new X402PaymentClient();

  const reasoner = new ReasonerClient({
    apiKey: config.groqApiKey,
    baseUrl: config.groqBaseUrl,
    model: config.groqPrimaryModel,
  });

  const fastify = await buildAskServer({
    store,
    eventBus,
    reasoner,
    walletClient,
    paymentClient,
    runnerConfig: {
      producerUrl: config.producerUrl,
      consumerAccountId: config.consumerAccountId,
      maxCalls: config.maxCallsPerSession,
      budgetUsdg: config.sessionBudgetUsdg,
    },
  });

  const port = Number(process.env.CONSUMER_API_PORT ?? CONSUMER_API_PORT);
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Consumer /ask listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Consumer fatal error:', err);
  process.exit(1);
});
