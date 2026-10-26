import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ErrorResponseSchema,
  ExecuteResponseSchema,
  SessionResponseSchema,
} from '@leadflow-ai/domain';
import {
  RunRevisionConflictError,
  RunStateConflictError,
} from '@leadflow-ai/runtime';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type CreateAppOptions } from './app.js';
import {
  loadPhaseOneConfig,
  loadServerConfig,
  type CloudConfig,
} from './config.js';
import type { ExecuteRouteDependencies } from './execute-route.js';
import { hostedOperatorPrincipal, type IapVerification } from './iap.js';
import {
  CLOUD_UNAVAILABLE,
  PHASE_ONE_UNAVAILABLE,
  createPhaseOneStartup,
  type PhaseOneStartup,
} from './startup.js';
import { CONTENT_SECURITY_POLICY, loadStaticAssets } from './static-web.js';

// Synthetic placeholders only: no real project, audience or subject.
const PROJECT = 'synthetic-hosted-project';
const AUDIENCE =
  '/projects/123456789012/locations/northamerica-northeast2/services/leadflow-ai-demo';
const OWNER = 'accounts.google.com:100000000000000000001';
const IMAGE = `sha256:${'a'.repeat(64)}`;
const runId = '22222222-2222-4222-8222-222222222222';

const cloudEnvironment = {
  LEADFLOW_RUNTIME_MODE: 'cloud',
  PORT: '8080',
  GOOGLE_CLOUD_PROJECT: PROJECT,
  LEADFLOW_FIRESTORE_DATABASE: '(default)',
  LEADFLOW_FIRESTORE_LOCATION: 'northamerica-northeast2',
  LEADFLOW_RETENTION_POLICY: 'retention-7d-v1',
  LEADFLOW_ENRICHMENT_MODE: 'recorded',
  LEADFLOW_IAP_AUDIENCE: AUDIENCE,
  LEADFLOW_ALLOWED_SUBJECTS: OWNER,
  K_SERVICE: 'leadflow-ai-demo',
  K_REVISION: 'leadflow-ai-demo-00001-abc',
  LEADFLOW_IMAGE_DIGEST: IMAGE,
};

const apps = new Set<ReturnType<typeof createApp>>();
afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

function cloudStartup(): PhaseOneStartup {
  const configuration = loadPhaseOneConfig(cloudEnvironment) as CloudConfig;
  return {
    status: 'ready',
    configuration,
    firestore: {
      app: {} as never,
      database: {} as never,
      configuration: { projectId: PROJECT, databaseId: '(default)' },
      close: async () => undefined,
    },
  };
}

function verifierReturning(result: IapVerification) {
  const seen: unknown[] = [];
  return {
    seen,
    verify: async (assertion: unknown) => {
      seen.push(assertion);
      return result;
    },
  };
}

const allowed: IapVerification = {
  status: 'allowed',
  principal: hostedOperatorPrincipal(OWNER),
};

function build(options: Partial<CreateAppOptions> = {}) {
  const app = createApp({
    phaseOne: cloudStartup(),
    iapVerifier: verifierReturning(allowed),
    ...options,
  });
  apps.add(app);
  return app;
}

