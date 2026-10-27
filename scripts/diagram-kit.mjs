// Minimal diagram-design primitives for LeadFlow AI. Product tokens from
// apps/web/src/styles.css are mapped to the skill's semantic roles; the
// vendored skill's default style guide stays untouched. Every drawing call is
// checked against the skill's connector, label, fit, and budget rules so a
// layout regression fails generation instead of shipping.

export const tokens = Object.freeze({
  paper: '#f4f1e9',
  paper2: '#e9e6de',
  ink: '#1a211f',
  muted: '#626a66',
  soft: '#56605b',
  // --accent-dark: the lighter --accent (#087f73) is 4.33:1 on paper, below the
  // skill's 4.5:1 text floor.
  accent: '#075e57',
  link: '#3a5a85',
  white: '#ffffff',
});

export const fonts = Object.freeze({
  title: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  sans: "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', ui-monospace, monospace",
});

const SANS_EM = 0.6;
const MONO_EM = 0.62;
const RADIUS = 8;

export function rgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${alpha})`;
}

export function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const [high, low] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((left, right) => right - left);
  return (high + 0.05) / (low + 0.05);
}

const snap = (value) => Math.ceil(value / 4) * 4;
const escapeXml = (text) =>
  text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const textWidth = (text, size, em) => text.length * size * em;

const treatments = {
  focal: { fill: rgba(tokens.accent, 0.08), stroke: tokens.accent },
  backend: { fill: tokens.white, stroke: tokens.ink },
  store: { fill: rgba(tokens.ink, 0.05), stroke: tokens.muted },
  external: { fill: rgba(tokens.ink, 0.03), stroke: rgba(tokens.ink, 0.3) },
  input: { fill: rgba(tokens.muted, 0.1), stroke: tokens.soft },
  optional: {
    fill: rgba(tokens.ink, 0.02),
    stroke: rgba(tokens.ink, 0.45),
    dash: '4,3',
  },
};

const arrowColors = {
  muted: tokens.muted,
  accent: tokens.accent,
  link: tokens.link,
};

const intersects = (left, right) =>
  left.x < right.x + right.w &&
  right.x < left.x + left.w &&
  left.y < right.y + right.h &&
  right.y < left.y + left.h;

export class Diagram {
  constructor({ slug, width, height, maxNodes = 9, maxArrows = 12 }) {
    this.slug = slug;
    this.width = width;
    this.height = height;
    this.maxNodes = maxNodes;
    this.maxArrows = maxArrows;
    this.zones = [];
    this.arrows = [];
    this.labels = [];
    this.nodes = [];
    this.notes = [];
    this.nodeRects = [];
    this.labelRects = [];
    this.accentCount = 0;
    this.arrowCount = 0;
    this.nodeCount = 0;
    this.texts = [];
  }

  #assertInside(x, y, w = 0, h = 0, what = 'element') {
    if (x < 0 || y < 0 || x + w > this.width || y + h > this.height) {
      throw new Error(`${this.slug}: ${what} leaves the viewBox`);
    }
  }

  #fit(text, size, em, room, what) {
    if (textWidth(text, size, em) > room) {
      throw new Error(`${this.slug}: "${text}" does not fit its ${what}`);
    }
    this.texts.push(text);
  }

  #accent() {
    this.accentCount += 1;
    if (this.accentCount > 2) {
      throw new Error(`${this.slug}: more than two accent elements`);
    }
  }

  zone({ x, y, w, h, label, dashed = false, labelX = x + 12 }) {
    this.#assertInside(x, y, w, h, 'zone');
    const maskWidth = snap(textWidth(label, 7, MONO_EM) + 16);
    this.texts.push(label);
    this.zones.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${rgba(tokens.ink, 0.02)}" stroke="${rgba(tokens.ink, dashed ? 0.3 : 0.12)}" stroke-width="0.8"${dashed ? ' stroke-dasharray="5,4"' : ''}/>`,
      `<rect x="${labelX}" y="${y + 4}" width="${maskWidth}" height="12" rx="2" fill="${tokens.paper}"/>`,
      `<text x="${labelX + maskWidth / 2}" y="${y + 13}" fill="${tokens.soft}" font-size="7" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.14em">${escapeXml(label)}</text>`,
    );
  }

  node({ x, y, w, h = 56, kind, tag, name, sub = [] }) {
    this.#assertInside(x, y, w, h, `node ${name}`);
    for (const value of [x, y, w, h]) {
      if (value % 4 !== 0)
        throw new Error(`${this.slug}: ${name} is off the 4px grid`);
    }
    if (kind === 'focal') this.#accent();
    this.nodeCount += 1;
    if (this.nodeCount > this.maxNodes) {
      throw new Error(`${this.slug}: node budget exceeded`);
    }
    const treatment = treatments[kind];
    const lines = Array.isArray(sub) ? sub : [sub];
    const tagWidth = snap(textWidth(tag, 7, MONO_EM) + 10);
    this.#fit(name, 12, SANS_EM, w - 16, `box (${name})`);
    for (const line of lines) this.#fit(line, 9, MONO_EM, w - 16, 'box');
    this.texts.push(tag);
    const cx = x + w / 2;
    const nameY = y + 32;
    this.nodeRects.push({ x, y, w, h, name });
    this.nodes.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${tokens.paper}"/>`,
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${treatment.fill}" stroke="${treatment.stroke}" stroke-width="1"${treatment.dash ? ` stroke-dasharray="${treatment.dash}"` : ''}/>`,
      `<rect x="${x + 8}" y="${y + 6}" width="${tagWidth}" height="12" rx="2" fill="none" stroke="${treatment.stroke}" stroke-opacity="0.5" stroke-width="0.8"/>`,
      `<text x="${x + 8 + tagWidth / 2}" y="${y + 15}" fill="${tokens.soft}" font-size="7" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.08em">${escapeXml(tag)}</text>`,
      `<text x="${cx}" y="${nameY}" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">${escapeXml(name)}</text>`,
      ...lines.map(
        (line, index) =>
          `<text x="${cx}" y="${nameY + 15 + index * 13}" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}" text-anchor="middle">${escapeXml(line)}</text>`,
      ),
    );
    return { x, y, w, h, cx, cy: y + h / 2, right: x + w, bottom: y + h };
  }

  bubble({ cx, cy, r, kind, tag, name, sub }) {
    const x = cx - r;
    const y = cy - r;
    const size = r * 2;
    this.#assertInside(x, y, size, size, `bubble ${name}`);
    for (const value of [cx, cy, r]) {
      if (value % 4 !== 0)
        throw new Error(`${this.slug}: ${name} is off the 4px grid`);
    }
    if (kind === 'focal') this.#accent();
    this.nodeCount += 1;
    if (this.nodeCount > this.maxNodes) {
      throw new Error(`${this.slug}: node budget exceeded`);
    }
    const treatment = treatments[kind];
    this.#fit(name, 13, SANS_EM, size - 24, `bubble (${name})`);
    this.#fit(sub, 9, MONO_EM, size - 20, `bubble (${name})`);
    this.texts.push(tag);
    this.nodeRects.push({ x, y, w: size, h: size, name });
    this.nodes.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${tokens.paper}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${treatment.fill}" stroke="${treatment.stroke}" stroke-width="1.2"${treatment.dash ? ` stroke-dasharray="${treatment.dash}"` : ''}/>`,
      `<text x="${cx}" y="${cy - 20}" fill="${tokens.soft}" font-size="7" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.1em">${escapeXml(tag)}</text>`,
      `<text x="${cx}" y="${cy + 2}" fill="${tokens.ink}" font-size="13" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">${escapeXml(name)}</text>`,
      `<text x="${cx}" y="${cy + 22}" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}" text-anchor="middle">${escapeXml(sub)}</text>`,
    );
    return {
      x,
      y,
      w: size,
      h: size,
      cx,
      cy,
      right: x + size,
      bottom: y + size,
    };
  }

  /** Free-form box drawn by the caller (entities, actors); still budgeted. */
  box({ x, y, w, h, kind, markup, name }) {
    this.#assertInside(x, y, w, h, `box ${name}`);
    if (kind === 'focal') this.#accent();
    this.nodeCount += 1;
    if (this.nodeCount > this.maxNodes) {
      throw new Error(`${this.slug}: node budget exceeded`);
    }
    this.nodeRects.push({ x, y, w, h, name });
    const treatment = treatments[kind];
    this.nodes.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${tokens.paper}"/>`,
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${treatment.fill}" stroke="${treatment.stroke}" stroke-width="1"/>`,
      ...markup,
    );
  }

  text(value, { x, y, size, font, fill, weight, anchor = 'start', room }) {
    // Serif titles are budgeted at the wider sans advance, which overestimates safely.
    const em = font === 'mono' ? MONO_EM : SANS_EM;
    if (room !== undefined) this.#fit(value, size, em, room, 'text slot');
    else this.texts.push(value);
    return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight ?? 400}" font-family="${fonts[font]}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
  }

  /**
   * Orthogonal connector through the given points with r=8 quarter turns.
   * Diagonal segments are rejected (connector rule 1).
   */
  path(points, { role = 'muted', dashed = false, marker = true } = {}) {
    for (let index = 1; index < points.length; index += 1) {
      const [ax, ay] = points[index - 1];
      const [bx, by] = points[index];
      if (ax !== bx && ay !== by) {
        throw new Error(`${this.slug}: diagonal connector segment`);
      }
      this.#assertInside(Math.min(ax, bx), Math.min(ay, by), 0, 0, 'path');
    }
    if (role === 'accent') this.#accent();
    this.arrowCount += 1;
    if (this.arrowCount > this.maxArrows) {
      throw new Error(`${this.slug}: connector budget exceeded`);
    }
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let index = 1; index < points.length - 1; index += 1) {
      const [px, py] = points[index - 1];
      const [cx, cy] = points[index];
      const [nx, ny] = points[index + 1];
      const inX = Math.sign(cx - px);
      const inY = Math.sign(cy - py);
      const outX = Math.sign(nx - cx);
      const outY = Math.sign(ny - cy);
      d += ` L${cx - inX * RADIUS},${cy - inY * RADIUS} Q${cx},${cy} ${cx + outX * RADIUS},${cy + outY * RADIUS}`;
    }
    const [lx, ly] = points.at(-1);
    d += ` L${lx},${ly}`;
    const color = arrowColors[role];
    const markerId = role === 'muted' ? 'arrow' : `arrow-${role}`;
    this.arrows.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${dashed ? 1 : 1.2}"${dashed ? ' stroke-dasharray="4,3"' : ''}${marker ? ` marker-end="url(#${markerId})"` : ''}/>`,
    );
  }

  /** Masked connector label centred on (cx, cy); must not touch any box. */
  label(text, cx, cy, { role = 'soft' } = {}) {
    if (text.length > 14 || text !== text.toUpperCase()) {
      throw new Error(
        `${this.slug}: label "${text}" breaks the 14-char caps rule`,
      );
    }
    const w = snap(textWidth(text, 8, MONO_EM) + 12);
    const rect = { x: cx - w / 2, y: cy - 6, w, h: 12 };
    this.labelRects.push({ ...rect, text });
    this.texts.push(text);
    const fill = role === 'accent' ? tokens.accent : tokens.soft;
    this.labels.push(
      `<rect x="${rect.x}" y="${rect.y}" width="${w}" height="12" rx="2" fill="${tokens.paper}"/>`,
      `<text x="${cx}" y="${cy + 3}" fill="${fill}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.06em">${escapeXml(text)}</text>`,
    );
  }

  /** Small cardinality or guard text placed beside a line, masked. */
  tag(text, x, y, { anchor = 'start' } = {}) {
    const w = snap(textWidth(text, 8, MONO_EM) + 6);
    const left = anchor === 'end' ? x - w + 3 : x - 3;
    const rect = { x: left, y: y - 9, w, h: 12 };
    this.labelRects.push({ ...rect, text });
    this.texts.push(text);
    this.labels.push(
      `<rect x="${rect.x}" y="${rect.y}" width="${w}" height="12" rx="2" fill="${tokens.paper}"/>`,
      `<text x="${x}" y="${y}" fill="${tokens.soft}" font-size="8" font-family="${fonts.mono}" text-anchor="${anchor}" letter-spacing="0.04em">${escapeXml(text)}</text>`,
    );
  }

  /** Raw markup painted after zones and before connectors (lifelines, frames). */
  under(markup) {
    this.zones.push(markup);
  }

  callout(lines, x, y) {
    for (const [index, line] of lines.entries()) {
      this.texts.push(line);
      this.notes.push(
        `<text x="${x}" y="${y + index * 18}" fill="${tokens.muted}" font-size="14" font-style="italic" font-family="${fonts.title}">${escapeXml(line)}</text>`,
      );
    }
  }

  svg({ title, desc }) {
    for (const label of this.labelRects) {
      for (const node of this.nodeRects) {
        if (intersects(label, node)) {
          throw new Error(
            `${this.slug}: label "${label.text}" overlaps ${node.name}`,
          );
        }
      }
      this.#assertInside(
        label.x,
        label.y,
        label.w,
        label.h,
        `label ${label.text}`,
      );
    }
    if (title.length > 60) throw new Error(`${this.slug}: title too long`);
    const markers = Object.entries(arrowColors)
      .map(
        ([role, color]) =>
          `<marker id="${role === 'muted' ? 'arrow' : `arrow-${role}`}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${color}"/></marker>`,
      )
      .join('\n      ');
    return [
      `<svg viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${this.slug}-title ${this.slug}-desc">`,
      `  <title id="${this.slug}-title">${escapeXml(title)}</title>`,
      `  <desc id="${this.slug}-desc">${escapeXml(desc)}</desc>`,
      `  <defs>\n      ${markers}\n  </defs>`,
      `  <rect width="100%" height="100%" fill="${tokens.paper}"/>`,
      ...[
        ...this.zones,
        ...this.arrows,
        ...this.labels,
        ...this.nodes,
        ...this.notes,
      ].map((line) => `  ${line}`),
      '</svg>',
    ].join('\n');
  }
}

