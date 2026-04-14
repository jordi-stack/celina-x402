'use client';

import type { ResearchSession, ResearchCall } from '@x402/shared';
import { RESEARCH_SERVICE_CATALOG } from '@x402/shared';

interface Props {
  session: ResearchSession;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-rose-400',
};

const STATUS_COLOR: Record<string, string> = {
  planning: 'text-sky-400',
  calling: 'text-amber-400',
  synthesizing: 'text-purple-400',
  done: 'text-emerald-400',
  aborted: 'text-neutral-400',
  failed: 'text-rose-400',
};

function usdgFromMinimal(minimal: string): string {
  const n = Number(minimal);
  if (!Number.isFinite(n)) return minimal;
  return (n / 1_000_000).toFixed(6);
}

export function ReportCard({ session }: Props) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm uppercase tracking-wide text-neutral-400">
          Research Session
        </div>
        <div className="flex items-baseline gap-3 text-xs">
          <span className={STATUS_COLOR[session.status] ?? 'text-neutral-400'}>
            {session.status}
          </span>
          <span className="text-neutral-500 font-mono">
            spent {usdgFromMinimal(session.totalSpent)} USDG
          </span>
        </div>
      </div>

      <div className="mb-4 text-neutral-100 text-sm italic">
        &ldquo;{session.question}&rdquo;
      </div>

      {session.synthesis && (
        <div className="mb-4 rounded border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs uppercase text-neutral-500">Verdict</div>
            <div
              className={`text-xs font-semibold uppercase ${CONFIDENCE_COLOR[session.synthesis.confidence] ?? 'text-neutral-400'}`}
            >
              {session.synthesis.confidence} confidence
            </div>
          </div>
          <div className="text-lg font-semibold text-neutral-100 mb-2">
            {session.synthesis.verdict}
          </div>
          <div className="text-sm text-neutral-300 mb-3 whitespace-pre-wrap">
            {session.synthesis.summary}
          </div>
          {session.synthesis.keyFacts.length > 0 && (
            <ul className="text-xs text-neutral-400 space-y-1 list-disc pl-5">
              {session.synthesis.keyFacts.map((fact, i) => (
                <li key={i}>{fact}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {session.error && !session.synthesis && (
        <div className="mb-4 rounded border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-300">
          {session.error}
        </div>
      )}

      <div className="text-xs uppercase text-neutral-500 mb-2">
        Service calls ({session.calls.length})
      </div>
      <div className="space-y-2">
        {session.calls.length === 0 && (
          <div className="text-xs text-neutral-600">No calls yet.</div>
        )}
        {session.calls.map((call, i) => (
          <CallRow key={i} call={call} />
        ))}
      </div>
    </div>
  );
}

function CallRow({ call }: { call: ResearchCall }) {
  const meta = RESEARCH_SERVICE_CATALOG[call.service];
  const ok = call.error === null;
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/40 p-3 text-xs font-mono">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>
            {ok ? 'OK' : 'ERR'}
          </span>
          <span className="text-neutral-200 truncate">{call.service}</span>
        </div>
        <div className="text-neutral-500 shrink-0">{meta.priceUsdg} USDG</div>
      </div>
      <div className="mt-1 text-neutral-500 break-all">
        args: {JSON.stringify(call.args)}
      </div>
      {call.txHash && (
        <div className="mt-1 text-neutral-600 truncate">
          tx:{' '}
          <a
            className="hover:text-neutral-400 underline"
            href={`https://www.oklink.com/xlayer/tx/${call.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {call.txHash}
          </a>
        </div>
      )}
      {call.error && (
        <div className="mt-1 text-rose-400 break-all">{call.error}</div>
      )}
    </div>
  );
}
