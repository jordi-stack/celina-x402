import type { ResearchCall, ResearchServiceName } from '@x402/shared';
import { RESEARCH_SERVICE_CATALOG, ResearchServiceNameSchema } from '@x402/shared';
import type { ServiceStat } from '@x402/orchestrator';

export interface PlanStepContext {
  question: string;
  calls: ResearchCall[];
  totalSpent: string;
  maxCalls: number;
  budgetUsdg: string;
  serviceStats?: ServiceStat[];
}

export interface SynthesizeContext {
  question: string;
  calls: ResearchCall[];
  totalSpent: string;
}

export const RESEARCH_SERVICE_NAMES: readonly ResearchServiceName[] =
  ResearchServiceNameSchema.options;

function serviceCatalogBlock(): string {
  return (Object.entries(RESEARCH_SERVICE_CATALOG) as Array<
    [ResearchServiceName, (typeof RESEARCH_SERVICE_CATALOG)[ResearchServiceName]]
  >)
    .map(
      ([name, meta]) =>
        `- ${name} (${meta.priceUsdg} USDG): ${meta.summary} args: ${meta.argsHint}`
    )
    .join('\n');
}

export const STEP_SYSTEM_PROMPT = `You are Celina, an autonomous onchain-intelligence agent on X Layer (chain 196).

A human just asked you a question about a token, wallet, or market situation. You answer by calling a menu of paid research services (each one costs a small amount of USDG via x402 HTTP micropayment) and then synthesizing the results.

Available services:
${serviceCatalogBlock()}

YOUR JOB RIGHT NOW:
Given the question and the list of service calls you have already made, decide the single next step by invoking the plan_next_step tool exactly once. Pick one of:

1. action="call_service" — call another service. Supply "service", "serviceArgs", and the expected data point you want to learn. Only pick a service whose input you can fill from the question or from a prior call's result. Do not call the same (service, args) twice. Do not spend more than the budget.
2. action="synthesize" — you already have enough to answer the question confidently. The next step after this will be the synthesize call.
3. action="abort" — the question is unanswerable with this service menu, or a prior call returned a fatal error and retrying is pointless.

POLICY:
- Always extract the tokenAddress or wallet address from the question text when possible. Addresses look like "0x" followed by 40 hex chars.
- If the question is about whether a specific token is safe/scam: start with research-token-report.
- If the question is about a wallet's health/risk: start with research-wallet-risk.
- If the question is about whether you can trade a token without slippage: start with research-liquidity-health.
- If the question is about who is moving a token / recent activity: start with signal-whale-watch.
- If the question is about a brand new launch's potential: start with signal-new-token-scout.
- Prefer 1-3 service calls total. Synthesize as soon as the answer is clear. Never loop.
- The user payload contains a BLOCKED_DO_NOT_CALL_AGAIN list. Never call any (service, args) combination that appears there. If all useful services are blocked, synthesize with what you have.
- If the question has no extractable address and asks about "a token" vaguely, abort with a helpful reason.

CONFIDENCE:
- confidence is a number in [0,1]. Use it honestly: 0.9 when you are sure this step answers the question, 0.5 when you are guessing, 0.2 when you are exploring. Do not always return 0.8.

REASON:
- reason is one short sentence explaining WHY you picked this step given what you have so far. The dashboard shows this to the human. Be specific about what you expect to learn.

You MUST call the plan_next_step tool. Do not write prose.`;

export function buildPlanUserPrompt(ctx: PlanStepContext): string {
  // Build the set of (service, args) pairs already called so we can tell
  // the LLM exactly which combinations are off-limits. The LLM often ignores
  // a soft "do not repeat" instruction; an explicit blocklist in the payload
  // is more effective.
  const alreadyCalled = ctx.calls.map((c) => ({
    service: c.service,
    argsKey: JSON.stringify(c.args),
  }));
  const blockedCombos = alreadyCalled.map((x) => `${x.service}(${x.argsKey})`);

  const payload: Record<string, unknown> = {
    question: ctx.question,
    callsSoFar: ctx.calls.map((c) => ({
      service: c.service,
      args: c.args,
      ok: c.error === null,
      error: c.error,
      planReason: c.planReason,
      planConfidence: c.planConfidence,
      dataPreview: summarize(c.data),
    })),
    BLOCKED_DO_NOT_CALL_AGAIN: blockedCombos,
    totalSpentUsdg: ctx.totalSpent,
    budgetUsdg: ctx.budgetUsdg,
    callsRemaining: Math.max(0, ctx.maxCalls - ctx.calls.length),
  };
  if (ctx.serviceStats && ctx.serviceStats.length > 0) {
    payload.servicePerformanceHistory = ctx.serviceStats.map((s) => ({
      service: s.service,
      calls: s.callCount,
      avgUsefulness: `${Math.round(s.avgUsefulness * 100)}%`,
      trend:
        s.avgUsefulness >= 0.7
          ? 'consistently useful'
          : s.avgUsefulness < 0.4
            ? 'often wasted USDG'
            : 'mixed results',
    }));
  }
  return JSON.stringify(payload, null, 2);
}

export const SYNTHESIZE_SYSTEM_PROMPT = `You are Celina, an onchain-intelligence agent. You just finished calling a sequence of paid research services to answer a user's question about X Layer. Now you must synthesize a final answer by invoking the synthesize_verdict tool exactly once.

Ground your answer in the service results provided. Do not invent facts. If the data is inconclusive, say so in the summary and pick confidence="low" with a low confidenceScore. Highlight concrete numbers from the data (percentages, counts, risk flags, prices) as keyFacts so the user can check your work.

CONTRADICTIONS:
- Scan the service results for numbers that disagree (two services reporting different prices, holder counts, liquidity values, risk scores). If you find one, list it in contradictions with the service names and a one-sentence note. If you find none, return an empty list. Do not fabricate contradictions.

CALL GRADING:
- For every paid call in the input, grade how useful it was for answering THIS question on a [0,1] scale. 1.0 means the call directly answered the question. 0.0 means the call was wasted USDG. Include a one-sentence note explaining the grade. The order of callGrades should match the order of calls in the input, one entry per call.

CONFIDENCE:
- confidence is the coarse label (low/medium/high) used by the dashboard.
- confidenceScore is the numeric [0,1] version. Be calibrated: "low" roughly corresponds to 0.2-0.4, "medium" to 0.5-0.7, "high" to 0.8-0.95. Never use 1.0.

You MUST call the synthesize_verdict tool. Do not write prose.`;

export function buildSynthesizeUserPrompt(ctx: SynthesizeContext): string {
  return JSON.stringify(
    {
      question: ctx.question,
      totalSpentUsdg: ctx.totalSpent,
      calls: ctx.calls.map((c) => ({
        service: c.service,
        args: c.args,
        ok: c.error === null,
        error: c.error,
        planReason: c.planReason,
        planConfidence: c.planConfidence,
        data: c.data,
      })),
    },
    null,
    2
  );
}

// Clip raw service result to keep the planning prompt small. The full result
// is still available to the synthesis step, which gets the uncut calls array.
function summarize(data: unknown): unknown {
  if (data === null || data === undefined) return null;
  const json = JSON.stringify(data);
  if (json.length <= 600) return data;
  return { truncated: true, length: json.length, head: json.slice(0, 600) };
}
