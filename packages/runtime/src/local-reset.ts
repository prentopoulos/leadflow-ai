import { LEADFLOW_LOCAL_PROJECT_ID } from '@leadflow-ai/domain';
import { LEADFLOW_FIRESTORE_EMULATOR_HOST } from './firestore.js';

export const LOCAL_RESET_CONFIRMATION =
  'DELETE SYNTHETIC LEADFLOW LOCAL DATA' as const;

export interface LocalResetRequest {
  enabled: boolean;
  remoteAddress: string;
  projectId: string;
  firestoreHost: string;
  confirmation: string;
}

export interface LocalResetResult {
  projectId: typeof LEADFLOW_LOCAL_PROJECT_ID;
  firestoreHost: typeof LEADFLOW_FIRESTORE_EMULATOR_HOST;
  evidenceClass: 'synthetic-local';
  deleted: true;
}

export class LocalResetDeniedError extends Error {
  readonly code = 'reset_denied' as const;

  constructor(message: string) {
    super(message);
    this.name = 'LocalResetDeniedError';
  }
}

export async function resetLocalEmulatorData(
  request: LocalResetRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<LocalResetResult> {
  if (!request.enabled) {
    throw new LocalResetDeniedError('Local reset is disabled.');
  }
  if (request.remoteAddress !== '127.0.0.1') {
    throw new LocalResetDeniedError('Local reset requires a loopback request.');
  }
  if (request.projectId !== LEADFLOW_LOCAL_PROJECT_ID) {
    throw new LocalResetDeniedError('Local reset project is not authorized.');
  }
  if (request.firestoreHost !== LEADFLOW_FIRESTORE_EMULATOR_HOST) {
    throw new LocalResetDeniedError(
      'Local reset emulator host is not authorized.',
    );
  }
  if (request.confirmation !== LOCAL_RESET_CONFIRMATION) {
    throw new LocalResetDeniedError('Local reset confirmation did not match.');
  }

  const endpoint =
    `http://${LEADFLOW_FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/` +
    `${LEADFLOW_LOCAL_PROJECT_ID}/databases/(default)/documents`;
  const response = await fetchImplementation(endpoint, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(
      `Firestore Emulator reset failed with HTTP ${response.status}.`,
    );
  }
  return {
    projectId: LEADFLOW_LOCAL_PROJECT_ID,
    firestoreHost: LEADFLOW_FIRESTORE_EMULATOR_HOST,
    evidenceClass: 'synthetic-local',
    deleted: true,
  };
}
