import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate, Store, EventBus, reconcileOnBoot } from '@x402/orchestrator';
import { OKXMCPClient } from '@x402/mcp-client';
import {
  TrenchesClient,
  SecurityClient,
  WalletClient,
  createWalletHistoryFetcher,
} from '@x402/onchain-clients';
import { config } from './config';
import { FacilitatorClient } from './facilitator/client';
import x402GatePlugin from './plugins/x402-gate';
import { researchTokenReportRoute } from './routes/research-token-report';
import { researchWalletRiskRoute } from './routes/research-wallet-risk';
import { researchLiquidityHealthRoute } from './routes/research-liquidity-health';
import { signalWhaleWatchRoute } from './routes/signal-whale-watch';
import { signalNewTokenScoutRoute } from './routes/signal-new-token-scout';

async function bootstrap() {
  mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  migrate(db);

  const store = new Store(db);
  const eventBus = new EventBus(db, 'producer');
  const walletClient = new WalletClient();

  // Producer-side recovery: reconcile any non-terminal payments against wallet history
  // before accepting new requests. Spec Section 4.2.
  const pendingPayments = store.findNonTerminalPayments();
  if (pendingPayments.length > 0) {
    console.log(`Reconciling ${pendingPayments.length} non-terminal payments...`);
    await walletClient.switchAccount(config.producerAccountId);
    const fetchWalletHistory = createWalletHistoryFetcher({
      accountId: config.producerAccountId,
      chain: 'xlayer',
      nonceResolver: (entry) => {
        const candidate = pendingPayments.find(
          (p) => p.from_addr.toLowerCase() === entry.from.toLowerCase()
        );
        return candidate ? candidate.nonce : '';
      },
      walletClient,
    });
    const recovery = await reconcileOnBoot({
      store,
      fetchWalletHistory,
      nowMs: Date.now(),
    });
    console.log('Recovery:', {
      reconciled: recovery.reconciled.length,
      abandoned: recovery.abandoned.length,
      stillPending: recovery.stillPending.length,
    });
  }

  const mcpClient = new OKXMCPClient({
    url: config.mcpEndpoint,
    apiKey: config.okxApiKey,
  });
  const trenchesClient = new TrenchesClient();
  const securityClient = new SecurityClient();
  const facilitator = new FacilitatorClient({
    baseUrl: config.facilitatorBase,
    apiKey: config.okxApiKey,
    secretKey: config.okxSecretKey,
    passphrase: config.okxPassphrase,
  });

  const fastify = Fastify({ logger: { level: 'info' } });

  fastify.get('/health', async () => ({ status: 'ok', time: Date.now() }));

  await fastify.register(x402GatePlugin, {
    facilitator,
    store,
    eventBus,
    producerAddress: config.producerAddress,
  });

  await fastify.register(researchTokenReportRoute, {
    mcpClient,
    securityClient,
    trenchesClient,
    store,
  });
  await fastify.register(researchWalletRiskRoute, {
    mcpClient,
    securityClient,
    store,
  });
  await fastify.register(researchLiquidityHealthRoute, { mcpClient, store });
  await fastify.register(signalWhaleWatchRoute, { mcpClient, store });
  await fastify.register(signalNewTokenScoutRoute, {
    mcpClient,
    securityClient,
    trenchesClient,
    store,
  });

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Producer listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
