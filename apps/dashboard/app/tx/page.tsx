import { X_LAYER_EXPLORER } from '@x402/shared';
import { getDb } from '@/lib/db';

interface PaymentRow {
  id: number;
  cycle_number: number;
  scheme: string;
  nonce: string;
  from_addr: string;
  to_addr: string;
  amount_minimal: string;
  service: string;
  signed_at: number;
  settled_at: number | null;
  tx_hash: string | null;
  status: string;
}

export const dynamic = 'force-dynamic';

function getPayments(): PaymentRow[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM payments ORDER BY signed_at DESC LIMIT 200`)
    .all() as PaymentRow[];
}

export default function TxPage() {
  const payments = getPayments();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Transaction Log</h2>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Cycle</th>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tx Hash</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No payments recorded yet.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-neutral-800">
                <td className="px-4 py-3">#{p.cycle_number}</td>
                <td className="px-4 py-3">{p.service}</td>
                <td className="px-4 py-3 font-mono">
                  {(Number(p.amount_minimal) / 1_000_000).toFixed(4)} USDG
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {p.tx_hash ? (
                    <a
                      href={`${X_LAYER_EXPLORER}/tx/${p.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {p.tx_hash.slice(0, 10)}...{p.tx_hash.slice(-8)}
                    </a>
                  ) : (
                    <span className="text-neutral-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a href="/" className="inline-block text-sm text-blue-400 hover:underline">
        &lt;- Back to Home
      </a>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    settled: 'bg-emerald-900 text-emerald-300',
    verified: 'bg-cyan-900 text-cyan-300',
    signed: 'bg-blue-900 text-blue-300',
    settle_failed: 'bg-rose-900 text-rose-300',
    settle_abandoned: 'bg-neutral-800 text-neutral-500',
  };
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${colors[status] ?? 'bg-neutral-800'}`}>
      {status}
    </span>
  );
}
