---
name: frontend-product
description: Build or substantially redesign a production product interface when art direction, information hierarchy, real-data states, interaction polish, and rendered visual review must stay coherent. Use for application screens, dashboards, and complete product workflows; use the design-skills router for the supporting tools.
---

# Frontend product

Use this as the coordinating method for substantial product UI work. Read the project's
constitution, audience, existing interface, design tokens, and
[the design-skills router](../next-phase/design-skills.md) first. Preserve an explicit visual
direction the owner has already accepted.

The supporting skills have distinct jobs. Using all relevant frontend skills means assigning
each one a useful role; it does not mean pasting output from every tool into the application.

## Build in this order

1. **Choose a visual thesis.** Follow [the art-direction decision](references/art-direction-decision.md).
   Derive the look from the product, audience, content, existing brand, and references. Compare a few
   meaningfully different directions internally, select the strongest, and record one sentence,
   three to five observable principles, and a small token set. Reuse principles from references
   rather than copying their layout, fonts, colors, or components.
2. **Describe the primary workspace.** Name the user's main action, the decision the screen
   supports, the order information is read, and the evidence that must remain visible. Resolve
   this composition before polishing individual components.
3. **Design with real content.** Use representative shapes and actual data contracts. Cover
   loading, empty, error, partial, complete, and long-content states. If the project forbids
   simulated data, obtain a real run or label a fixture clearly; never present invented facts
   as product output.
4. **Build one complete vertical slice.** Establish tokens and the page skeleton, then make the
   primary action reach one real result. Add responsive behavior, semantic structure, keyboard
   access, focus handling, and reduced-motion behavior in the same slice.
5. **Polish connected interactions.** Check scroll-linked navigation, focus return, overlays,
   expandable workspaces, chat auto-scroll, async completion, downloads, and exports. UI state
   must follow the underlying task state rather than elapsed-time guesses.
6. **Review the running product.** Inspect the actual implementation at target viewport sizes,
   including the page top, middle, bottom, long content, loading/error states, and every expanded
   or modal state. Inspect generated artifacts such as PDFs separately. Fix hierarchy, wrapping,
   clipping, collisions, false affordances, and density in the rendered output.
7. **Verify.** Run the project's type, lint, build, accessibility, and focused behavior checks.
   Report what changed, what was rendered and inspected, and any remaining limits.

## Quality bar

- Let the product's content and task shape the composition. Avoid a wall of interchangeable
  cards, generic hero copy, ornamental gradients, glass effects, excessive pills, and decoration
  that competes with the work.
- Give each typeface, surface level, color, and motion pattern a named role. One restrained accent
  is usually enough for selection, progress, or action.
- Put the strongest hierarchy at the user's decision point. Keep supporting evidence close to
  the claim it supports and reveal secondary detail progressively.
- Match density to the task. Research and operations screens may be compact; public pages may
  breathe more. Do not force one project's style onto another.
- Keep implementation language out of the interface unless the operator needs it to act.

Read [the Ledger case study](references/ledger-case-study.md) when building a data-dense research
or operations workspace, or when the owner asks to repeat the frontend process learned on Ledger.
Reuse its sequence and review method, not its specific serif, blue accent, or three-column layout.
