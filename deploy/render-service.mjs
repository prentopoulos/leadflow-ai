// Renders deploy/service.template.yaml with private deployment parameters
// into the ignored .local/ directory. Every value is validated first so a
// mutable tag, a public principal, an email allowlist or a wrong audience
// never reaches Cloud Run. Usage (Cloud Shell, values from the private
// deployment record; nothing here is echoed):
//
//   LEADFLOW_PROJECT_ID=... LEADFLOW_PROJECT_NUMBER=... \
//   LEADFLOW_IMAGE_DIGEST=sha256:... LEADFLOW_COMMIT_SHA=... \
//   LEADFLOW_ALLOWED_SUBJECTS=accounts.google.com:... \
//   [LEADFLOW_PREVIOUS_REVISION=leadflow-ai-demo-...] \
//   node deploy/render-service.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const REGION = 'northamerica-northeast2';
const SERVICE = 'leadflow-ai-demo';

const rules = {
  LEADFLOW_PROJECT_ID: /^(?!demo-)[a-z][a-z0-9-]{4,28}[a-z0-9]$/u,
  LEADFLOW_PROJECT_NUMBER: /^\d{6,20}$/u,
  LEADFLOW_IMAGE_DIGEST: /^sha256:[a-f0-9]{64}$/u,
  LEADFLOW_COMMIT_SHA: /^[a-f0-9]{40}$/u,
  LEADFLOW_ALLOWED_SUBJECTS:
    /^accounts\.google\.com:\d{6,32}(?:,accounts\.google\.com:\d{6,32}){0,3}$/u,
};

export function renderService(template, environment) {
  for (const [name, pattern] of Object.entries(rules)) {
    if (!pattern.test(environment[name] ?? '')) {
      throw new Error(`${name} is missing or malformed.`);
    }
  }
  const previous = environment.LEADFLOW_PREVIOUS_REVISION;
  if (
    previous !== undefined &&
    !/^leadflow-ai-demo-[a-z0-9-]{1,40}$/u.test(previous)
  ) {
    throw new Error('LEADFLOW_PREVIOUS_REVISION is malformed.');
  }
  const projectId = environment.LEADFLOW_PROJECT_ID;
  const digest = environment.LEADFLOW_IMAGE_DIGEST;
  // A deterministic revision name binds K_REVISION to the commit.
  const revision = `${SERVICE}-${environment.LEADFLOW_COMMIT_SHA.slice(0, 12)}`;
  if (revision === previous) {
    throw new Error('The candidate revision equals the previous revision.');
  }
  const values = {
    REVISION_NAME: revision,
    PROJECT_ID: projectId,
    IMAGE_REFERENCE: `${REGION}-docker.pkg.dev/${projectId}/${SERVICE}/app@${digest}`,
    IMAGE_DIGEST: digest,
    IAP_AUDIENCE: `/projects/${environment.LEADFLOW_PROJECT_NUMBER}/locations/${REGION}/services/${SERVICE}`,
    ALLOWED_SUBJECTS: environment.LEADFLOW_ALLOWED_SUBJECTS,
    // The first release takes all traffic. Later candidates deploy at zero
    // traffic beside the verified previous revision, tagged for smoke tests.
    TRAFFIC:
      previous === undefined
        ? '[{revisionName: ' + revision + ', percent: 100}]'
        : `[{revisionName: ${previous}, percent: 100}, {revisionName: ${revision}, percent: 0, tag: candidate}]`,
  };
  const rendered = template.replace(/\$\{([A-Z_]+)\}/gu, (match, name) => {
    if (!(name in values)) throw new Error(`Unknown placeholder ${match}.`);
    return values[name];
  });
  if (/allUsers|allAuthenticatedUsers|:latest\b/u.test(rendered)) {
    throw new Error('The rendered service would be public or mutable.');
  }
  return { rendered, revision };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const template = await readFile(
    path.join(root, 'deploy', 'service.template.yaml'),
    'utf8',
  );
  const { rendered, revision } = renderService(template, process.env);
  const output = path.join(root, '.local', 'service.yaml');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, rendered, 'utf8');
  console.log(`Rendered revision ${revision} to .local/service.yaml.`);
}
