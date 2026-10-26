import { randomUUID } from 'node:crypto';
import {
  createHealthResponse,
  HealthResponseSchema,
  IAP_ASSERTION_HEADER,
  type OperatorPrincipal,
} from '@leadflow-ai/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  type ZodTypeProvider,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { PHASE_ONE_UNAVAILABLE, type PhaseOneStartup } from './startup.js';
import {
  createErrorResponse,
  registerIntakeRoute,
  type IntakeRouteDependencies,
  type RequestIdFactory,
} from './intake-route.js';
import { registerRunRoute, type RunRouteDependencies } from './run-route.js';
import {
  registerResumeRoute,
  type ResumeRouteDependencies,
} from './resume-route.js';
import {
  registerResetRoute,
  type ResetRouteDependencies,
} from './reset-route.js';
import {
  registerOperationsRoutes,
  type OperationsRouteDependencies,
} from './operations-route.js';
import {
  registerDraftRoutes,
  type DraftRouteDependencies,
} from './draft-route.js';
import type { IapAssertionVerifier } from './iap.js';
import { registerSessionRoute } from './session-route.js';
import { registerStaticWeb, type StaticAsset } from './static-web.js';
import {
  registerExecuteRoute,
  type ExecuteRouteDependencies,
} from './execute-route.js';

declare module 'fastify' {
  interface FastifyRequest {
    // Set only by the hosted IAP hook from a verified assertion.
    operator?: OperatorPrincipal;
  }
}

export interface CreateAppOptions {
  phaseOne?: PhaseOneStartup;
  intake?: IntakeRouteDependencies;
  runs?: RunRouteDependencies;
  resume?: ResumeRouteDependencies;
  reset?: ResetRouteDependencies;
  operations?: OperationsRouteDependencies;
  drafts?: DraftRouteDependencies;
  execute?: ExecuteRouteDependencies;
  executor?: { idle(): Promise<void> };
  iapVerifier?: Pick<IapAssertionVerifier, 'verify'>;
  // Built web assets served from the same origin in hosted mode.
  staticAssets?: ReadonlyMap<string, StaticAsset>;
  requestIdFactory?: RequestIdFactory;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const phaseOne = options.phaseOne ?? PHASE_ONE_UNAVAILABLE;
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  if (
    phaseOne.status === 'unavailable' &&
    phaseOne.reason === 'invalid_cloud_configuration'
  ) {
    // A hosted process with incomplete configuration serves nothing but its
    // process health; it never falls back to unauthenticated behavior.
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/health') return;
      return reply.code(503).send(
        createErrorResponse(
          {
            code: 'storage_unavailable',
            category: 'storage',
            retryable: false,
            message: 'The hosted service is not configured.',
          },
          options.requestIdFactory,
        ),
      );
    });
  }
  if (phaseOne.status === 'ready' && phaseOne.configuration.mode === 'cloud') {
    const verifier = options.iapVerifier;
    if (verifier === undefined) {
      throw new Error('Hosted mode requires the IAP assertion verifier.');
    }
    // Every application, API and asset request needs a verified assertion
    // for an allowlisted subject before any state is read. Only the
    // stateless process health check is exempt.
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/health') return;
      const verification = await verifier.verify(
        request.headers[IAP_ASSERTION_HEADER],
      );
      if (verification.status === 'allowed') {
        request.operator = verification.principal;
        return;
      }
      const forbidden = verification.status === 'forbidden';
      return reply.code(forbidden ? 403 : 401).send(
        createErrorResponse(
          forbidden
            ? {
                code: 'access_denied',
                category: 'access',
                retryable: false,
                message: 'This account is not allowed to use the service.',
              }
            : {
                code: 'authentication_required',
                category: 'access',
                retryable: true,
                message: 'Sign in again to continue.',
              },
          options.requestIdFactory,
        ),
      );
    });
  }
  if (phaseOne.status === 'ready' && phaseOne.configuration.mode !== 'cloud') {
    const configuration = phaseOne.configuration;
    app.addHook('onRequest', async (request, reply) => {
      const host = request.headers.host?.split(':', 1)[0]?.toLowerCase();
      const origin = request.headers.origin;
      const stateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(
        request.method,
      );
      if (
        host !== configuration.apiHost ||
        (stateChanging &&
          origin !== undefined &&
          origin !== configuration.webOrigin)
      ) {
        return reply.code(403).send(
          createErrorResponse(
            {
              code: 'access_denied',
              category: 'validation',
              retryable: false,
              message: 'Request host or origin is not allowed.',
            },
            options.requestIdFactory,
          ),
        );
      }
    });
  }
  app.setErrorHandler((error, _request, reply) => {
    const validation =
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      error.validation !== undefined;
    // Fastify's own client errors (malformed JSON, unsupported media type,
    // oversized body) carry a 4xx statusCode and stay client errors.
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    const clientError = validation || (statusCode >= 400 && statusCode < 500);
    const response = createErrorResponse(
      clientError
        ? {
            code: 'validation_failed',
            category: 'validation',
            retryable: false,
            message: 'Request validation failed.',
          }
        : {
            code: 'unknown_failure',
            category: 'runtime',
            retryable: false,
            message: 'The request could not be completed.',
          },
      options.requestIdFactory,
    );
    return reply
      .code(validation ? 400 : clientError ? statusCode : 500)
      .send(response);
  });

  if (phaseOne.status === 'ready') {
    app.addHook('onClose', async () => {
      await options.executor?.idle();
      await phaseOne.firestore.close();
    });
  }

  app.get(
    '/health',
    {
      schema: {
        response: { 200: HealthResponseSchema },
      },
    },
    async () =>
      createHealthResponse(
        phaseOne.status === 'ready'
          ? phaseOne.configuration.mode
          : phaseOne.reason === 'invalid_cloud_configuration'
            ? 'cloud'
            : 'local',
      ),
  );

  registerSessionRoute(app, phaseOne, options.requestIdFactory ?? randomUUID);
  registerIntakeRoute(app, phaseOne, options.intake, options.requestIdFactory);
  registerRunRoute(app, phaseOne, options.runs, options.requestIdFactory);
  registerOperationsRoutes(
    app,
    phaseOne,
    options.operations,
    options.requestIdFactory,
  );
  registerDraftRoutes(
    app,
    phaseOne,
    options.drafts,
    options.requestIdFactory ?? randomUUID,
  );
  registerResumeRoute(
    app,
    phaseOne,
    options.resume,
    options.requestIdFactory ?? randomUUID,
  );
  registerExecuteRoute(
    app,
    phaseOne,
    options.execute,
    options.requestIdFactory ?? randomUUID,
  );
  registerResetRoute(
    app,
    phaseOne,
    options.requestIdFactory ?? randomUUID,
    options.reset,
  );
  if (options.staticAssets !== undefined) {
    registerStaticWeb(app, options.staticAssets);
  }

  return app;
}
