import { getStore } from '@/lib/db';
import type { MemoryRow } from '@x402/orchestrator';

export const dynamic = 'force-dynamic';

function getMemories(): MemoryRow[] {
  return getStore().listActiveMemories();
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function expiresIn(ts: number): string {
  const mins = Math.round((ts - Date.now()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

export default function MemoryPage() {
  const memories = getMemories();

  const withEmbeddings = memories.filter((m) => m.embedding !== null).length;
  const fallbackCount = memories.length - withEmbeddings;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Agent Memory</h2>
        <span className="text-xs text-neutral-500">24h TTL — active memories only</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Active memories" value={memories.length} />
        <StatCard
          label="With embeddings"
          value={`${withEmbeddings} / ${memories.length}`}
        />
        <StatCard label="Fallback (address)" value={fallbackCount} />
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/20 p-4 text-sm text-neutral-400 space-y-1">
        <p className="font-medium text-neutral-300">How dedup works</p>
        <p>
          After each completed session, Celina embeds the question with{' '}
          <code className="text-xs bg-neutral-800 px-1 rounded">all-MiniLM-L6-v2</code> (384-dim
          unit vector). The next time a question arrives, Celina computes cosine similarity
          against all active memories. Similarity &ge; 0.85 triggers a cache hit and skips all
          paid x402 calls. If the model is unavailable, Celina falls back to address-based
          matching (shared 0x address = 0.9 similarity).
        </p>
      </div>

      {memories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
          No active memories. Complete a research session to populate.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Question</th>
                <th className="px-4 py-3 text-left">Verdict</th>
                <th className="px-4 py-3 text-right">Conf.</th>
                <th className="px-4 py-3 text-left">Embed</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Expires</th>
              </tr>
            </thead>
            <tbody>
              {memories.map((m) => (
                <tr key={m.id} className="border-t border-neutral-800">
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-xs text-neutral-300 truncate" title={m.question}>
                      {m.question.slice(0, 80)}{m.question.length > 80 ? '...' : ''}
                    </div>
                    {m.extractedAddresses.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.extractedAddresses.map((addr) => (
                          <span key={addr} className="text-[10px] font-mono bg-neutral-800 px-1 rounded text-neutral-500">
                            {addr.slice(0, 8)}…
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-xs text-neutral-300 truncate" title={m.verdict}>
                      {m.verdict.slice(0, 60)}{m.verdict.length > 60 ? '...' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {Math.round(m.confidenceScore * 100)}%
                  </td>
                  <td className="px-4 py-3">
                    {m.embedding ? (
                      <span className="rounded bg-emerald-900 px-2 py-0.5 text-[10px] text-emerald-300">
                        384-dim
                      </span>
                    ) : (
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500">
                        fallback
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{timeAgo(m.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{expiresIn(m.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <a href="/" className="inline-block text-sm text-blue-400 hover:underline">
        &lt;- Back to Home
      </a>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs uppercase text-neutral-400">{label}</div>
      <div className="mt-2 text-2xl font-bold font-mono">{value}</div>
    </div>
  );
}
