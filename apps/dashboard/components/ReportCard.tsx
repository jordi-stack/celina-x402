'use client';

import type React from 'react';
import type { ResearchSession, ResearchCall, SessionAttestation } from '@x402/shared';
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
              <span className="ml-2 text-neutral-500 font-mono normal-case">
                ({session.synthesis.confidenceScore.toFixed(2)})
              </span>
            </div>
          </div>
          <div className="text-lg font-semibold text-neutral-100 mb-2">
            {session.synthesis.verdict}
          </div>
          <div className="text-sm text-neutral-300 mb-3 whitespace-pre-wrap">
            {session.synthesis.summary}
          </div>
          {session.synthesis.keyFacts.length > 0 && (
            <ul className="text-xs text-neutral-400 space-y-1 list-disc pl-5 mb-3">
              {session.synthesis.keyFacts.map((fact, i) => (
                <li key={i}>{fact}</li>
              ))}
            </ul>
          )}
          {session.synthesis.contradictions.length > 0 && (
            <div className="mt-3 rounded border border-amber-900/60 bg-amber-950/20 p-3">
              <div className="text-xs uppercase text-amber-400 mb-1">
                Contradictions detected
              </div>
              <ul className="text-xs text-amber-200 space-y-1 list-disc pl-5">
                {session.synthesis.contradictions.map((c, i) => (
                  <li key={i}>
                    <span className="font-mono">{c.between.join(' vs ')}</span>
                    {': '}
                    {c.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {session.attestation && <AttestationBlock attestation={session.attestation} />}

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
  const gradeColor =
    call.grade === null
      ? 'text-neutral-500'
      : call.grade.usefulness >= 0.7
        ? 'text-emerald-400'
        : call.grade.usefulness >= 0.4
          ? 'text-amber-400'
          : 'text-rose-400';
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/40 p-3 text-xs font-mono">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>
            {ok ? 'OK' : 'ERR'}
          </span>
          <span className="text-neutral-200 truncate">{call.service}</span>
        </div>
        <div className="flex items-baseline gap-3 shrink-0">
          {call.grade && (
            <span className={gradeColor}>
              grade {call.grade.usefulness.toFixed(2)}
            </span>
          )}
          <span className="text-neutral-500">{meta.priceUsdg} USDG</span>
        </div>
      </div>
      {call.planReason && (
        <div className="mt-2 pl-2 border-l-2 border-neutral-800 text-neutral-400 not-italic normal-case font-sans text-xs">
          <span className="text-neutral-600 uppercase text-[10px] tracking-wide mr-1">
            plan (conf {call.planConfidence.toFixed(2)})
          </span>
          {call.planReason}
        </div>
      )}
      {call.planExpectedValue && (
        <div className="mt-1 pl-2 border-l-2 border-neutral-800 text-neutral-500 not-italic normal-case font-sans text-xs">
          <span className="text-neutral-600 uppercase text-[10px] tracking-wide mr-1">
            expected
          </span>
          {call.planExpectedValue}
        </div>
      )}
      {call.grade && (
        <div className="mt-1 pl-2 border-l-2 border-neutral-800 text-neutral-400 not-italic normal-case font-sans text-xs">
          <span className={`uppercase text-[10px] tracking-wide mr-1 ${gradeColor}`}>
            grade
          </span>
          {call.grade.note}
        </div>
      )}
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
      {renderNestedCalls(call.data)}
      {call.error && (
        <div className="mt-1 text-rose-400 break-all">{call.error}</div>
      )}
    </div>
  );
}

function AttestationBlock({ attestation }: { attestation: SessionAttestation }) {
  const shortSig = `${attestation.signature.slice(0, 14)}…${attestation.signature.slice(-6)}`;
  const explorerBase = 'https://www.oklink.com/xlayer';
  return (
    <div className="mb-4 rounded border border-violet-900/60 bg-violet-950/20 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-violet-400">
          On-chain attestation
        </div>
        <div className="text-[10px] text-neutral-500 font-mono">
          {new Date(attestation.attestedAt).toISOString()}
        </div>
      </div>
      <div className="space-y-1 text-xs font-mono">
        {attestation.txHash ? (
          <div className="text-neutral-300 truncate">
            <span className="text-neutral-600 mr-2">tx</span>
            <a
              className="hover:text-violet-300 underline break-all"
              href={`${explorerBase}/tx/${attestation.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {attestation.txHash}
            </a>
          </div>
        ) : (
          <div className="text-rose-400">tx pending / failed</div>
        )}
        <div className="text-neutral-400 truncate">
          <span className="text-neutral-600 mr-2">contract</span>
          <a
            className="hover:text-violet-300 underline"
            href={`${explorerBase}/address/${attestation.contractAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            {attestation.contractAddress}
          </a>
        </div>
        <div className="text-neutral-400 truncate">
          <span className="text-neutral-600 mr-2">signer</span>
          {attestation.signer}
        </div>
        <div className="text-neutral-500 truncate">
          <span className="text-neutral-600 mr-2">sig</span>
          {shortSig}
        </div>
        <div className="text-neutral-500 truncate">
          <span className="text-neutral-600 mr-2">sessionHash</span>
          {attestation.sessionHash}
        </div>
        <div className="text-neutral-500 truncate">
          <span className="text-neutral-600 mr-2">verdictHash</span>
          {attestation.verdictHash}
        </div>
      </div>
    </div>
  );
}

// The sub-agent service `research-deep-dive` embeds its own nested x402
// payments in the response payload. Each nested call has its own tx hash
// that should appear under the parent call in the dashboard to make the
// agent-to-agent chain visible. If the shape doesn't match, bail silently.
function renderNestedCalls(data: unknown): React.ReactNode {
  if (!data || typeof data !== 'object') return null;
  const outer = data as { data?: unknown };
  const inner = outer.data;
  if (!inner || typeof inner !== 'object') return null;
  const nested = (inner as { nestedCalls?: unknown }).nestedCalls;
  if (!Array.isArray(nested) || nested.length === 0) return null;
  return (
    <div className="mt-2 pl-3 border-l-2 border-fuchsia-900/60">
      <div className="text-[10px] uppercase tracking-wide text-fuchsia-400 mb-1">
        Sub-agent x402 chain ({nested.length} nested calls)
      </div>
      <div className="space-y-1">
        {nested.map((n, i) => {
          const entry = n as {
            service?: string;
            priceUsdg?: string;
            txHash?: string | null;
            error?: string | null;
          };
          return (
            <div key={i} className="text-[11px] font-mono text-neutral-400">
              <span className="text-neutral-500">
                {entry.service ?? 'unknown'} ({entry.priceUsdg ?? '?'} USDG):
              </span>{' '}
              {entry.txHash ? (
                <a
                  className="hover:text-neutral-200 underline break-all"
                  href={`https://www.oklink.com/xlayer/tx/${entry.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {entry.txHash}
                </a>
              ) : (
                <span className="text-rose-400">{entry.error ?? 'no tx'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
