import {
  createEmulatorFirestoreBoundary,
  type EmulatorFirestoreBoundary,
} from '@leadflow-ai/runtime';
import { loadPhaseOneConfig, type PhaseOneConfig } from './config.js';

export type PhaseOneStartup =
  | {
      status: 'ready';
      configuration: PhaseOneConfig;
      firestore: EmulatorFirestoreBoundary;
    }
  | {
      status: 'unavailable';
      reason: 'invalid_local_configuration';
      firestore: null;
    };

export const PHASE_ONE_UNAVAILABLE: PhaseOneStartup = {
  status: 'unavailable',
  reason: 'invalid_local_configuration',
  firestore: null,
};

type FirestoreBoundaryFactory = (
  environment: Readonly<Record<string, string | undefined>>,
) => EmulatorFirestoreBoundary;

export function createPhaseOneStartup(
  environment: NodeJS.ProcessEnv = process.env,
  createBoundary: FirestoreBoundaryFactory = createEmulatorFirestoreBoundary,
): PhaseOneStartup {
  let configuration: PhaseOneConfig;
  try {
    configuration = loadPhaseOneConfig(environment);
  } catch {
    return PHASE_ONE_UNAVAILABLE;
  }

  const firestore = createBoundary({
    GCLOUD_PROJECT: configuration.projectId,
    FIRESTORE_EMULATOR_HOST: configuration.firestoreHost,
  });
  return { status: 'ready', configuration, firestore };
}
