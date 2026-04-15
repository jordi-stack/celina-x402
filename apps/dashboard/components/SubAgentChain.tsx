'use client';

interface NestedCall {
  service?: string;
  priceUsdg?: string;
  txHash?: string | null;
  error?: string | null;
  durationMs?: number;
}

interface Props {
  parentService: string;
  parentPriceUsdg: string;
  parentTxHash: string | null;
  nestedCalls: NestedCall[];
}

/**
 * Visual rendering of the Consumer -> Sub-agent -> Producer x402 chain
 * produced by one research-deep-dive call. The Consumer pays the Sub-agent
 * once for the parent, then the Sub-agent pays the Producer once for each
 * nested upstream call. Every edge links to its settlement tx on OKLink.
 */
export function SubAgentChain({
  parentPriceUsdg,
  parentTxHash,
  nestedCalls,
}: Props) {
  const totalNestedUsdg = nestedCalls.reduce((sum, n) => {
    const p = Number(n.priceUsdg ?? 0);
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);

  return (
    <div className="mt-3 rounded-lg border border-fuchsia-900/50 bg-fuchsia-950/20 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wide text-fuchsia-300 font-semibold">
          Agent-to-agent x402 chain
        </div>
        <div className="text-[10px] text-neutral-400 font-mono">
          1 + {nestedCalls.length} settlements · ${(Number(parentPriceUsdg) + totalNestedUsdg).toFixed(3)} USDG total
        </div>
      </div>

      <div className="flex items-stretch gap-3 text-[11px] font-mono">
        <Node
          label="Consumer"
          tint="rose"
          subLabel="pays deep-dive"
        />
        <Edge
          label={`${parentPriceUsdg} USDG`}
          txHash={parentTxHash}
          tint="rose"
        />
        <Node
          label="Sub-agent"
          tint="fuchsia"
          subLabel="composes"
        />
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {nestedCalls.map((n, i) => (
            <div key={i} className="flex items-stretch gap-3">
              <Edge
                label={`${n.priceUsdg ?? '?'} USDG`}
                txHash={n.txHash ?? null}
                tint="fuchsia"
                compact
              />
              <div className="flex-1 rounded border border-emerald-900/50 bg-emerald-950/30 px-2 py-1.5 min-w-0">
                <div className="text-emerald-300 text-[10px] uppercase truncate">
                  Producer
                </div>
                <div className="text-neutral-300 text-[10px] truncate">
                  {n.service ?? 'unknown'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Node({
  label,
  subLabel,
  tint,
}: {
  label: string;
  subLabel: string;
  tint: 'rose' | 'fuchsia' | 'emerald';
}) {
  const border =
    tint === 'rose'
      ? 'border-rose-900/60 bg-rose-950/30'
      : tint === 'fuchsia'
        ? 'border-fuchsia-900/60 bg-fuchsia-950/30'
        : 'border-emerald-900/60 bg-emerald-950/30';
  const text =
    tint === 'rose'
      ? 'text-rose-300'
      : tint === 'fuchsia'
        ? 'text-fuchsia-300'
        : 'text-emerald-300';
  return (
    <div
      className={`rounded border ${border} px-3 py-2 flex flex-col justify-center self-center min-w-[72px]`}
    >
      <div className={`text-[10px] uppercase font-semibold ${text}`}>{label}</div>
      <div className="text-[10px] text-neutral-400 truncate">{subLabel}</div>
    </div>
  );
}

function Edge({
  label,
  txHash,
  tint,
  compact = false,
}: {
  label: string;
  txHash: string | null;
  tint: 'rose' | 'fuchsia';
  compact?: boolean;
}) {
  const color =
    tint === 'rose' ? 'text-rose-400 border-rose-900/60' : 'text-fuchsia-400 border-fuchsia-900/60';
  return (
    <div
      className={`flex flex-col items-center justify-center shrink-0 ${compact ? 'min-w-[90px]' : 'min-w-[108px]'}`}
    >
      <div className={`text-[10px] font-semibold ${color.split(' ')[0]}`}>{label}</div>
      <div className={`w-full border-t-2 border-dashed my-1 ${color.split(' ')[1]}`} />
      {txHash ? (
        <a
          href={`https://www.oklink.com/xlayer/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-[9px] text-neutral-400 hover:text-neutral-300 truncate max-w-[108px]"
          title={txHash}
        >
          {txHash.slice(0, 8)}…{txHash.slice(-6)}
        </a>
      ) : (
        <span className="text-[9px] text-neutral-500">no tx</span>
      )}
    </div>
  );
}
