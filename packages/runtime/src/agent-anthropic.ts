import Anthropic from '@anthropic-ai/sdk';
import {
  ModelCallError,
  type CitedBlock,
  type ModelPort,
  type ModelRequest,
  type ModelResponse,
} from './agent-team.js';

// Anthropic direct (owner decision 2026-10-27). The key comes from the
// process environment, loaded by the local launch script from the gitignored
// `.env`; it is never logged or stored. Errors become safe codes only.
export class AnthropicModelPort implements ModelPort {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    if (apiKey.trim().length === 0) {
      throw new Error('ANTHROPIC_API_KEY is not set.');
    }
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        output_config: {
          // Short structured tasks: low effort keeps thinking tokens small.
          effort: 'low',
          ...(request.jsonSchema === undefined
            ? {}
            : {
                format: { type: 'json_schema', schema: request.jsonSchema },
              }),
        },
        ...(request.webSearchMaxUses === undefined
          ? {}
          : {
              // Haiku 5.5 takes the basic web search variant (claude-api skill).
              tools: [
                {
                  type: 'web_search_20250305',
                  name: 'web_search',
                  max_uses: request.webSearchMaxUses,
                },
              ],
            }),
      });
    } catch (error) {
      throw new ModelCallError(errorCode(error));
    }
    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      webSearchRequests:
        message.usage.server_tool_use?.web_search_requests ?? 0,
    };
    if (message.stop_reason === 'refusal') {
      throw new ModelCallError('refusal', usage);
    }
    if (message.stop_reason === 'max_tokens') {
      throw new ModelCallError('max_tokens', usage);
    }
    const citedBlocks: CitedBlock[] = [];
    const texts: string[] = [];
    for (const block of message.content) {
      if (block.type !== 'text') continue;
      texts.push(block.text);
      const citations = (block.citations ?? []).flatMap((citation) =>
        citation.type === 'web_search_result_location'
          ? [
              {
                url: citation.url,
                title: citation.title,
                citedText: citation.cited_text,
              },
            ]
          : [],
      );
      if (citations.length > 0)
        citedBlocks.push({ text: block.text, citations });
    }
    return { text: texts.join(''), citedBlocks, usage };
  }
}

function errorCode(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'authentication';
  if (error instanceof Anthropic.RateLimitError) return 'rate_limited';
  if (error instanceof Anthropic.BadRequestError) return 'bad_request';
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'timeout';
  if (error instanceof Anthropic.APIConnectionError) return 'connection';
  if (error instanceof Anthropic.APIError) return 'api_error';
  return 'call_failed';
}
