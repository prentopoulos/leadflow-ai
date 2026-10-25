const expectedHost = '127.0.0.1:8080';
const expectedProjectId = 'demo-leadflow-ai-local';

if (process.env.FIRESTORE_EMULATOR_HOST !== expectedHost) {
  throw new Error(
    `Expected FIRESTORE_EMULATOR_HOST=${expectedHost}; received ${process.env.FIRESTORE_EMULATOR_HOST ?? 'unset'}.`,
  );
}

if (
  process.env.GCLOUD_PROJECT !== undefined &&
  process.env.GCLOUD_PROJECT !== expectedProjectId
) {
  throw new Error(
    `Expected GCLOUD_PROJECT=${expectedProjectId}; received ${process.env.GCLOUD_PROJECT}.`,
  );
}

const endpoint = `http://${expectedHost}/emulator/v1/projects/${expectedProjectId}/databases/(default)/documents`;
const response = await fetch(endpoint, { method: 'DELETE' });
if (!response.ok) {
  throw new Error(
    `Firestore Emulator flush failed with HTTP ${response.status}.`,
  );
}

console.log(
  `Firestore Emulator ${expectedProjectId} is isolated on ${expectedHost}; verified flush passed.`,
);
