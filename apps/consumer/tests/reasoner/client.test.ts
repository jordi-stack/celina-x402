import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReasonerClient } from '../../src/reasoner/client';

describe('ReasonerClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reason() calls Groq API with system + user prompts and returns parsed Decision', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'consume_service',
              service: 'market-snapshot',
              reason: 'Need price data before deciding on swap',
              expected_benefit: 'Informed trade decision',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 300, completion_tokens: 80 },
    });

    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const client = new ReasonerClient(
      { apiKey: 'K', baseUrl: 'https://api.groq.com', model: 'llama-3.3-70b-versatile' },
      fakeClient as never
    );

    const decision = await client.reason({
      balanceUsdg: 10,
      recentEarnings: [],
      recentSpends: [],
      cycleNumber: 1,
      minBalanceUsdg: 0.5,
    });

    expect(decision.action).toBe('consume_service');
    expect(decision.service).toBe('market-snapshot');
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0]![0];
    expect(callArgs.model).toBe('llama-3.3-70b-versatile');
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.response_format).toEqual({ type: 'json_object' });
  });

  it('retries once on JSON parse error', async () => {
    const mockCreate = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'not json at all' } }],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'wait',
                reason: 'Retry succeeded after prior parse failure',
                expected_benefit: 'valid json restored',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      });

    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const client = new ReasonerClient(
      { apiKey: 'K', baseUrl: 'https://api.groq.com', model: 'llama-3.3-70b-versatile' },
      fakeClient as never
    );

    const decision = await client.reason({
      balanceUsdg: 10,
      recentEarnings: [],
      recentSpends: [],
      cycleNumber: 1,
      minBalanceUsdg: 0.5,
    });

    expect(decision.action).toBe('wait');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('throws on 429 rate limit error with marked error type', async () => {
    const rateLimit = new Error('429 Too Many Requests') as Error & { status: number };
    rateLimit.status = 429;
    const mockCreate = vi.fn().mockRejectedValue(rateLimit);

    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const client = new ReasonerClient(
      { apiKey: 'K', baseUrl: 'https://api.groq.com', model: 'llama-3.3-70b-versatile' },
      fakeClient as never
    );

    await expect(
      client.reason({
        balanceUsdg: 10,
        recentEarnings: [],
        recentSpends: [],
        cycleNumber: 1,
        minBalanceUsdg: 0.5,
      })
    ).rejects.toThrow(/429|rate limit/i);
  });
});
