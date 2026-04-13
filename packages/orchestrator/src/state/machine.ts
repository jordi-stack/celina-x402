import type { CycleState } from '@x402/shared';
import { CYCLE_RETRY_MAX, STATE_RETRY_MAX } from '@x402/shared';

export interface StateContext {
  cycleRetryCount: number;
  stateRetryCount: number;
  previousState: CycleState;
}

export function initialContext(): StateContext {
  return { cycleRetryCount: 0, stateRetryCount: 0, previousState: 'IDLE' };
}

export type StateEvent =
  | { type: 'LOOP_START' }
  | { type: 'LLM_RESPONSE' }
  | { type: 'LLM_TIMEOUT' }
  | { type: 'LLM_429' }
  | { type: 'PAYMENT_PROOF_READY' }
  | { type: 'CLI_CONFIRMING' }
  | { type: 'CLI_ERROR' }
  | { type: 'HTTP_200' }
  | { type: 'HTTP_402' }
  | { type: 'HTTP_500' }
  | { type: 'VERIFY_OK' }
  | { type: 'VERIFY_INVALID' }
  | { type: 'SETTLE_OK' }
  | { type: 'SETTLE_TIMEOUT' }
  | { type: 'CYCLE_RESET' }
  | { type: 'RETRY' }
  | { type: 'USER_RESUME' };

export interface TransitionResult {
  nextState: CycleState;
  shouldRetryWithForce?: boolean;
  shouldDowngradeModel?: boolean;
  incrementCycleRetryCount?: boolean;
  incrementStateRetryCount?: boolean;
  resetRetryCounters?: boolean;
}

/**
 * Pure-function state machine transition.
 * See spec Section 3.1 for authoritative transition table.
 */
export function transition(
  state: CycleState,
  event: StateEvent,
  ctx: StateContext
): TransitionResult {
  switch (state) {
    case 'IDLE':
      if (event.type === 'LOOP_START') return { nextState: 'DECIDING' };
      break;
    case 'DECIDING':
      if (event.type === 'LLM_RESPONSE') return { nextState: 'SIGNING' };
      if (event.type === 'LLM_TIMEOUT') return { nextState: 'FAILED' };
      if (event.type === 'LLM_429') return { nextState: 'FAILED', shouldDowngradeModel: true };
      break;
    case 'SIGNING':
      if (event.type === 'PAYMENT_PROOF_READY') return { nextState: 'REPLAYING' };
      if (event.type === 'CLI_CONFIRMING')
        return { nextState: 'SIGNING', shouldRetryWithForce: true };
      if (event.type === 'CLI_ERROR') return { nextState: 'FAILED' };
      break;
    case 'REPLAYING':
      if (event.type === 'HTTP_200') return { nextState: 'VERIFYING' };
      if (event.type === 'HTTP_402') {
        if (ctx.cycleRetryCount < CYCLE_RETRY_MAX) {
          return { nextState: 'DECIDING', incrementCycleRetryCount: true };
        }
        return { nextState: 'FAILED' };
      }
      if (event.type === 'HTTP_500') return { nextState: 'FAILED' };
      break;
    case 'VERIFYING':
      if (event.type === 'VERIFY_OK') return { nextState: 'SETTLING' };
      if (event.type === 'VERIFY_INVALID') return { nextState: 'FAILED' };
      break;
    case 'SETTLING':
      if (event.type === 'SETTLE_OK') return { nextState: 'COMPLETED' };
      if (event.type === 'SETTLE_TIMEOUT') return { nextState: 'FAILED' };
      break;
    case 'COMPLETED':
      if (event.type === 'CYCLE_RESET') return { nextState: 'IDLE' };
      break;
    case 'FAILED':
      if (event.type === 'RETRY') {
        if (ctx.stateRetryCount < STATE_RETRY_MAX) {
          return { nextState: ctx.previousState, incrementStateRetryCount: true };
        }
        return { nextState: 'HALTED' };
      }
      break;
    case 'HALTED':
      if (event.type === 'USER_RESUME') return { nextState: 'IDLE', resetRetryCounters: true };
      break;
  }
  throw new Error(`No transition defined for state=${state} event=${event.type}`);
}
