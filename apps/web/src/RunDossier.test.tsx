// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { RunDetailResponse } from '@leadflow-ai/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunDossier } from './RunDossier.js';
import type { RunClient, RunResult } from './run-client.js';

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  event: '33333333-3333-4333-8333-333333333333',
  trace: '44444444-4444-4444-8444-444444444444',
  request: '55555555-5555-4555-8555-555555555555',
  bundle: '66666666-6666-4666-8666-666666666666',
  result: '77777777-7777-4777-8777-777777777777',
} as const;
const timestamp = '2026-10-25T18:00:00.000Z';

const phaseOneUiStateManifest = [
  'loading',
  'empty',
  'validation_error',
  'persistence_error',
  'in_progress',
  'retrying',
  'partial',
  'failed_retryable',
  'failed_terminal',
  'complete',
  'stale',
  'long_content',
] as const;

function detail(status: RunDetailResponse['run']['status']): RunDetailResponse {
  const failed = status === 'failed_retryable';
  const complete = status === 'complete';
  return {
    schemaVersion: 'run-detail-response-v2',
    lead: {
      schemaVersion: 'lead-v3',
      leadId: ids.lead,
      createdAt: timestamp,
      intake: {
        schemaVersion: 'intake-v3',
        attribution: null,
        identityClass: 'fictional',
        givenName: 'Avery',
        familyName: 'Jordan',
        email: 'avery.jordan@example.com',
        zipCode: '22150',
        vehicleYear: 2021,
        vehicleMake: 'Subaru',
        vehicleModel: 'Outback',
        coverageFocus: 'balanced',
        requestIntent: 'compare_options',
        needTimeline: 'days_31_to_90',
        requestDetails: 'Synthetic test request.',
        emailContactConsent: false,
        consentRecord: null,
      },
      provenance: {
        sourceId: 'military-com-auto-landing',
        sourceUrl: 'https://auto.military.com/',
        retrievedAt: '2026-10-24',
        exactSourceFields: ['zipCode'],
        demoFields: [
          'givenName',
          'familyName',
          'email',
          'vehicleYear',
          'vehicleMake',
          'vehicleModel',
          'coverageFocus',
          'requestIntent',
          'needTimeline',
          'requestDetails',
          'emailContactConsent',
        ],
        simulatedFields: ['attribution'],
        parityVerified: false,
      },
      evidenceClass: 'synthetic',
    },
    run: {
      schemaVersion: 'run-v2',
      runId: ids.run,
      leadId: ids.lead,
      createdAt: timestamp,
      updatedAt: timestamp,
      status,
      revision: complete ? 10 : 4,
      nextEventSequence: 2,
      attempt: complete ? 1 : 2,
      retryCount: failed ? 1 : 0,
      currentStep: null,
      completedSteps: complete
        ? [
            'interpret_qualification',
            'score_qualification',
            'simulate_outcome',
            'finalize_run',
          ]
        : [],
      lease: null,
      qualificationResultId: complete ? ids.result : null,
      simulationRecordId: complete ? `simulation:${ids.run}` : null,
      enrichmentMode: null,
      enrichmentEvidenceIds: [],
      emailCheckId: null,
      evidenceCompleteness: 'not_evaluated',
      draftId: null,
      draftSkipReason: null,
      verificationResultId: null,
      holds: [],
      safeError: failed
        ? {
            code: 'transient_interpreter_fault',
            category: 'runtime',
            retryable: true,
            message:
              'The synthetic interpreter fault is ready for operator resume.',
          }
        : null,
      systemBundleId: ids.bundle,
    },
    events: [
      {
        schemaVersion: 'event-v2',
        eventId: ids.event,
        runId: ids.run,
        traceId: ids.trace,
        requestId: ids.request,
        sequence: 1,
        runRevision: 0,
        name: 'lead.persisted',
        occurredAt: timestamp,
        step: null,
        status: 'persisted',
        durationMs: null,
        attempt: 0,
        retryCount: 0,
        authorization: 'not_applicable',
        safeError: null,
        systemBundleId: ids.bundle,
        evidenceClass: 'synthetic-local',
        externalCall: null,
        usage: null,
        usageUnavailableReason: 'no_model_or_paid_tool',
      },
    ],
    qualification: complete
      ? {
          schemaVersion: 'qualification-result-v1',
          rubricVersion: 'rubric-v1',
          interpreterVersion: 'deterministic-interpreter-v1',
          resultId: ids.result,
          runId: ids.run,
          leadId: ids.lead,
          generatedAt: timestamp,
          classification: 'marketing_readiness',
          criteria: {
            needTimeline: {
              points: 30,
              maximum: 40,
              components: [
                {
                  component: 'days_31_to_90',
                  points: 30,
                  evidenceFields: ['needTimeline'],
                },
              ],
            },
            requestClarity: {
              points: 30,
              maximum: 30,
              components: [
                {
                  component: 'declared_intent_focus_details',
                  points: 30,
                  evidenceFields: [
                    'requestIntent',
                    'coverageFocus',
                    'requestDetails',
                  ],
                },
              ],
            },
            completeness: {
              points: 30,
              maximum: 30,
              components: [
                {
                  component: 'complete_intake',
                  points: 30,
                  evidenceFields: [
                    'givenName',
                    'familyName',
                    'email',
                    'vehicleYear',
                    'vehicleMake',
                    'vehicleModel',
                    'zipCode',
                    'coverageFocus',
                  ],
                },
              ],
            },
          },
          total: 90,
          priority: 'high',
          missingInformation: [],
          integrityHold: null,
          meaning: 'marketing readiness only; not an insurance decision',
        }
      : null,
    simulation: complete
      ? {
          schemaVersion: 'simulation-record-v1',
          simulatorVersion: 'simulator-v1',
          seedVersion: 'seed-v1',
          simulationRecordId: `simulation:${ids.run}`,
          runId: ids.run,
          generatedAt: timestamp,
          seed: 42,
          fixtureClass: 'synthetic',
          outcome: { contacted: true, responded: false, appointment: false },
          evidenceClass: 'synthetic',
          notices: ['not_live', 'not_predictive'],
        }
      : null,
    enrichment: [],
    emailCheck: null,
    draft: null,
    verification: null,
    retrievedAt: '2026-10-25T18:00:01.000Z',
    evidenceClass: 'synthetic-local',
  };
}

