import { checkConstitution } from './check-constitution.mjs';
import { checkContainer } from './check-container.mjs';
import { checkHygiene } from './check-hygiene.mjs';
import { checkNoSend } from './check-no-send.mjs';

await checkConstitution();
await checkHygiene();
await checkNoSend();
await checkContainer();
