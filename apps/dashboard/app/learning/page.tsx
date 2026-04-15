import { getStore } from '@/lib/db';
import type { ServiceStat } from '@x402/orchestrator';

export const dynamic = 'force-dynamic';

function getStats(): ServiceStat[] {
  return getStore().getServiceStats();
}

function usefulnessBar(avg: number): string {
  const filled = Math.round(avg * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function trendLabel(avg: number): { label: string; cls: string } {
  if (avg >= 0.7) return { label: 'high utility', cls: 'bg-emerald-900 text-emerald-300' };
  if (avg >= 0.4) return { label: 'mixed', cls: 'bg-yellow-900 text-yellow-300' };
  return { label: 'low utility', cls: 'bg-rose-900 text-rose-300' };
}

export default function LearningPage() {
  const stats = getStats();

  const totalCalls = stats.reduce((s, r) => s + r.callCount, 0);
  const totalUseful = stats.reduce((s, r) => s + r.usefulCount, 0);
  const overallRate = totalCalls > 0 ? Math.round((totalUseful / totalCalls) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Service Learning</h2>
        <span className="text-xs text-neutral-400">
          Celina grades every paid call 0-1 for usefulness after synthesis. These scores
          bias future planning.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total graded calls" value={totalCalls} />
        <StatCard label="Useful calls" value={`${totalUseful} / ${totalCalls}`} />
        <StatCard label="Overall utility rate" value={`${overallRate}%`} />
      </div>

      {stats.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-700 p-10 text-center text-sm text-neutral-400">
          No graded sessions yet. Run a research session first.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-800 text-neutral-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Service</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">Useful</th>
                <th className="px-4 py-3 text-right">Wasted</th>
                <th className="px-4 py-3 text-left">Avg usefulness</th>
                <th className="px-4 py-3 text-left">Trend</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const trend = trendLabel(s.avgUsefulness);
                return (
                  <tr key={s.service} className="border-t border-neutral-700">
                    <td className="px-4 py-3 font-mono text-xs">{s.service}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{s.callCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400">
                      {s.usefulCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-rose-400">
                      {s.wastedCount}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className="text-neutral-400">{usefulnessBar(s.avgUsefulness)}</span>
                      <span className="ml-2">{Math.round(s.avgUsefulness * 100)}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${trend.cls}`}>
                        {trend.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-neutral-700 bg-neutral-800/20 p-4 text-sm text-neutral-400 space-y-1">
        <p className="font-medium text-neutral-300">How Celina learns</p>
        <p>
          After every synthesis, the LLM retrospectively grades each paid call (0 = wasted USDG,
          1 = directly answered the question). The grades are aggregated here and injected into the
          planning prompt as <code className="text-xs bg-neutral-800 px-1 rounded">servicePerformanceHistory</code>.
          Services above 70% avg usefulness get a "consistently useful" tag in the planner context;
          services below 40% get "often wastes USDG".
        </p>
      </div>

      <a href="/" className="inline-block text-sm text-blue-400 hover:underline">
        &lt;- Back to Home
      </a>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
      <div className="text-xs uppercase text-neutral-400">{label}</div>
      <div className="mt-2 text-2xl font-bold font-mono">{value}</div>
    </div>
  );
}
