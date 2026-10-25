import { describe, expect, it } from 'vitest';
import { retainedStateArguments } from './firestore-emulator-modes.mjs';

describe('Firestore emulator persistence modes', () => {
  it.each(['start', 'exec', 'runtime', 'export'])(
    'keeps %s free of implicit import/export flags',
    (mode) => {
      expect(
        retainedStateArguments({
          mode,
          retainedState: '.local/firestore',
          retainedMetadataExists: true,
        }),
      ).toEqual([]);
    },
  );

  it('exports retained state only when retain mode is explicit', () => {
    expect(
      retainedStateArguments({
        mode: 'retain',
        retainedState: '.local/firestore',
        retainedMetadataExists: false,
      }),
    ).toEqual(['--export-on-exit=.local/firestore']);
  });

  it('imports existing retained state only in explicit retain mode', () => {
    expect(
      retainedStateArguments({
        mode: 'retain',
        retainedState: '.local/firestore',
        retainedMetadataExists: true,
      }),
    ).toEqual([
      '--export-on-exit=.local/firestore',
      '--import=.local/firestore',
    ]);
  });
});