describe('strict local and hosted configuration', () => {
  it('selects local mode by default and keeps loopback listening', () => {
    expect(loadServerConfig({})).toEqual({ host: '127.0.0.1', port: 3001 });
    expect(() => loadServerConfig({ HOST: '0.0.0.0', PORT: '8080' })).toThrow();
  });

  it('listens on the platform port only in hosted mode', () => {
    expect(loadServerConfig(cloudEnvironment)).toEqual({
      host: '0.0.0.0',
      port: 8080,
    });
    expect(() =>
      loadServerConfig({ LEADFLOW_RUNTIME_MODE: 'cloud' }),
    ).toThrow();
  });

  it('accepts the complete hosted configuration and parses the allowlist', () => {
    const configuration = loadPhaseOneConfig(cloudEnvironment);
    expect(configuration).toMatchObject({
      mode: 'cloud',
      configurationVersion: 'phase-3-cloud-v1',
      enrichmentMode: 'recorded',
      localResetEnabled: false,
      allowedSubjects: [OWNER],
    });
  });

  it.each([
    ['missing audience', { LEADFLOW_IAP_AUDIENCE: undefined }],
    ['missing allowlist', { LEADFLOW_ALLOWED_SUBJECTS: undefined }],
    ['email allowlist', { LEADFLOW_ALLOWED_SUBJECTS: 'owner@example.com' }],
    ['live enrichment', { LEADFLOW_ENRICHMENT_MODE: 'live' }],
    ['mock enrichment', { LEADFLOW_ENRICHMENT_MODE: 'mock' }],
    ['other region', { LEADFLOW_FIRESTORE_LOCATION: 'us-central1' }],
    ['named database', { LEADFLOW_FIRESTORE_DATABASE: 'leadflow' }],
    ['demo project', { GOOGLE_CLOUD_PROJECT: 'demo-leadflow-ai-local' }],
    ['missing project', { GOOGLE_CLOUD_PROJECT: undefined }],
    ['emulator host', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }],
    ['reset flag', { LEADFLOW_LOCAL_RESET_ENABLED: 'false' }],
    ['key file', { GOOGLE_APPLICATION_CREDENTIALS: '/tmp/key.json' }],
    ['other service', { K_SERVICE: 'another-service' }],
    ['mutable image', { LEADFLOW_IMAGE_DIGEST: 'latest' }],
    ['missing retention', { LEADFLOW_RETENTION_POLICY: undefined }],
  ])('fails closed for hosted %s', (_label, change) => {
    let boundaries = 0;
    const startup = createPhaseOneStartup(
      { ...cloudEnvironment, ...change },
      () => {
        throw new Error('local boundary must not be constructed');
      },
      () => {
        boundaries += 1;
        throw new Error('hosted boundary must not be constructed');
      },
    );
    expect(startup).toEqual(CLOUD_UNAVAILABLE);
    expect(boundaries).toBe(0);
  });

  it('never falls back to local state when hosted mode is selected', () => {
    const startup = createPhaseOneStartup(
      {
        LEADFLOW_RUNTIME_MODE: 'cloud',
        GCLOUD_PROJECT: 'demo-leadflow-ai-local',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        LEADFLOW_ENRICHMENT_MODE: 'recorded',
      },
      () => {
        throw new Error('local boundary must not be constructed');
      },
    );
    expect(startup).toEqual(CLOUD_UNAVAILABLE);
  });

  it('applies the loopback guard to any configuration not explicitly hosted', async () => {
    const startup = cloudStartup() as Extract<
      PhaseOneStartup,
      { status: 'ready' }
    >;
    const unlabelled: Partial<CloudConfig> = {
      ...(startup.configuration as CloudConfig),
    };
    delete unlabelled.mode;
    const app = createApp({
      phaseOne: {
        ...startup,
        configuration: {
          ...unlabelled,
          apiHost: '127.0.0.1',
          webOrigin: 'http://127.0.0.1:5173',
        },
      } as unknown as PhaseOneStartup,
    });
    apps.add(app);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/session',
      headers: { host: 'attacker.example' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects an unknown runtime mode', () => {
    expect(createPhaseOneStartup({ LEADFLOW_RUNTIME_MODE: 'hybrid' })).toEqual(
      PHASE_ONE_UNAVAILABLE,
    );
  });

  it('serves only process health when hosted configuration is incomplete', async () => {
    const app = createApp({ phaseOne: CLOUD_UNAVAILABLE });
    apps.add(app);
    expect(
      (await app.inject({ method: 'GET', url: '/health' })).statusCode,
    ).toBe(200);
    for (const url of ['/', '/v1/session', `/v1/runs/${runId}`]) {
      expect((await app.inject({ method: 'GET', url })).statusCode, url).toBe(
        503,
      );
    }
    const intake = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      payload: {},
    });
    expect(intake.statusCode).toBe(503);
  });

  it('refuses to build a hosted app without the IAP verifier', () => {
    expect(() => createApp({ phaseOne: cloudStartup() })).toThrow(
      /IAP assertion verifier/u,
    );
  });
});

