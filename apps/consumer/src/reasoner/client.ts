import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from 'openai/resources/chat/completions';
import type { ResearchStep, ResearchSynthesis } from '@x402/shared';
import { ResearchStepSchema, ResearchSynthesisSchema } from '@x402/shared';
import {
  RESEARCH_SERVICE_NAMES,
  STEP_SYSTEM_PROMPT,
  SYNTHESIZE_SYSTEM_PROMPT,
  buildPlanUserPrompt,
  buildSynthesizeUserPrompt,
  type PlanStepContext,
  type SynthesizeContext,
} from './prompts';

export interface ReasonerConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ReasonMetadata {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
}

export interface PlanStepResult {
  step: ResearchStep;
  metadata: ReasonMetadata;
}

export interface SynthesizeResult {
  synthesis: ResearchSynthesis;
  metadata: ReasonMetadata;
}

// JSON Schema passed to Groq's tool-use API. Groq honors OpenAI's tools +
// tool_choice contract, so we force the model to emit exactly one call
// to plan_next_step with a structured payload. This replaces the older
// "respond with JSON and hope" path that sometimes produced unparseable
// content and had no native way to enforce required fields.
const PLAN_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'plan_next_step',
    description:
      "Decide the single next step for Celina's research session. Call this exactly once per planning turn.",
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['call_service', 'synthesize', 'abort'],
          description:
            'call_service = pay for another service. synthesize = enough data, wrap up. abort = unanswerable with current service menu.',
        },
        service: {
          type: 'string',
          enum: [...RESEARCH_SERVICE_NAMES],
          description:
            'Which service to invoke. REQUIRED when action=call_service, omit otherwise.',
        },
        serviceArgs: {
          type: 'object',
          additionalProperties: true,
          description:
            'Args passed to the service route body, e.g. { "tokenAddress": "0x..." } or { "address": "0x..." }. REQUIRED when action=call_service.',
        },
        reason: {
          type: 'string',
          minLength: 5,
          maxLength: 500,
          description:
            'Short, specific justification for THIS step given what has been learned so far. Shown to the end user in the dashboard.',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description:
            'How confident (0..1) that this step advances the answer. 0.9 = sure, 0.5 = guess, 0.2 = exploratory.',
        },
        expectedValue: {
          type: 'string',
          maxLength: 500,
          description:
            'The concrete data point you expect this step to produce, e.g. "the honeypot flag and top-holder concentration". Empty string for action != call_service.',
        },
      },
      required: ['action', 'reason', 'confidence'],
    },
  },
};

const SYNTHESIZE_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'synthesize_verdict',
    description:
      "Produce Celina's final verdict for the user's question by grounding in the paid service results. Call this exactly once.",
    parameters: {
      type: 'object',
      properties: {
        verdict: {
          type: 'string',
          minLength: 5,
          maxLength: 200,
          description: 'One-sentence bottom line, e.g. "Likely honeypot, avoid."',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Coarse qualitative band shown in the dashboard chip.',
        },
        confidenceScore: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description:
            'Numeric companion to confidence. Calibrate: low=0.2-0.4, medium=0.5-0.7, high=0.8-0.95. Never 1.0.',
        },
        summary: {
          type: 'string',
          minLength: 20,
          maxLength: 2000,
          description:
            '2-4 sentence explanation of the verdict, citing concrete numbers from the calls.',
        },
        keyFacts: {
          type: 'array',
          maxItems: 10,
          items: { type: 'string' },
          description:
            'Up to 10 single concrete data points extracted from the service results.',
        },
        contradictions: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            properties: {
              between: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                description: 'Service names whose data disagrees.',
              },
              note: {
                type: 'string',
                minLength: 5,
                maxLength: 500,
                description: 'One-sentence explanation of the conflict.',
              },
            },
            required: ['between', 'note'],
          },
          description:
            'Conflicts the synthesizer noticed across services. Empty array if none.',
        },
        callGrades: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              service: {
                type: 'string',
                description:
                  'The service name of the call being graded. Must match one from the input calls.',
              },
              usefulness: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description:
                  '0..1 retrospective usefulness. 1 = directly answered. 0 = wasted USDG.',
              },
              note: {
                type: 'string',
                maxLength: 300,
                description: 'One-sentence grading note.',
              },
            },
            required: ['service', 'usefulness', 'note'],
          },
          description:
            'One grade per input call in the same order. Must have exactly as many entries as the input calls array.',
        },
      },
      required: [
        'verdict',
        'confidence',
        'confidenceScore',
        'summary',
        'keyFacts',
        'contradictions',
        'callGrades',
      ],
    },
  },
};

