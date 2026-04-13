export interface HistoryEntry {
  service: string;
  amount: string;
  timestamp: number;
}

export interface BudgetTrackerOptions {
  minBalanceUsdg: number;
  maxHistory?: number;
}

/**
 * Tracks agent earnings, spends, and enforces minimum balance policy.
 * Amounts are in minimal units assuming USDG (6 decimals).
 */
export class BudgetTracker {
  private readonly earnings: HistoryEntry[] = [];
  private readonly spends: HistoryEntry[] = [];
  private readonly maxHistory: number;

  constructor(private readonly opts: BudgetTrackerOptions) {
    this.maxHistory = opts.maxHistory ?? 50;
  }

  addEarning(service: string, amount: string, timestamp: number): void {
    this.earnings.push({ service, amount, timestamp });
    if (this.earnings.length > this.maxHistory) this.earnings.shift();
  }

  addSpend(service: string, amount: string, timestamp: number): void {
    this.spends.push({ service, amount, timestamp });
    if (this.spends.length > this.maxHistory) this.spends.shift();
  }

  recentEarnings(): HistoryEntry[] {
    return [...this.earnings];
  }

  recentSpends(): HistoryEntry[] {
    return [...this.spends];
  }

  canSpend(currentBalanceUsdg: number, amountMinimal: string): boolean {
    const amountUsdg = Number(amountMinimal) / 1_000_000;
    return currentBalanceUsdg - amountUsdg >= this.opts.minBalanceUsdg;
  }
}
