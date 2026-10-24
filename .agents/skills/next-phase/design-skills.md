# Design skills

Read this when a phase builds or changes something people look at: an app screen, a dashboard,
a public page, a chart, or a technical diagram. For a substantial product interface, use the
[frontend-product skill](../frontend-product/SKILL.md) as the coordinating workflow. It keeps the
tools below on one art direction and carries the work through the running-product review.
`frontend-product` and `diagram-design` are copied into each project by this kit; the remaining
tools are installed once per PC when needed.

## Context first

Before choosing a skill, read the audience in PROJECT.md §1, the specs for the screens in
scope, the project's theme or design tokens, and any `.impeccable/` folder or DESIGN.md the
project has. Pin the look the owner asked for; reviewers critique its execution and do not
redirect it.

The constitution (PROJECT.md §5) outranks every design skill. A visual idiom must not make
the data claim more than it is.

- Marketing-readiness scores must never look like insurance eligibility, pricing, or risk scores.
- Demo fixtures and illustrative values stay visibly labeled; only stored runs may appear live.
- Consent, human approval, source evidence, partial failures, and unavailable states remain visible.
- Forms may claim Military.com parity only for questions verified from current evidence.
- Keyboard access, visible focus, reduced motion, and 390px mobile readability are required.

## Which skill

| Skill | Use it for | Limits |
|---|---|---|
| frontend-product (kit skill) | The end-to-end method for application screens and dashboards: references, art direction, information hierarchy, real states, implementation, interaction polish, rendered review | Coordinates the other skills; it does not impose Ledger's visual style on a different product |
| impeccable (`impeccable:impeccable`, plugin) | Shaping, critiquing, auditing and polishing product UI, dashboards included. It owns the critique method. | None beyond the constitution |
| ui-ux-pro-max (`ui-ux-pro-max:ui-ux-pro-max`, plugin) | Lookups: palettes, font pairings, chart types, UX and accessibility guidelines | If the project's stack is not one it lists, use its stack-neutral advice |
| dataviz (Claude Code built-in, when present) | Charts, stat tiles and palette validation, before writing chart code | None |
| tasteskill (`design-taste-frontend`, user skill) | Public-facing pages: landing, portfolio, product or demo pages | Not for dashboards or app screens; the skill says so itself |
| 21st.dev (`21st` MCP plugin, or the `21st-*` CLI skills) | Inspiration and React/Tailwind sketches | In another stack a sketch is a spec to rebuild, never pasted code. AI generation uses 21st credits; on a paid plan that is paid quota, so the spend ⛔ gate applies until the owner approves it. Prompts carry synthetic data only |
| design-eval (user skill, when installed) | A scored review (impeccable plus taste) before a UI PR is marked ready | For app screens, run it without the taste reviewer and say so |
| Figma skills (plugin) | Slides, mocks and FigJam boards | Load them before any Figma tool. Architecture diagrams default to code (showcase skill) |
| diagram-design (kit skill) | Architecture, data-flow, security-matrix and other publishable diagrams as self-contained HTML with SVG/PNG exports | Use the project's design tokens, load the selected type reference, respect the nine-node overview budget, and run its self-check |
| showcase (kit skill) | Diagram semantics, decks, walkthrough videos, READMEs, going public | The owner's wording rules: plain words, no taglines |

A skill recommendation does not justify adding its framework to the application. Changing the
UI stack is an owner decision recorded in PROJECT.md §4.

When the owner asks to use all frontend skills, route the work through all relevant roles in the
table. Do not force a tool call with no useful output, combine incompatible generated styles, or
replace production components with a sketch. Record the visual thesis and which role each selected
tool served so a later agent can continue the same direction. The visual thesis is a decision derived
from the current product; it is not inherited from Ledger or another previous project.

## Install on a new PC

- impeccable: `/plugin marketplace add pbakaus/impeccable`, then
  `/plugin install impeccable@impeccable`.
- ui-ux-pro-max: `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`, then
  `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`.
- tasteskill (MIT): copy `skills/taste-skill/` and the root `LICENSE` from
  [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) at a pinned commit to
  `~/.claude/skills/design-taste-frontend/`, and record the commit. Its scripts need Node 22+
  and Chrome or Edge, and fetch pictures from open collections.
- 21st.dev MCP (ISC): `/plugin marketplace add 21st-dev/magic-mcp`, then
  `/plugin install 21st@21st-dev`. It connects to `https://21st.dev/api/mcp` with the key in the
  `API_KEY_21ST` environment variable, from https://21st.dev/settings/api-keys. Set it in the
  user environment, never in a repo. The CLI skills come from
  `npx @21st-dev/cli install-skill`.
- diagram-design (MIT): vendored from
  [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design), version 2.6.
  Setup copies it to `.agents/skills/diagram-design/`; no separate machine install is required.