afterEach(cleanup);

describe('run dossier', () => {
  it('enumerates the complete deterministic Phase 1 UI state manifest', () => {
    expect(phaseOneUiStateManifest).toEqual([
      'loading',
      'empty',
      'validation_error',
      'persistence_error',
      'in_progress',
      'retrying',
      'partial',
      'failed_retryable',
      'failed_terminal',
      'complete',
      'stale',
      'long_content',
    ]);
  });

  it('renders loading without inventing a stored revision', () => {
    const client: RunClient = {
      get: vi.fn(
        () => new Promise<RunResult<RunDetailResponse>>(() => undefined),
      ),
      resume: vi.fn(),
    };
    render(
      <RunDossier
        runId={ids.run}
        initialRevision={0}
        client={client}
        maxPollAttempts={1}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Loading…' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/revision 1/i)).not.toBeInTheDocument();
  });

  it.each([
    ['running', 'Running'],
    ['retrying', 'Retrying'],
    ['partial', 'Partial'],
  ] as const)(
    'renders the stored %s progress state',
    async (status, heading) => {
      const state = detail(status);
      state.run.currentStep = 'interpret_qualification';
      const client: RunClient = {
        get: vi.fn(async () => ({ status: 'ok' as const, value: state })),
        resume: vi.fn(),
      };
      render(
        <RunDossier
          runId={ids.run}
          initialRevision={0}
          client={client}
          maxPollAttempts={1}
        />,
      );

      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(screen.getByText('Interpret qualification')).toBeInTheDocument();
    },
  );

  it('renders stored lifecycle, explainable qualification, and non-predictive simulation', async () => {
    const client: RunClient = {
      get: vi.fn(async () => ({
        status: 'ok' as const,
        value: detail('complete'),
      })),
      resume: vi.fn(),
    };
    render(
      <RunDossier
        runId={ids.run}
        initialRevision={0}
        client={client}
        maxPollAttempts={1}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'High priority' }),
    ).toBeInTheDocument();
    expect(screen.getByText('90', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByText('Lead persisted')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Simulation' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Simulated (yes|no)$/u)).toHaveLength(3);
  });

  it('exposes explicit resume only for an eligible stored failure', async () => {
    const failed = detail('failed_retryable');
    const running = detail('running');
    running.run.revision = 5;
    running.run.safeError = null;
    const client: RunClient = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ status: 'ok' as const, value: failed })
        .mockResolvedValueOnce({ status: 'ok' as const, value: running }),
      resume: vi.fn(async () => ({
        status: 'ok' as const,
        value: {
          schemaVersion: 'resume-response-v1' as const,
          runId: ids.run,
          revision: 5,
          status: 'running' as const,
          replayed: false,
        },
      })),
    };
    render(
      <RunDossier
        runId={ids.run}
        initialRevision={0}
        client={client}
        maxPollAttempts={1}
      />,
    );

    const button = await screen.findByRole('button', {
      name: 'Resume retryable run',
    });
    fireEvent.click(button);
    await waitFor(() => expect(client.resume).toHaveBeenCalledWith(ids.run, 4));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Running' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /resume/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a terminal failure without an unavailable resume action', async () => {
    const terminal = detail('failed_terminal');
    terminal.run.safeError = {
      code: 'invariant_failed',
      category: 'runtime',
      retryable: false,
      message: 'Stored evidence failed an integrity check.',
    };
    const client: RunClient = {
      get: vi.fn(async () => ({ status: 'ok' as const, value: terminal })),
      resume: vi.fn(),
    };
    render(
      <RunDossier
        runId={ids.run}
        initialRevision={0}
        client={client}
        maxPollAttempts={1}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Failed terminal' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Stored evidence failed an integrity check.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('retains the last confirmed revision when a later poll is unavailable', async () => {
    const running = detail('running');
    running.run.revision = 3;
    const client: RunClient = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ status: 'ok' as const, value: running })
        .mockResolvedValueOnce({
          status: 'error' as const,
          error: {
            code: 'storage_unavailable',
            category: 'storage',
            retryable: true,
            message: 'Newer stored run state is temporarily unavailable.',
          },
        }),
      resume: vi.fn(),
    };
    render(
      <RunDossier
        runId={ids.run}
        initialRevision={0}
        client={client}
        pollIntervalMs={1}
        maxPollAttempts={2}
      />,
    );

    expect(await screen.findByText('Refresh failed')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Running' }),
    ).toBeInTheDocument();
  });

  it('keeps external control focus while polling appends long stored history', async () => {
    const running = detail('running');
    const complete = detail('complete');
    complete.events = Array.from({ length: 40 }, (_, index) => ({
      ...complete.events[0]!,
      eventId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sequence: index + 1,
      runRevision: index,
      name:
        index === 39 ? ('run.completed' as const) : ('step.completed' as const),
    }));
    const client: RunClient = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ status: 'ok' as const, value: running })
        .mockResolvedValueOnce({ status: 'ok' as const, value: complete }),
      resume: vi.fn(),
    };
    render(
      <>
        <button type="button">Operator control</button>
        <RunDossier
          runId={ids.run}
          initialRevision={0}
          client={client}
          pollIntervalMs={1}
          maxPollAttempts={2}
        />
      </>,
    );

    const control = screen.getByRole('button', { name: 'Operator control' });
    control.focus();
    expect(
      await screen.findByRole('heading', { name: 'High priority' }),
    ).toBeInTheDocument();
    expect(control).toHaveFocus();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(40);
  });
});
