import { SystemBundleDocumentSchema } from '@leadflow-ai/domain';
import { describe, expect, it } from 'vitest';
import {
  LOCAL_DEPLOYMENT,
  bindHostedSystemBundle,
  bindSystemBundle,
  projectDigest,
  type SystemBundleBase,
} from './release.js';

const digest = 'b'.repeat(64);
const hostedInput = {
  projectId: 'synthetic-hosted-project',
  revision: 'leadflow-ai-demo-00001-abc',
  imageDigest: `sha256:${'a'.repeat(64)}`,
};

function base(configuration: 'phase-2-local-v1' | 'phase-3-cloud-v1') {
  return {
    schemaVersion: 'system-bundle-v5',
    code: {
      revision: 'c'.repeat(40),
      dirty: false,
      sourceDigest: digest,
      patchDigest: null,
    },
    lockfileDigest: digest,
    fixtures: { version: 'phase-4.0', digest },
    versions: {
      intake: 'intake-v3',
      lead: 'lead-v3',
      run: 'run-v2',
      event: 'event-v2',
      checkpoint: 'checkpoint-v1',
      rubric: 'rubric-v1',
      interpreter: 'deterministic-interpreter-v1',
      graph: 'phase-2-graph-v1',
      checkpointer: 'firestore-checkpointer-v1',
      simulator: 'simulator-v1',
      enrichmentAdapters: 'enrichment-adapters-v1',
      composer: 'deterministic-template-v1',
      verificationRules: 'verification-rules-v2',
      decisionLanguage: 'decision-language-v1',
      metricsDefinitions: 'metrics-definitions-v2',
      channelRules: 'channel-rules-v1',
      spendFixture: 'synthetic-spend-v1',
      trafficPlan: 'traffic-plan-v1',
      agentTeam: null,
      evaluator: 'phase-4.0',
      configuration,
    },
    environment: {
      node: '24.22.1',
      pnpm: '12.15.0',
      java: '21.0.12.1',
      firebaseCli: '15.34.1',
      firestoreEmulator: '1.22.0',
      structurizrCli: '2025.11.09',
      platform: 'linux',
      architecture: 'x64',
    },
    provider: { value: null, reason: 'provider gate unresolved' },
    model: { value: null, reason: 'model gate unresolved' },
    prompt: { value: null, reason: 'no model prompt' },
    enrichmentMode: 'recorded',
    liveToolContracts: {
      hosts: ['vpic.nhtsa.dot.gov', 'api.zippopotam.us'],
      authorization:
        'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
    },
  } as SystemBundleBase;
}

describe('system-bundle-v3 deployment binding', () => {
  it('binds the hosted manifest to its revision and image digest', () => {
    const bundle = bindHostedSystemBundle(
      { schemaVersion: 'release-manifest-v1', base: base('phase-3-cloud-v1') },
      hostedInput,
      '2026-10-26T00:00:00.000Z',
    );
    expect(bundle.deployment).toMatchObject({
      mode: 'cloud',
      projectDigest: projectDigest(hostedInput.projectId),
      revision: hostedInput.revision,
      imageDigest: hostedInput.imageDigest,
      firestore: {
        location: 'northamerica-northeast2',
        retentionPolicy: 'retention-7d-v1',
      },
    });
    // The private project ID is bound only by digest.
    expect(JSON.stringify(bundle)).not.toContain(hostedInput.projectId);
  });

  it('changes identity whenever the deployment changes', () => {
    const manifest = {
      schemaVersion: 'release-manifest-v1',
      base: base('phase-3-cloud-v1'),
    };
    const first = bindHostedSystemBundle(manifest, hostedInput);
    const nextRevision = bindHostedSystemBundle(manifest, {
      ...hostedInput,
      revision: 'leadflow-ai-demo-00002-def',
    });
    const nextImage = bindHostedSystemBundle(manifest, {
      ...hostedInput,
      imageDigest: `sha256:${'d'.repeat(64)}`,
    });
    expect(
      new Set([first, nextRevision, nextImage].map((b) => b.systemBundleId))
        .size,
    ).toBe(3);
    // Same inputs, same identity: a restarted instance reuses its bundle.
    expect(bindHostedSystemBundle(manifest, hostedInput).systemBundleId).toBe(
      first.systemBundleId,
    );
  });

  it.each([
    ['mutable image tag', { imageDigest: 'leadflow-ai-demo:latest' }],
    ['missing revision', { revision: undefined }],
    ['other service revision', { revision: 'another-service-00001-abc' }],
    ['demo project', { projectId: 'demo-leadflow-ai-local' }],
  ])('refuses a hosted binding with a %s', (_label, change) => {
    expect(() =>
      bindHostedSystemBundle(
        {
          schemaVersion: 'release-manifest-v1',
          base: base('phase-3-cloud-v1'),
        },
        { ...hostedInput, ...change },
      ),
    ).toThrow();
  });

  it('refuses a local, dirty or live-enrichment build as a hosted bundle', () => {
    const dirty = base('phase-3-cloud-v1');
    dirty.code.dirty = true;
    const live = base('phase-3-cloud-v1');
    live.enrichmentMode = 'live';
    for (const candidate of [base('phase-2-local-v1'), dirty, live]) {
      expect(() =>
        bindHostedSystemBundle(
          { schemaVersion: 'release-manifest-v1', base: candidate },
          hostedInput,
        ),
      ).toThrow();
    }
  });

  it('refuses a manifest that already carries a deployment binding', () => {
    expect(() =>
      bindHostedSystemBundle(
        {
          schemaVersion: 'release-manifest-v1',
          base: { ...base('phase-3-cloud-v1'), deployment: LOCAL_DEPLOYMENT },
        },
        hostedInput,
      ),
    ).toThrow();
  });

  it('keeps local bundles bound to the emulator project', () => {
    const bundle = bindSystemBundle(base('phase-2-local-v1'), LOCAL_DEPLOYMENT);
    expect(SystemBundleDocumentSchema.parse(bundle).deployment.mode).toBe(
      'local',
    );
    expect(() =>
      bindSystemBundle(base('phase-3-cloud-v1'), LOCAL_DEPLOYMENT),
    ).toThrow();
  });
});
