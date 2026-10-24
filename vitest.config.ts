import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@leadflow-ai/domain': `${root}packages/domain/src/index.ts`,
      '@leadflow-ai/evals': `${root}packages/evals/src/index.ts`,
    },
  },
  test: {
    clearMocks: true,
    exclude: ['**/dist/**', '**/node_modules/**', '**/.tools/**'],
    include: [
      'apps/**/*.test.{ts,tsx}',
      'packages/**/*.test.ts',
      'scripts/**/*.test.mjs',
    ],
  },
});
