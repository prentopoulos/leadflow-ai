# Art-direction decision

Use this before designing a new product interface or materially changing its visual identity.
The goal is to choose a look that feels specific to the product without making the owner direct
every visual decision.

## 1. Read the product before choosing a style

Write down the evidence that should shape the interface:

- the user's main task and the decision they need to make;
- the audience's familiarity, environment, and expected level of trust;
- the content's density, pace, emotional weight, and need for comparison;
- the brand traits already accepted by the owner;
- named references and the exact qualities the owner likes in each;
- the existing product, design tokens, assets, and platform conventions;
- accessibility, responsiveness, data-integrity, and performance constraints.

Do not start from a fashionable component library aesthetic. Start from what the product must make
clear and how it should feel while doing that work.

## 2. Extract principles from references

For each reference, separate transferable principles from literal styling.

| Extract | Do not copy by default |
|---|---|
| hierarchy and reading order | its exact page layout |
| density and whitespace rhythm | its spacing values |
| type contrast and tone | its fonts |
| use of color and emphasis | its palette |
| surface and border treatment | its component shapes |
| motion character | its animation sequence |

Combine only principles that support the same product character. A reference is evidence, not a
template.

## 3. Form and test candidate directions

Privately form two or three meaningfully different directions. Describe each in one sentence and
map it across these axes:

- **character:** precise, calm, energetic, editorial, technical, tactile, institutional, playful;
- **composition:** continuous canvas, split workspace, focused column, dense grid, staged flow;
- **typography:** expressive or neutral display role, UI text role, numeric role;
- **color:** surface temperature, ink contrast, accent purpose, semantic colors;
- **shape:** border, radius, elevation, icon, and illustration language;
- **motion:** direct, quiet, elastic, cinematic, or nearly static;
- **density:** what stays visible and what appears progressively.

Score each direction against the product evidence:

1. Does the hierarchy make the primary task obvious?
2. Does the tone fit the trust and emotional requirements?
3. Can real content, including long and failed states, live in it?
4. Is it recognizably specific without relying on decoration?
5. Can the existing stack implement it consistently and accessibly?
6. Does it preserve the qualities the owner liked in the references?

Choose the strongest direction. Ask the owner only when the candidates imply materially different
product behavior or brand positioning. Otherwise make the design decision and show a complete,
reviewable result.

## 4. Commit the visual thesis

Before component polish, record:

```text
Visual thesis: <one sentence describing the product's intended visual character>
Evidence: <product, audience, content, and reference reasons>
Principles: <three to five observable rules>
Tokens: <type roles, ink, surfaces, accent, spacing, radius, border, motion>
Rejected direction: <the strongest alternative and why it fit less well>
```

The thesis should predict visible decisions. “Modern and clean” is too vague. A useful thesis names
the product character, its density, and how emphasis works.

## 5. Hold the direction through implementation

Give every supporting design skill the same thesis and constraints. Accept advice that sharpens the
chosen direction. Reject output that introduces a second visual language. Review the rendered product
against the principles, then change the thesis only when real use exposes a product-level mismatch.

The successful Ledger decision followed this method and selected an editorial financial-research
workspace. Another product may correctly select a warm collaborative canvas, a restrained operations
console, or a graphic consumer flow. The repeatable capability is choosing coherently, not repeating
Ledger's answer.