export function page({ diagram, eyebrow, title, desc, intro }) {
  const svg = diagram.svg({ title, desc });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(title)}</title>
  <!-- Generated by scripts/generate-diagrams.mjs. Edit the generator, not this file. -->
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --color-paper: ${tokens.paper};
      --color-ink: ${tokens.ink};
      --color-muted: ${tokens.muted};
      --color-accent: ${tokens.accent};
      --font-sans: ${fonts.sans};
      --font-serif: ${fonts.title};
      --font-mono: ${fonts.mono};
    }
    body {
      font-family: var(--font-sans);
      background: var(--color-paper);
      color: var(--color-ink);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
    }
    .frame { max-width: 1200px; width: 100%; }
    .diagram-container { width: 100%; overflow-x: auto; }
    .eyebrow {
      font-family: var(--font-mono);
      font-size: 0.66rem;
      font-weight: 500;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--color-muted);
      margin-bottom: 0.5rem;
    }
    h1 {
      font-family: var(--font-serif);
      font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 0.5rem;
    }
    .intro { color: var(--color-muted); max-width: 60ch; margin-bottom: 1.5rem; line-height: 1.5; }
    svg { width: 100%; min-width: ${diagram.width}px; display: block; }
    @media print {
      .diagram-container { overflow-x: visible; }
      svg { min-width: 0; }
    }
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">${escapeXml(eyebrow)}</p>
    <h1>${escapeXml(title)}</h1>
    <p class="intro">${escapeXml(intro)}</p>
    <div class="diagram-container">
${svg}
    </div>
  </div>
</body>
</html>
`;
}
