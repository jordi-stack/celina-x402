import { describe, it, expect } from 'vitest';
import { transition, initialContext } from '../../src/state/machine';
import type { CycleState } from '@x402/shared';

describe('transition', () => {
  const base = initialContext();

  it('IDLE + LOOP_START -> DECIDING', () => {
    expect(transition('IDLE', { type: 'LOOP_START' }, base).nextState).toBe<CycleState>('DECIDING');
  });

  it('DECIDING + LLM_RESPONSE -> SIGNING', () => {
    expect(transition('DECIDING', { type: 'LLM_RESPONSE' }, base).nextState).toBe<CycleState>('SIGNING');
  });

  it('DECIDING + LLM_TIMEOUT -> FAILED', () => {
    expect(transition('DECIDING', { type: 'LLM_TIMEOUT' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('DECIDING + LLM_429 -> FAILED with shouldDowngradeModel flag', () => {
    const result = transition('DECIDING', { type: 'LLM_429' }, base);
    expect(result.nextState).toBe<CycleState>('FAILED');
    expect(result.shouldDowngradeModel).toBe(true);
  });

  it('SIGNING + PAYMENT_PROOF_READY -> REPLAYING', () => {
    expect(transition('SIGNING', { type: 'PAYMENT_PROOF_READY' }, base).nextState).toBe<CycleState>('REPLAYING');
  });

  it('SIGNING + CLI_CONFIRMING -> SIGNING with shouldRetryWithForce flag', () => {
    const result = transition('SIGNING', { type: 'CLI_CONFIRMING' }, base);
    expect(result.nextState).toBe<CycleState>('SIGNING');
    expect(result.shouldRetryWithForce).toBe(true);
  });

  it('SIGNING + CLI_ERROR -> FAILED', () => {
    expect(transition('SIGNING', { type: 'CLI_ERROR' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('REPLAYING + HTTP_200 -> VERIFYING', () => {
    expect(transition('REPLAYING', { type: 'HTTP_200' }, base).nextState).toBe<CycleState>('VERIFYING');
  });

  it('REPLAYING + HTTP_402 with cycleRetryCount<3 -> DECIDING', () => {
    const ctx = { ...base, cycleRetryCount: 1 };
    const result = transition('REPLAYING', { type: 'HTTP_402' }, ctx);
    expect(result.nextState).toBe<CycleState>('DECIDING');
    expect(result.incrementCycleRetryCount).toBe(true);
  });

  it('REPLAYING + HTTP_402 with cycleRetryCount>=3 -> FAILED', () => {
    const ctx = { ...base, cycleRetryCount: 3 };
    expect(transition('REPLAYING', { type: 'HTTP_402' }, ctx).nextState).toBe<CycleState>('FAILED');
  });

  it('REPLAYING + HTTP_500 -> FAILED', () => {
    expect(transition('REPLAYING', { type: 'HTTP_500' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('VERIFYING + VERIFY_OK -> SETTLING', () => {
    expect(transition('VERIFYING', { type: 'VERIFY_OK' }, base).nextState).toBe<CycleState>('SETTLING');
  });

  it('VERIFYING + VERIFY_INVALID -> FAILED', () => {
    expect(transition('VERIFYING', { type: 'VERIFY_INVALID' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('SETTLING + SETTLE_OK -> COMPLETED', () => {
    expect(transition('SETTLING', { type: 'SETTLE_OK' }, base).nextState).toBe<CycleState>('COMPLETED');
  });

  it('SETTLING + SETTLE_TIMEOUT -> FAILED', () => {
    expect(transition('SETTLING', { type: 'SETTLE_TIMEOUT' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('COMPLETED + CYCLE_RESET -> IDLE', () => {
    expect(transition('COMPLETED', { type: 'CYCLE_RESET' }, base).nextState).toBe<CycleState>('IDLE');
  });

  it('FAILED + RETRY with stateRetryCount<max -> previousState', () => {
    const ctx = { ...base, stateRetryCount: 0, previousState: 'DECIDING' as CycleState };
    const result = transition('FAILED', { type: 'RETRY' }, ctx);
    expect(result.nextState).toBe<CycleState>('DECIDING');
    expect(result.incrementStateRetryCount).toBe(true);
  });

  it('FAILED + RETRY with stateRetryCount>=max -> HALTED', () => {
    const ctx = { ...base, stateRetryCount: 2, previousState: 'DECIDING' as CycleState };
    expect(transition('FAILED', { type: 'RETRY' }, ctx).nextState).toBe<CycleState>('HALTED');
  });

  it('HALTED + USER_RESUME -> IDLE with resetRetryCounters flag', () => {
    const result = transition('HALTED', { type: 'USER_RESUME' }, base);
    expect(result.nextState).toBe<CycleState>('IDLE');
    expect(result.resetRetryCounters).toBe(true);
  });

  it('throws on invalid transition', () => {
    expect(() =>
      // @ts-expect-error intentional invalid event
      transition('IDLE', { type: 'BOGUS' }, base)
    ).toThrow(/no transition/i);
  });
});
