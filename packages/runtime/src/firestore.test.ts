import { describe, expect, it } from 'vitest';
import {
  createEmulatorFirestoreBoundary,
  LEADFLOW_FIRESTORE_EMULATOR_HOST,
  validateEmulatorFirestoreConfiguration,
} from './firestore.js';

const safeEnvironment = {
  GCLOUD_PROJECT: 'demo-leadflow-ai-local',
  FIRESTORE_EMULATOR_HOST: LEADFLOW_FIRESTORE_EMULATOR_HOST,
};

describe('emulator-only Firestore boundary', () => {
  it('accepts only the exact synthetic project and loopback host', () => {
    expect(validateEmulatorFirestoreConfiguration(safeEnvironment)).toEqual({
      projectId: 'demo-leadflow-ai-local',
      host: '127.0.0.1:8080',
    });
  });

  it.each([
    [{ ...safeEnvironment, GCLOUD_PROJECT: 'production-project' }],
    [{ ...safeEnvironment, FIRESTORE_EMULATOR_HOST: 'localhost:8080' }],
    [{ ...safeEnvironment, FIRESTORE_EMULATOR_HOST: '127.0.0.1:9090' }],
    [
      {
        ...safeEnvironment,
        FIRESTORE_EMULATOR_HOST: 'http://127.0.0.1:8080',
      },
    ],
    [{ GCLOUD_PROJECT: 'demo-leadflow-ai-local' }],
  ])(
    'rejects unsafe configuration before Admin SDK creation',
    (environment) => {
      expect(() => createEmulatorFirestoreBoundary(environment)).toThrow(
        /Unsafe Firestore/u,
      );
    },
  );
});
