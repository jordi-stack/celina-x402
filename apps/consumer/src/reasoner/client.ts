import OpenAI from 'openai';
import type { Decision } from '@x402/shared';
import { DecisionSchema } from '@x402/shared';
import { SYSTEM_PROMPT, buildUserPrompt, type AgentState } from './prompts';

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

export interface ReasonResult {
  decision: Decision;
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

  async reasonWithMeta(state: AgentState): Promise<ReasonResult> {
    const start = Date.now();
    const userPrompt = buildUserPrompt(state);

    const doCall = async () => {
      return this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
    };

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

    const decision = DecisionSchema.parse(parsed);

    return {
      decision,
      metadata: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - start,
        model: this.config.model,
      },
    };
  }

  async reason(state: AgentState): Promise<Decision> {
    const result = await this.reasonWithMeta(state);
    return result.decision;
  }
}
