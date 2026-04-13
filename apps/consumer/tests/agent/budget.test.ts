import { describe, it, expect } from 'vitest';
import { BudgetTracker } from '../../src/agent/budget';

describe('BudgetTracker', () => {
  it('tracks earnings and spends separately', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5 });
    b.addEarning('market-snapshot', '10000', Date.now());
    b.addSpend('swap-quote', '15000', Date.now());

    const earnings = b.recentEarnings();
    const spends = b.recentSpends();
    expect(earnings).toHaveLength(1);
    expect(spends).toHaveLength(1);
  });

  it('canSpend returns true when balance would stay above min', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5 });
    expect(b.canSpend(1.0, '10000')).toBe(true);
  });

  it('canSpend returns false when spend would drop below min', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5 });
    expect(b.canSpend(0.51, '20000')).toBe(false);
  });

  it('keeps only last N history entries', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5, maxHistory: 3 });
    for (let i = 0; i < 5; i++) {
      b.addEarning('s', '1000', i);
    }
    expect(b.recentEarnings()).toHaveLength(3);
  });
});