describe('hosted IAP boundary', () => {
  it('passes the signed assertion header, not identity headers, to the verifier', async () => {
    const verifier = verifierReturning(allowed);
    const app = build({ iapVerifier: verifier });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/session',
      headers: {
        'x-goog-iap-jwt-assertion': 'signed.assertion.value',
        'x-goog-authenticated-user-email':
          'accounts.google.com:owner@example.com',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(verifier.seen).toEqual(['signed.assertion.value']);
    const session = SessionResponseSchema.parse(response.json());
    expect(session).toEqual({
      schemaVersion: 'session-response-v1',
      mode: 'cloud',
      operator: 'private-owner',
      authentication: 'iap-verified',
      enrichmentMode: 'recorded',
    });
    expect(response.body).not.toContain('owner@example.com');
    expect(response.body).not.toContain(OWNER);
  });

  it.each([
    ['unauthenticated', 401, 'authentication_required'],
    ['forbidden', 403, 'access_denied'],
  ] as const)(
    'denies %s requests before any route or state is reached',
    async (status, code, errorCode) => {
      let executed = 0;
      const app = build({
        iapVerifier: verifierReturning({ status }),
        execute: {
          execute: async () => {
            executed += 1;
            throw new Error('state must not be reached');
          },
        },
      });
      for (const request of [
        { method: 'GET' as const, url: '/v1/session' },
        { method: 'GET' as const, url: `/v1/runs/${runId}` },
        {
          method: 'POST' as const,
          url: `/v1/runs/${runId}/execute`,
          payload: { expectedRevision: 1 },
        },
        { method: 'GET' as const, url: '/' },
      ]) {
        const response = await app.inject(request);
        expect(response.statusCode).toBe(code);
        expect(ErrorResponseSchema.parse(response.json()).error.code).toBe(
          errorCode,
        );
      }
      expect(executed).toBe(0);
    },
  );

  it('keeps only the stateless process health check outside the boundary', async () => {
    const verifier = verifierReturning({ status: 'unauthenticated' });
    const app = build({ iapVerifier: verifier });
    expect(
      (await app.inject({ method: 'GET', url: '/health' })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/health?probe=1' })).statusCode,
    ).toBe(401);
    expect(verifier.seen).toHaveLength(1);
  });

  it('disables the emulator reset route in hosted mode', async () => {
    const app = build();
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/local-data',
      payload: {},
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('hosted request-bound execution', () => {
  function executeWith(execute: ExecuteRouteDependencies['execute']) {
    return build({ execute: { execute } });
  }

  it('returns the stored outcome after bounded work', async () => {
    const app = executeWith(async (request) => ({
      schemaVersion: 'execute-response-v1',
      runId: request.runId,
      revision: request.expectedRevision + 9,
      status: 'complete',
      outcome: 'finished',
    }));
    const response = await app.inject({
      method: 'POST',
      url: `/v1/runs/${runId}/execute`,
      payload: { expectedRevision: 1 },
    });
    expect(response.statusCode).toBe(200);
    expect(ExecuteResponseSchema.parse(response.json()).status).toBe(
      'complete',
    );
  });

  it('reports a deadline as a retryable non-success', async () => {
    const app = executeWith(async (request) => ({
      schemaVersion: 'execute-response-v1',
      runId: request.runId,
      revision: 4,
      status: 'running',
      outcome: 'deadline',
    }));
    const response = await app.inject({
      method: 'POST',
      url: `/v1/runs/${runId}/execute`,
      payload: { expectedRevision: 1 },
    });
    expect(response.statusCode).toBe(504);
    expect(ErrorResponseSchema.parse(response.json()).error).toMatchObject({
      code: 'execution_deadline',
      retryable: true,
    });
  });

  it.each([
    [new RunRevisionConflictError(), 'revision_conflict'],
    [new RunStateConflictError('not persisted'), 'run_ineligible'],
  ])(
    'rejects duplicate or stale execution as a conflict',
    async (cause, code) => {
      const app = executeWith(async () => {
        throw cause;
      });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/runs/${runId}/execute`,
        payload: { expectedRevision: 1 },
      });
      expect(response.statusCode).toBe(409);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe(code);
    },
  );

  it('is not registered in local mode', async () => {
    const app = createApp({
      phaseOne: {
        status: 'ready',
        configuration: {
          mode: 'local',
          configurationVersion: 'phase-2-local-v1',
          projectId: 'demo-leadflow-ai-local',
          firestoreHost: '127.0.0.1:8080',
          apiHost: 'localhost',
          localResetEnabled: false,
          enrichmentMode: 'recorded',
          webOrigin: 'http://127.0.0.1:5173',
        },
        firestore: {
          app: {} as never,
          database: {} as never,
          configuration: {
            projectId: 'demo-leadflow-ai-local',
            host: '127.0.0.1:8080',
          },
          close: async () => undefined,
        },
      },
    });
    apps.add(app);
    const response = await app.inject({
      method: 'POST',
      url: `/v1/runs/${runId}/execute`,
      headers: { host: 'localhost' },
      payload: { expectedRevision: 1 },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('same-origin web assets', () => {
  let directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'leadflow-web-'));
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'index.html'), '<!doctype html>');
    await writeFile(path.join(directory, 'assets', 'index-abc.js'), 'void 0;');
    await writeFile(path.join(directory, 'notes.map'), 'not served');
  });
  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('serves only the built files, with security and cache headers', async () => {
    const app = build({ staticAssets: await loadStaticAssets(directory) });
    const index = await app.inject({ method: 'GET', url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.headers['content-type']).toContain('text/html');
    expect(index.headers['cache-control']).toBe('no-cache');
    expect(index.headers['content-security-policy']).toBe(
      CONTENT_SECURITY_POLICY,
    );
    expect(index.headers['x-frame-options']).toBe('DENY');
    const script = await app.inject({
      method: 'GET',
      url: '/assets/index-abc.js',
    });
    expect(script.headers['cache-control']).toContain('immutable');
    for (const url of [
      '/notes.map',
      '/%2e%2e/package.json',
      '/assets/missing.js',
    ]) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(404);
    }
  });

  it('requires a built web entry', async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), 'leadflow-empty-'));
    await expect(loadStaticAssets(empty)).rejects.toThrow(/web entry/u);
    await rm(empty, { recursive: true, force: true });
  });
});
