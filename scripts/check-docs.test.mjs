import { describe, expect, it } from 'vitest';
import {
  bottomLine,
  diagramCollections,
  expectedBottomLine,
  localTargets,
  modelNames,
  runtimeCollections,
  svgTexts,
} from './check-docs.mjs';
import { contrastRatio, Diagram, tokens } from './diagram-kit.mjs';
import { renderDiagrams } from './generate-diagrams.mjs';

describe('README checks', () => {
  it('collects local links and images but not URLs, anchors or code', () => {
    const markdown = [
      '[a](docs/a.md) [b](https://example.com) [c](#top)',
      '<img src="docs/b.svg" alt="">',
      '`[x](ignored.md)`',
      '```\n[y](ignored-too.md)\n```',
    ].join('\n');
    expect(localTargets(markdown)).toEqual(['docs/a.md', 'docs/b.svg']);
  });

  it('catches a drifted bottom-line figure', () => {
    const facts = { caseCount: 38, weights: [40, 30, 30] };
    const readme = `x\n<!-- bottom-line:start -->\n${expectedBottomLine(facts)}\n<!-- bottom-line:end -->`;
    expect(bottomLine(readme)).toBe(expectedBottomLine(facts));
    expect(bottomLine(readme)).not.toBe(
      expectedBottomLine({ ...facts, caseCount: 39 }),
    );
    expect(() => bottomLine('no markers')).toThrow('bottom-line');
  });
});

describe('architecture drift checks', () => {
  it('reads model element names from Structurizr DSL', () => {
    expect(
      modelNames(
        'a = person "Operator"\nb = softwareSystem "S" {\n c = container "Web" "d" "React"\n}',
      ),
    ).toEqual(['Operator', 'S', 'Web']);
  });

  it('matches runtime collection paths against data-model paths', () => {
    const runtime = runtimeCollections(
      'x => `leads/${id}` and `runs/${a}/events/${b}`',
      'return `runs/${id}/checkpoints`;',
    );
    expect([...runtime].sort()).toEqual([
      'checkpoints',
      'events',
      'leads',
      'runs',
    ]);
    const diagram = diagramCollections(
      '<text>leads/{leadId}</text><text>runs/{runId}/checkpoints</text><text># leadId</text>',
    );
    expect([...diagram].sort()).toEqual(['checkpoints', 'leads', 'runs']);
  });

  it('compares exported SVG text independently of order', () => {
    expect(svgTexts('<text x="1">B</text><text>A</text>')).toEqual(['A', 'B']);
  });
});

describe('diagram kit rules', () => {
  it('keeps every text token at 4.5:1 or better on paper', () => {
    for (const role of ['ink', 'muted', 'soft', 'accent', 'link']) {
      expect(contrastRatio(tokens[role], tokens.paper)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('rejects diagonal connectors, overlapping labels, overflow and extra accents', () => {
    const diagram = () => new Diagram({ slug: 't', width: 400, height: 200 });
    expect(() =>
      diagram().path([
        [0, 0],
        [10, 10],
      ]),
    ).toThrow('diagonal');
    const overlap = diagram();
    overlap.node({
      x: 100,
      y: 100,
      w: 120,
      kind: 'backend',
      tag: 'API',
      name: 'A',
    });
    overlap.label('LABEL', 120, 110);
    expect(() => overlap.svg({ title: 't', desc: 'd' })).toThrow('overlaps');
    expect(() =>
      diagram().node({
        x: 360,
        y: 0,
        w: 120,
        kind: 'backend',
        tag: 'A',
        name: 'A',
      }),
    ).toThrow('viewBox');
    expect(() =>
      diagram().node({
        x: 0,
        y: 0,
        w: 80,
        kind: 'backend',
        tag: 'A',
        name: 'A name far too long for this box',
      }),
    ).toThrow('does not fit');
    const accents = diagram();
    accents.node({ x: 0, y: 0, w: 80, kind: 'focal', tag: 'A', name: 'A' });
    accents.node({ x: 100, y: 0, w: 80, kind: 'focal', tag: 'B', name: 'B' });
    expect(() =>
      accents.node({ x: 200, y: 0, w: 80, kind: 'focal', tag: 'C', name: 'C' }),
    ).toThrow('accent');
  });

  it('renders every diagram deterministically within its rules', () => {
    const first = renderDiagrams();
    expect(Object.keys(first)).toContain('docs/diagrams/architecture.html');
    expect(renderDiagrams()).toEqual(first);
  });
});
