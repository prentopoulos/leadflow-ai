# README and diagram method

Use this guide for a public project README and the small diagram set that supports it. The structural
reference is [caliber-ai-org/ai-setup](https://github.com/caliber-ai-org/ai-setup). Study its economy
and order; do not copy its words, branding or artwork.

## README shape

The opening should work as a one-screen product brief:

1. Centered project mark or restrained wordmark.
2. One concrete sentence stating what the product does and what comes out.
3. Three or four factual badges only when they help with compatibility, data or model ownership.
4. One wide principles graphic when three ideas define the product. Treat it as a brand asset, not a
   technical diagram.
5. `## Start` immediately after the opening, with the shortest complete setup path.

After Start, use only the sections needed to understand and run the product. Good defaults are the
primary workflow, user modes, architecture, security or limits, observability, and a compact commands
table. For a recruiter-facing AI product, lead Architecture with the most legible product-level view
such as the exploded system, then show the runtime boundary and agent sequence. Link to full documents
for operating detail, supported edge cases and methodology. Avoid a table of contents, long feature
inventory, repeated architecture prose and setup alternatives that delay the first successful run.

Write the promise from evidence. Name live versus simulated data, whether a model is optional, and
who supplies paid API credentials when those facts affect use. Do not turn safety boundaries into a
slogan. Keep the disclaimer short and place it last.

## Asset boundary

- Put README identity and principles graphics in `docs/readme/`.
- Put explanatory system diagrams in `docs/diagrams/`.
- Keep diagram source and export together: self-contained HTML with inline SVG, plus the exported SVG
  used by GitHub.
- Keep a deterministic generator when several diagrams share tokens or must be regenerated together.
- Use the product's colors and type roles. Avoid gradients, shadows, glow, decorative network lines,
  and a default row of identical feature cards.

## Diagram suite

Choose only diagrams that answer different questions. For an agentic AI application, this five-view
set is useful when all five stories exist:

| View | Reader question | Layout rule |
|---|---|---|
| System architecture | What runs where, and which services are outside the boundary? | Components, trust zones and labelled external calls |
| Research or data flow | How does input become a verified output, and who owns each transformation? | Left-to-right or lane flow with deterministic and model steps distinguished |
| Exploded axonometric | Which layers form the product, and what supports what? | Three to five separated parts, one explode axis, no arrows, one label column |
| Agent workflow map | Which agents run, which model does each use, and where is output verified? | One lane per bounded workflow, shared stage columns, named model nodes and explicit deterministic gates |
| Access Venn + matrix | Which capabilities may overlap in each mode? | Three sets for intuition; adjacent matrix for exact enforcement |

Do not force five diagrams into a simple project. Use the smallest set that explains the system.

For an agent workflow map, show the actual orchestration rather than implying a more autonomous
multi-agent system. Give each graph one lane and one job. Align intake, grounding, reasoning,
verification and delivery into shared columns when the flows are comparable. Name the selected model
and API mode inside the relevant step, show immutable snapshot handoffs explicitly, and keep prompts,
formulas and enforcement implementation out of a public recruiter diagram.

For an access-triangle rule, label the three capability sets in their clear interior regions. Put the
prohibited three-way state in a contained center marker such as `3 / 3 BLOCKED`. Keep a matrix beside
the Venn when readers need to audit each runtime mode. Give every cell and callout visible inset from
its border; shorten the wording before reducing type. The visual must describe enforced code, not an
aspirational policy.

For an exploded system, use the `diagram-design` exploded-axonometric reference. The layers represent
parts of one assembled system rather than request arrows. A common AI ordering is evidence foundation,
deterministic analysis, bounded agent orchestration, and user workspace. Accent the single layer that
owns the critical invariant.

## Review loop

1. Audit the existing README, commands, docs and design tokens.
2. Write the one-line promise and decide what can move behind links.
3. Build brand assets separately from technical diagrams.
4. Load the chosen `diagram-design` type references, generate the HTML sources and export SVG.
5. Run the diagram self-check, XML parse check, Markdown link check and project checks.
6. Push the branch and inspect the rendered GitHub README and each raw SVG at actual repository width.
7. Fix clipped text, labels near edges, misleading overlap placement, broken images and excess vertical
   space before merging.

Source checks are necessary but do not replace the rendered review. GitHub's font and width choices
can expose spacing problems that are invisible in the source geometry.
