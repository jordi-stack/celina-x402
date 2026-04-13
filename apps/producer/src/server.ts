import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate } from '@x402/orchestrator';
import { config } from './config';

async function bootstrap() {
  mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  migrate(db);

  const fastify = Fastify({ logger: true });

  fastify.get('/health', async () => ({ status: 'ok' }));

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
