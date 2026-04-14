import OpenAI from 'openai';
import type { ResearchStep, ResearchSynthesis } from '@x402/shared';
import { ResearchStepSchema, ResearchSynthesisSchema } from '@x402/shared';
import {
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
    const userPrompt = buildPlanUserPrompt(ctx);

    const doCall = () =>
      this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: STEP_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

    let response = await doCall();
    let content = response.choices[0]?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      response = await doCall();
      content = response.choices[0]?.message?.content ?? '';
      parsed = JSON.parse(content);
    }

    const step = ResearchStepSchema.parse(parsed);
    return {
      step,
      metadata: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - start,
        model: this.config.model,
      },
    };
  }

  async synthesize(ctx: SynthesizeContext): Promise<SynthesizeResult> {
    const start = Date.now();
    const userPrompt = buildSynthesizeUserPrompt(ctx);

    const doCall = () =>
      this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: SYNTHESIZE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

    let response = await doCall();
    let content = response.choices[0]?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      response = await doCall();
      content = response.choices[0]?.message?.content ?? '';
      parsed = JSON.parse(content);
    }

    const synthesis = ResearchSynthesisSchema.parse(parsed);
    return {
      synthesis,
      metadata: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - start,
        model: this.config.model,
      },
    };
  }
}
