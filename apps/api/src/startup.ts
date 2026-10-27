import {
  createCloudFirestoreBoundary,
  createEmulatorFirestoreBoundary,
  type CloudFirestoreBoundary,
  type EmulatorFirestoreBoundary,
} from '@leadflow-ai/runtime';
import {
  loadPhaseOneConfig,
  type CloudConfig,
  type LocalConfig,
  type PhaseOneConfig,
} from './config.js';

export type PhaseOneStartup =
  | {
      status: 'ready';
      configuration: LocalConfig;
      firestore: EmulatorFirestoreBoundary;
    }
  | {
      status: 'ready';
      configuration: CloudConfig;
      firestore: CloudFirestoreBoundary;
    }
  | {
      status: 'unavailable';
      reason: 'invalid_local_configuration' | 'invalid_cloud_configuration';
      firestore: null;
    };

export type ReadyStartup = Extract<PhaseOneStartup, { status: 'ready' }>;

export const PHASE_ONE_UNAVAILABLE: PhaseOneStartup = {
  status: 'unavailable',
  reason: 'invalid_local_configuration',
  firestore: null,
};

export const CLOUD_UNAVAILABLE: PhaseOneStartup = {
  status: 'unavailable',
  reason: 'invalid_cloud_configuration',
  firestore: null,
};

type FirestoreBoundaryFactory = (
  environment: Readonly<Record<string, string | undefined>>,
) => EmulatorFirestoreBoundary;

type CloudBoundaryFactory = (
  configuration: { projectId: string; databaseId: string },
  environment: NodeJS.ProcessEnv,
) => CloudFirestoreBoundary;

export function createPhaseOneStartup(
  environment: NodeJS.ProcessEnv = process.env,
  createBoundary: FirestoreBoundaryFactory = createEmulatorFirestoreBoundary,
  createCloudBoundary: CloudBoundaryFactory = createCloudFirestoreBoundary,
): PhaseOneStartup {
  const hosted = environment.LEADFLOW_RUNTIME_MODE === 'cloud';
  let configuration: PhaseOneConfig;
  try {
    configuration = loadPhaseOneConfig(environment);
  } catch {
    // Stateful readiness fails closed; it never falls back to the other mode.
    return hosted ? CLOUD_UNAVAILABLE : PHASE_ONE_UNAVAILABLE;
  }

  if (configuration.mode === 'cloud') {
    try {
      const firestore = createCloudBoundary(
        {
          projectId: configuration.projectId,
          databaseId: configuration.databaseId,
        },
        environment,
      );
      return { status: 'ready', configuration, firestore };
    } catch {
      return CLOUD_UNAVAILABLE;
    }
  }

  const firestore = createBoundary({
    GCLOUD_PROJECT: configuration.projectId,
    FIRESTORE_EMULATOR_HOST: configuration.firestoreHost,
  });
  return { status: 'ready', configuration, firestore };
}
