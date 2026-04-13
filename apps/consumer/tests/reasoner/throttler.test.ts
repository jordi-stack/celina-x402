import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelThrottler } from '../../src/reasoner/throttler';

describe('ModelThrottler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in primary tier', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    expect(t.currentModel()).toBe('llama-3.3-70b-versatile');
  });

  it('downgrades to fast tier on rate limit', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    t.reportRateLimit();
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
  });

  it('upgrades back to primary after upgradeBackAfterMs clean window', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    t.reportRateLimit();
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
    t.reportSuccess();
    vi.advanceTimersByTime(30_000);
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
    vi.advanceTimersByTime(30_001);
    expect(t.currentModel()).toBe('llama-3.3-70b-versatile');
  });

  it('resets upgrade timer on new rate limit hit', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    t.reportRateLimit();
    t.reportSuccess();
    vi.advanceTimersByTime(50_000);
    t.reportRateLimit();
    vi.advanceTimersByTime(30_000);
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
  });
});