const PLAN_TOOL_CHOICE: ChatCompletionToolChoiceOption = {
  type: 'function',
  function: { name: 'plan_next_step' },
};

const SYNTHESIZE_TOOL_CHOICE: ChatCompletionToolChoiceOption = {
  type: 'function',
  function: { name: 'synthesize_verdict' },
};

export class ReasonerClient {
  private readonly client: OpenAI;

  constructor(
    private readonly config: ReasonerConfig,
    injectedClient?: OpenAI
  ) {
    this.client =
      injectedClient ??
      new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
  }

  async planStep(ctx: PlanStepContext): Promise<PlanStepResult> {
    const start = Date.now();
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: STEP_SYSTEM_PROMPT },
      { role: 'user', content: buildPlanUserPrompt(ctx) },
    ];

    const parsed = await callTool(
      this.client,
      this.config.model,
      messages,
      PLAN_TOOL,
      PLAN_TOOL_CHOICE,
      'plan_next_step',
      0.2
    );

    const step = ResearchStepSchema.parse(parsed.args);
    return {
      step,
      metadata: {
        promptTokens: parsed.promptTokens,
        completionTokens: parsed.completionTokens,
        latencyMs: Date.now() - start,
        model: this.config.model,
      },
    };
  }

  async synthesize(ctx: SynthesizeContext): Promise<SynthesizeResult> {
    const start = Date.now();
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYNTHESIZE_SYSTEM_PROMPT },
      { role: 'user', content: buildSynthesizeUserPrompt(ctx) },
    ];

    const parsed = await callTool(
      this.client,
      this.config.model,
      messages,
      SYNTHESIZE_TOOL,
      SYNTHESIZE_TOOL_CHOICE,
      'synthesize_verdict',
      0.3
    );

    const synthesis = ResearchSynthesisSchema.parse(parsed.args);
    return {
      synthesis,
      metadata: {
        promptTokens: parsed.promptTokens,
        completionTokens: parsed.completionTokens,
        latencyMs: Date.now() - start,
        model: this.config.model,
      },
    };
  }
}

interface ToolCallOutcome {
  args: unknown;
  promptTokens: number;
  completionTokens: number;
}

// Single-retry helper around a Groq tool-use call. Groq sometimes returns
// malformed tool_call.arguments JSON (rare but observed with 8b models), and
// once in a blue moon ignores tool_choice entirely and writes prose into
// .content. We retry once with the same prompt on either failure and fail
// loud on the second attempt so the session runner can fall back gracefully.
async function callTool(
  client: OpenAI,
  model: string,
  messages: ChatCompletionMessageParam[],
  tool: ChatCompletionTool,
  toolChoice: ChatCompletionToolChoiceOption,
  expectedToolName: string,
  temperature: number
): Promise<ToolCallOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: [tool],
      tool_choice: toolChoice,
      temperature,
    });

    const choice = response.choices[0];
    const toolCalls = choice?.message?.tool_calls ?? [];
    const match = toolCalls.find((tc) => tc.function.name === expectedToolName);

    if (match) {
      try {
        const args = JSON.parse(match.function.arguments);
        return {
          args,
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
        };
      } catch (err) {
        if (attempt === 1) {
          throw new Error(
            `tool ${expectedToolName} returned invalid JSON args: ${(err as Error).message}`
          );
        }
      }
    } else if (attempt === 1) {
      const rawContent = choice?.message?.content ?? '';
      throw new Error(
        `model did not call tool ${expectedToolName}; content=${rawContent.slice(0, 200)}`
      );
    }
  }

  throw new Error(`callTool(${expectedToolName}) exhausted retries without result`);
}
