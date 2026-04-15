'use client';

import type React from 'react';
import type { ResearchSession, ResearchCall, SessionAttestation } from '@x402/shared';
import { RESEARCH_SERVICE_CATALOG } from '@x402/shared';
import { CopyButton } from './ui/CopyButton';
import { ConfidenceBar } from './ui/ConfidenceBar';
import { SubAgentChain } from './SubAgentChain';

interface Props {
  session: ResearchSession;
}

const CONFIDENCE_LABEL_COLOR: Record<string, string> = {
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

const ACTIVE_STATUSES = new Set(['planning', 'calling', 'synthesizing']);

function usdgFromMinimal(minimal: string): string {
  const n = Number(minimal);
  if (!Number.isFinite(n)) return minimal;
  return (n / 1_000_000).toFixed(6);
}

function statusPhrase(session: ResearchSession): string {
  const n = session.calls.length;
  switch (session.status) {
    case 'planning':
      return n === 0 ? 'Planning the first call...' : `Planning step ${n + 1}...`;
    case 'calling':
      return `Calling paid service (#${n})...`;
    case 'synthesizing':
      return 'Synthesizing verdict + grading calls...';
    default:
      return session.status;
  }
}

export function ReportCard({ session }: Props) {
  const active = ACTIVE_STATUSES.has(session.status);
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-6">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <div className="text-sm uppercase tracking-wide text-neutral-400">
          Research Session
        </div>
        <div className="flex items-baseline gap-3 text-xs">
          {active ? (
            <span className="inline-flex items-baseline gap-1.5 text-amber-400 font-mono">
              <span className="relative inline-flex h-2 w-2 self-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              {statusPhrase(session)}
            </span>
          ) : (
            <span className={STATUS_COLOR[session.status] ?? 'text-neutral-400'}>
              {session.status}
            </span>
          )}
          <span className="text-neutral-400 font-mono">
            spent {usdgFromMinimal(session.totalSpent)} USDG
          </span>
        </div>
      </div>

      <div className="mb-4 text-neutral-100 text-sm italic">
        &ldquo;{session.question}&rdquo;
      </div>

      {!session.synthesis && active && (
        <LiveProgress session={session} />
      )}

      {session.synthesis && (
        <div className="mb-4 rounded border border-neutral-700 bg-neutral-900/60 p-4">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs uppercase text-neutral-400">Verdict</div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-[10px] uppercase font-semibold ${
                  CONFIDENCE_LABEL_COLOR[session.synthesis.confidence] ?? 'text-neutral-400'
                }`}
              >
                {session.synthesis.confidence}
              </span>
              <ConfidenceBar score={session.synthesis.confidenceScore} />
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

      <div className="text-xs uppercase text-neutral-400 mb-2">
        Service calls ({session.calls.length})
      </div>
      <div className="space-y-2">
        {session.calls.length === 0 && (
          <div className="text-xs text-neutral-500">
            {active ? 'Waiting for the planner to pick the first service...' : 'No calls yet.'}
          </div>
        )}
        {session.calls.map((call, i) => (
          <CallRow key={i} call={call} />
        ))}
      </div>
    </div>
  );
}

/**
 * Live progress strip shown while the session is still in flight. Renders
 * the growing call list with plan reasons as they stream in from polling,
 * plus a pulsing indicator for the current in-progress step. Disappears
 * once the synthesis block takes over.
 */
function LiveProgress({ session }: { session: ResearchSession }) {
  return (
    <div className="mb-4 rounded border border-sky-900/50 bg-sky-950/20 p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="relative inline-flex h-2 w-2 self-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-400" />
        </span>
        <span className="text-[10px] uppercase tracking-wide text-sky-300 font-semibold">
          Agent thinking live
        </span>
        <span className="text-[10px] text-neutral-400 ml-auto">
          polling every 1s
        </span>
      </div>
      <div className="space-y-2 font-mono text-[11px]">
        {session.calls.map((c, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-neutral-500 shrink-0">#{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sky-300">{c.service}</span>
                <span className="text-neutral-500">paid {c.amountSpent && (Number(c.amountSpent) / 1_000_000).toFixed(3)} USDG</span>
                <ConfidenceBar score={c.planConfidence} className="ml-auto" />
              </div>
              {c.planReason && (
                <div className="mt-1 text-neutral-400 not-italic normal-case font-sans text-xs">
                  {c.planReason}
                </div>
              )}
            </div>
          </div>
        ))}
        {session.status === 'planning' && (
          <div className="flex gap-2 text-neutral-400">
            <span className="shrink-0">▶</span>
            <span>Planning next step...</span>
          </div>
        )}
        {session.status === 'calling' && (
          <div className="flex gap-2 text-amber-400">
            <span className="shrink-0">$</span>
            <span>Signing x402 payment + waiting for settlement...</span>
          </div>
        )}
        {session.status === 'synthesizing' && (
          <div className="flex gap-2 text-purple-400">
            <span className="shrink-0">✓</span>
            <span>Synthesizing verdict + grading each call 0-1 for usefulness...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CallRow({ call }: { call: ResearchCall }) {
  const meta = RESEARCH_SERVICE_CATALOG[call.service];
  const ok = call.error === null;
  const gradeColor =
    call.grade === null
      ? 'text-neutral-400'
      : call.grade.usefulness >= 0.7
        ? 'text-emerald-400'
        : call.grade.usefulness >= 0.4
          ? 'text-amber-400'
          : 'text-rose-400';
  const nested = extractNestedCalls(call.data);
  return (
    <div className="rounded border border-neutral-700 bg-neutral-900/40 p-3 text-xs font-mono">
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
          <span className="text-neutral-400">{meta.priceUsdg} USDG</span>
        </div>
      </div>
      {call.planReason && (
        <div className="mt-2 pl-2 border-l-2 border-neutral-700 text-neutral-400 not-italic normal-case font-sans text-xs">
          <span className="text-neutral-500 uppercase text-[10px] tracking-wide mr-1">
            plan (conf {call.planConfidence.toFixed(2)})
          </span>
          {call.planReason}
        </div>
      )}
      {call.planExpectedValue && (
        <div className="mt-1 pl-2 border-l-2 border-neutral-700 text-neutral-400 not-italic normal-case font-sans text-xs">
          <span className="text-neutral-500 uppercase text-[10px] tracking-wide mr-1">
            expected
          </span>
          {call.planExpectedValue}
        </div>
      )}
      {call.grade && (
        <div className="mt-1 pl-2 border-l-2 border-neutral-700 text-neutral-400 not-italic normal-case font-sans text-xs">
          <span className={`uppercase text-[10px] tracking-wide mr-1 ${gradeColor}`}>
            grade
          </span>
          {call.grade.note}
        </div>
      )}
      <div className="mt-1 text-neutral-400 break-all">
        args: {JSON.stringify(call.args)}
      </div>
      {call.txHash && (
        <div className="mt-1 text-neutral-500 flex items-baseline gap-2">
          <span className="shrink-0">tx:</span>
          <a
            className="hover:text-neutral-400 underline truncate min-w-0"
            href={`https://www.oklink.com/xlayer/tx/${call.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {call.txHash}
          </a>
          <CopyButton value={call.txHash} label="tx hash" className="shrink-0" />
        </div>
      )}
      {nested && nested.length > 0 && (
        <SubAgentChain
          parentService={call.service}
          parentPriceUsdg={meta.priceUsdg}
          parentTxHash={call.txHash}
          nestedCalls={nested}
        />
      )}
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
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-violet-300 font-semibold">
            Verified on-chain
          </span>
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-300">
            <path d="M3 8.5L6.5 12L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-[10px] text-neutral-400 font-mono">
          {new Date(attestation.attestedAt).toISOString()}
        </div>
      </div>
      <div className="space-y-1.5 text-xs font-mono">
        {attestation.txHash ? (
          <div className="text-neutral-300 flex items-baseline gap-2">
            <span className="text-neutral-500 shrink-0 w-20">attest tx</span>
            <a
              className="hover:text-violet-300 underline truncate min-w-0"
              href={`${explorerBase}/tx/${attestation.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {attestation.txHash}
            </a>
            <CopyButton value={attestation.txHash} label="tx hash" className="shrink-0" />
          </div>
        ) : (
          <div className="text-rose-400">tx pending / failed</div>
        )}
        <div className="text-neutral-400 flex items-baseline gap-2">
          <span className="text-neutral-500 shrink-0 w-20">contract</span>
          <a
            className="hover:text-violet-300 underline truncate min-w-0"
            href={`${explorerBase}/address/${attestation.contractAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            {attestation.contractAddress}
          </a>
          <CopyButton value={attestation.contractAddress} label="contract" className="shrink-0" />
        </div>
        <div className="text-neutral-400 flex items-baseline gap-2">
          <span className="text-neutral-500 shrink-0 w-20">signer</span>
          <span className="truncate min-w-0">{attestation.signer}</span>
          <CopyButton value={attestation.signer} label="signer" className="shrink-0" />
        </div>
        <div className="text-neutral-400 flex items-baseline gap-2">
          <span className="text-neutral-500 shrink-0 w-20">signature</span>
          <span className="truncate min-w-0">{shortSig}</span>
          <CopyButton value={attestation.signature} label="signature" className="shrink-0" />
        </div>
        <div className="text-neutral-400 flex items-baseline gap-2">
          <span className="text-neutral-500 shrink-0 w-20">session hash</span>
          <span className="truncate min-w-0">{attestation.sessionHash}</span>
          <CopyButton value={attestation.sessionHash} label="session hash" className="shrink-0" />
        </div>
        <div className="text-neutral-400 flex items-baseline gap-2">
          <span className="text-neutral-500 shrink-0 w-20">verdict hash</span>
          <span className="truncate min-w-0">{attestation.verdictHash}</span>
          <CopyButton value={attestation.verdictHash} label="verdict hash" className="shrink-0" />
        </div>
      </div>
    </div>
  );
}

// The sub-agent service `research-deep-dive` embeds its own nested x402
// payments in the response payload. Extracted into a structured list so
// SubAgentChain can render the agent-to-agent chain diagram.
function extractNestedCalls(data: unknown): Array<{
  service?: string;
  priceUsdg?: string;
  txHash?: string | null;
  error?: string | null;
  durationMs?: number;
}> | null {
  if (!data || typeof data !== 'object') return null;
  const outer = data as { data?: unknown };
  const inner = outer.data;
  if (!inner || typeof inner !== 'object') return null;
  const nested = (inner as { nestedCalls?: unknown }).nestedCalls;
  if (!Array.isArray(nested) || nested.length === 0) return null;
  return nested as Array<{
    service?: string;
    priceUsdg?: string;
    txHash?: string | null;
    error?: string | null;
    durationMs?: number;
  }>;
}
