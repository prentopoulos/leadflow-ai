import {
  AgentSettingsSchema,
  AgentSettingsUpdateSchema,
  AnthropicApiKeyUpdateSchema,
  ErrorResponseSchema,
  type AgentSettings,
} from '@leadflow-ai/domain';
import type { FastifyInstance } from 'fastify';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

export interface AgentRouteDependencies {
  settings(): AgentSettings;
  setEnabled(enabled: boolean): AgentSettings;
  saveApiKey(apiKey: string): Promise<AgentSettings>;
}

// Local only: the dashboard switch for the opt-in agent team. Hosted mode
// never registers it (PROJECT.md, Phase 5 decisions).
export function registerAgentRoutes(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  requestIdFactory: RequestIdFactory,
  dependencies?: AgentRouteDependencies,
): void {
  if (
    dependencies === undefined ||
    phaseOne.status !== 'ready' ||
    phaseOne.configuration.mode !== 'local'
  ) {
    return;
  }
  app.get(
    '/v1/agents',
    { schema: { response: { 200: AgentSettingsSchema } } },
    async () => dependencies.settings(),
  );
  app.put(
    '/v1/agents',
    {
      schema: {
        body: AgentSettingsUpdateSchema,
        response: { 200: AgentSettingsSchema, 409: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      const { enabled } = AgentSettingsUpdateSchema.parse(request.body);
      if (enabled && !dependencies.settings().available) {
        return reply.code(409).send(
          createErrorResponse(
            {
              code: 'invariant_failed',
              category: 'conflict',
              retryable: false,
              message:
                'The agent team needs an Anthropic API key before it can be enabled.',
            },
            requestIdFactory,
          ),
        );
      }
      return dependencies.setEnabled(enabled);
    },
  );
  app.put(
    '/v1/agents/key',
    {
      schema: {
        body: AnthropicApiKeyUpdateSchema,
        response: { 200: AgentSettingsSchema },
      },
    },
    async (request) => {
      const { apiKey } = AnthropicApiKeyUpdateSchema.parse(request.body);
      return dependencies.saveApiKey(apiKey);
    },
  );
}
