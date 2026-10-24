import { smokeApi } from './smoke-api.mjs';
import { smokeWeb } from './smoke-web.mjs';

await smokeApi();
await smokeWeb();
