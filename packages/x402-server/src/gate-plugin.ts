import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { Store, EventBus } from '@x402/orchestrator';
import type { PaymentPayload } from '@x402/shared';
import { USDG_CONTRACT } from '@x402/shared';
import { FacilitatorClient } from './facilitator-client';
import { encode402Payload, decodePaymentPayload } from './payload-codec';

export interface X402RouteOptions {
  amount: string;
  service: string;
  /**
   * Optional dynamic price resolver. When provided, the gate calls this
   * before emitting the 402 challenge and uses the returned amount instead
   * of the static `amount` field. Return undefined to fall back to `amount`.
   *
   * Used by tiered pricing: Producer routes check the MCP result cache and
   * return 50% price on a cache hit. The client sees the reduced price in
   * the PAYMENT-REQUIRED header and pays that amount. Settlement happens for
   * whatever amount was in the signed payload, so the gate never needs to
   * validate against the static `amount` — only the facilitator verify/settle
   * step matters, and it uses decoded.accepted (what the client signed).
   */
  priceFn?: (request: import('fastify').FastifyRequest) => Promise<string | undefined>;
}

export interface X402GateOptions {
  facilitator: FacilitatorClient;
  store: Store;
  eventBus: EventBus;
  producerAddress: string;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    x402?: X402RouteOptions;
  }
  interface FastifyRequest {
    paymentProof?: PaymentPayload;
    payer?: string;
    x402Opts?: X402RouteOptions;
  }
}

// Shared Fastify plugin that gates routes whose config includes an `x402`
// block. Used by both the Producer (selling research to Consumer) and the
// Sub-agent (selling composed research to Consumer while itself buying raw
// research from Producer). Both cases share the exact same preHandler +
// onResponse contract so the plugin lives here and both apps mount it.
const x402GatePlugin: FastifyPluginAsync<X402GateOptions> = async (fastify, opts) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const routeOpts = request.routeOptions.config?.x402;
    if (!routeOpts) return;

    const paymentHeader = request.headers['payment-signature'] as string | undefined;

    if (!paymentHeader) {
      // Resolve effective price: priceFn overrides static amount when provided.
      // This enables tiered pricing (cache hit = 50% off) without changing the
      // rest of the x402 flow — the client just sees a different amount in the
      // PAYMENT-REQUIRED challenge and signs for that amount.
      const effectiveAmount = routeOpts.priceFn
        ? ((await routeOpts.priceFn(request)) ?? routeOpts.amount)
        : routeOpts.amount;

      const challenge = encode402Payload({
        x402Version: 2,
        resource: {
          url: request.url,
          description: routeOpts.service,
          mimeType: 'application/json',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:196',
            amount: effectiveAmount,
            asset: USDG_CONTRACT,
            payTo: opts.producerAddress,
            maxTimeoutSeconds: 60,
            extra: { name: 'USDG', version: '2' },
          },
        ],
      });
      reply.code(402).header('PAYMENT-REQUIRED', challenge).send({});
      return reply;
    }

    let decoded: PaymentPayload;
    try {
      decoded = decodePaymentPayload(paymentHeader);
    } catch (err) {
      request.log.warn({ err }, 'x402-gate: payment-signature decode failed');
      reply.code(402).send({ error: 'Invalid PAYMENT-SIGNATURE header' });
      return reply;
    }

    const verifyResult = await opts.facilitator.verify({
      x402Version: 2,
      paymentPayload: decoded,
      paymentRequirements: decoded.accepted,
    });

    if (!verifyResult.isValid) {
      request.log.warn({ reason: verifyResult.invalidMessage }, 'x402-gate: facilitator rejected payment');
      reply.code(402).send({ error: verifyResult.invalidMessage });
      return reply;
    }

    request.paymentProof = decoded;
    request.payer = verifyResult.payer;
    request.x402Opts = routeOpts;

    // Record pending payment row. cycle_number tracks the Consumer's active cycle
    // at the time of signing. Producer and Consumer share the same SQLite database,
    // so getCurrentCycle() returns the Consumer's latest cycle.
    const currentCycle = opts.store.getCurrentCycle();
    opts.store.insertPendingPayment({
      cycleNumber: currentCycle?.cycle_number ?? 0,
      scheme: decoded.accepted.scheme,
      nonce: decoded.payload.authorization.nonce,
      fromAddr: decoded.payload.authorization.from,
      toAddr: decoded.payload.authorization.to,
      amountMinimal: decoded.payload.authorization.value,
      asset: decoded.accepted.asset,
      service: routeOpts.service,
      signedAt: Date.now(),
    });
    opts.store.updateVerification(decoded.payload.authorization.nonce, Date.now());
    opts.eventBus.emit('PAYMENT_VERIFIED', {
      payer: verifyResult.payer,
      amount: decoded.accepted.amount,
      service: routeOpts.service,
      nonce: decoded.payload.authorization.nonce,
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.paymentProof || !request.x402Opts || reply.statusCode !== 200) return;

    try {
      const settleResult = await opts.facilitator.settle({
        x402Version: 2,
        paymentPayload: request.paymentProof,
        paymentRequirements: request.paymentProof.accepted,
        syncSettle: true,
      });
      opts.store.updateSettlement(request.paymentProof.payload.authorization.nonce, {
        txHash: settleResult.transaction,
        settledAt: Date.now(),
        status: 'settled',
      });
      opts.eventBus.emit('SETTLEMENT_COMPLETED', {
        txHash: settleResult.transaction,
        amount: request.paymentProof.accepted.amount,
        service: request.x402Opts.service,
        nonce: request.paymentProof.payload.authorization.nonce,
      });
    } catch (err) {
      opts.store.updateSettlement(request.paymentProof.payload.authorization.nonce, {
        txHash: null,
        settledAt: Date.now(),
        status: 'settle_failed',
      });
      opts.eventBus.emit('SETTLEMENT_FAILED', {
        nonce: request.paymentProof.payload.authorization.nonce,
        error: (err as Error).message,
      });
    }
  });
};

export default fp(x402GatePlugin, { name: 'x402-gate' });
