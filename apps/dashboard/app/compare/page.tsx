export const dynamic = 'force-static';

interface CompareRow {
  task: string;
  manualTime: string;
  manualSteps: string;
  celinaTime: string;
  celinaCost: string;
  celinaServices: string;
}

const ROWS: CompareRow[] = [
  {
    task: 'Is this token a honeypot?',
    manualTime: '15-30 min',
    manualSteps: 'rug.check + OKLink contract read + holder scan',
    celinaTime: '8-12 sec',
    celinaCost: '$0.015',
    celinaServices: 'research-token-report',
  },
  {
    task: "Is this wallet's portfolio risky?",
    manualTime: '20-40 min',
    manualSteps: 'OKLink + Revoke.cash + token scanner + manual notes',
    celinaTime: '10-15 sec',
    celinaCost: '$0.010',
    celinaServices: 'research-wallet-risk',
  },
  {
    task: 'Can I swap $500 of this token without slippage?',
    manualTime: '10-20 min',
    manualSteps: 'DEXScreener + simulate swap + check pool depth',
    celinaTime: '8-10 sec',
    celinaCost: '$0.008',
    celinaServices: 'research-liquidity-health',
  },
  {
    task: 'Who is moving this token right now?',
    manualTime: '15-25 min',
    manualSteps: 'OKLink tx feed + holder list + manual buy/sell tally',
    celinaTime: '6-8 sec',
    celinaCost: '$0.005',
    celinaServices: 'signal-whale-watch',
  },
  {
    task: 'Full deep-dive: safe + liquid + whale-free?',
    manualTime: '45-90 min',
    manualSteps: '5-7 browser tabs, cross-referencing 4+ data sources',
    celinaTime: '20-35 sec',
    celinaCost: '$0.028-0.045',
    celinaServices: 'token-report + liquidity + whale-watch + (sub-agent)',
  },
];

export default function ComparePage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">Celina vs Manual Research</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Every research question costs a few cents of USDG and returns a structured verdict
          with an on-chain attestation. Manual research costs nothing per query but costs time.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Research task</th>
              <th className="px-4 py-3 text-left">Manual</th>
              <th className="px-4 py-3 text-left text-emerald-400">Celina</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.task} className="border-t border-neutral-800 align-top">
                <td className="px-4 py-4 font-medium">{r.task}</td>
                <td className="px-4 py-4 text-neutral-400">
                  <div className="font-medium text-neutral-300">{r.manualTime}</div>
                  <div className="mt-1 text-xs">{r.manualSteps}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-emerald-400">{r.celinaTime}</span>
                    <span className="rounded bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300">
                      {r.celinaCost} USDG
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 font-mono">{r.celinaServices}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          title="Structured verdict"
          body="Every answer includes confidence score, key facts, and contradiction detection — not a raw data dump."
        />
        <FeatureCard
          title="On-chain attestation"
          body="Each verdict is signed by the Consumer wallet and anchored to CelinaAttestation.sol on X Layer. Verifiable at /verify/:sessionHash."
        />
        <FeatureCard
          title="Agent-to-agent payments"
          body="Deep-dive research uses a sub-agent that pays the Producer via x402 for its own inputs — an agent economy on X Layer."
        />
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/20 p-5">
        <p className="text-sm font-medium text-neutral-300 mb-2">Cost breakdown (all prices in USDG)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { name: 'Token report', price: '0.015' },
            { name: 'Wallet risk', price: '0.010' },
            { name: 'Liquidity health', price: '0.008' },
            { name: 'Whale watch', price: '0.005' },
            { name: 'New token scout', price: '0.003' },
            { name: 'Deep dive (sub-agent)', price: '0.030' },
            { name: 'DEX swap exec', price: '0.020' },
            { name: 'Cache hit (50% off)', price: 'varies' },
          ].map((s) => (
            <div key={s.name} className="rounded border border-neutral-800 p-3">
              <div className="text-xs text-neutral-400">{s.name}</div>
              <div className="mt-1 font-mono font-bold">{s.price}</div>
            </div>
          ))}
        </div>
      </div>

      <a href="/" className="inline-block text-sm text-blue-400 hover:underline">
        &lt;- Back to Home
      </a>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-sm font-medium text-neutral-200">{title}</div>
      <div className="mt-2 text-xs text-neutral-400">{body}</div>
    </div>
  );
}
