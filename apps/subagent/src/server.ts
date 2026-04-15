import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate, Store, EventBus } from '@x402/orchestrator';
import { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import { FacilitatorClient, x402GatePlugin } from '@x402/x402-server';
import { config } from './config';
import { ProducerX402Client } from './client/producer-x402-client';
import { researchDeepDiveRoute } from './routes/research-deep-dive';

async function bootstrap() {
  mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  migrate(db);

  const store = new Store(db);
  const eventBus = new EventBus(db, 'subagent');

  // Shared CLI wallet + payment clients. Both are used in the upstream
  // producer-x402-client, which does its own wallet switchAccount before
  // every sign (the switch must be inside the call, not at boot, because
  // Consumer/Subagent share global CLI state).
  const walletClient = new WalletClient();
  const paymentClient = new X402PaymentClient();

  const facilitator = new FacilitatorClient({
    baseUrl: config.facilitatorBase,
    apiKey: config.okxApiKey,
    secretKey: config.okxSecretKey,
    passphrase: config.okxPassphrase,
  });

  const producerClient = new ProducerX402Client({
    walletClient,
    paymentClient,
    store,
    producerUrl: config.producerUrl,
    subagentAccountId: config.subagentAccountId,
  });

  const fastify = Fastify({ logger: { level: 'info' } });

  fastify.get('/health', async () => ({ status: 'ok', role: 'subagent', time: Date.now() }));

  // Install the shared x402 gate plugin from @x402/x402-server. The
  // producerAddress here is actually the SUB-AGENT's own USDG address
  // because in this relationship the Sub-agent is the seller and the
  // Consumer is the payer. Same plugin, different payTo.
  await fastify.register(x402GatePlugin, {
    facilitator,
    store,
    eventBus,
    producerAddress: config.subagentAddress,
  });

  await fastify.register(researchDeepDiveRoute, { producerClient });

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Sub-agent listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
