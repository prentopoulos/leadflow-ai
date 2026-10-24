---
name: showcase
description: How to make a project's public showcase - the slide deck, the walkthrough video, the README, the architecture diagrams and other write-ups for recruiters or contacts - in the owner's style. Use when a phase produces a deck, video, README, methodology, architecture diagram or other public-facing document, or when the owner asks for slides, a recording, diagrams or a portfolio page.
---

# Showcase: deck, video and README

These are the owner's preferences, learned while building the Compute Cost & Risk Monitor demo
(October 2026). They apply to anything someone outside the project will read or watch.
Dashboards and app screens keep their own terse style; this style is for decks, documents and
videos.

## Writing style

- **Explain to a newcomer first.** Cover what it is, who uses it, why it matters and how it
  works. Assume the reader knows nothing about the project.
- **Write lines a person would say out loud** when presenting the project in an interview. Use
  short sentences and everyday words: "data transfer", not "egress"; "the same kind of
  machine", not "like with like".
- **No slogans or reassurance taglines** in headlines, captions or cards. The owner rejected
  both "Code computes every number. AI writes only words." and "…, with every figure checked by
  code" as cringe and unprofessional. Name the feature plainly ("AI-powered market brief"), and
  leave safeguards to the body text.
- **No meta captions** that explain the slide's own visuals ("Words by Claude. Blue numbers
  filled in by code."). **No internal process notes** ("If the AI breaks a rule, its text is
  thrown away…").
- **Keep the labels the project's rules require**, such as "synthetic data", "not a forecast"
  and cost exclusions, short and in plain words. They are rules, not taglines.
- **Before showing a draft, reread every line, small print included.** Remove anything the
  owner would call internal, defensive or AI-sounding. Don't leave them to find these one by
  one.

## Deck (Figma Slides)

- Build it with `use_figma` and the figma-use-slides skill. Draft it, run the batch validation,
  screenshot it, show the owner, then fix it line by line.
- **A six-slide story that worked:**
  1. what it is, and who uses it;
  2. why it matters (the market or business context);
  3. how it works (steps and one worked example);
  4. what you see (an annotated screenshot);
  5. how it uses AI, if it does;
  6. limits and next steps.
- When a line wraps awkwardly, shorten the words before touching the font. The owner asked for
  one-line notes to stay on one line.
- **PDF without the owner:**
  - export each slide with `download_assets` (`defaultFormat: "pdf"`);
  - fetch each URL at once, since they expire;
  - merge in order with pypdf (`uv run --no-project --with pypdf python -I merge.py`);
  - check the page count and look at one page.

  After any edit, re-export only the changed slide.

## Walkthrough video

The owner may be away, and Claude can record it. See
[references/walkthrough-recording.md](references/walkthrough-recording.md) and the worked example
[references/record-walkthrough.example.mjs](references/record-walkthrough.example.mjs).

- **About two minutes**, with on-screen captions instead of a voice, using demo or synthetic
  data only.
- **Write the timed script first** (`docs/walkthrough.md`). The captions are its lines. Measure
  the real times from the finished video afterwards.
- **Run a preview pass** of one still per step, and check that every highlight lands, before
  recording.
- **Send the MP4 to the owner** (SendUserFile) before committing it anywhere. Where it is
  published is the owner's call. Once the owner says a take is fine, stop re-recording.

## README

- Use [the README and diagram method](references/readme.md). Its structural reference is
  [caliber-ai-org/ai-setup](https://github.com/caliber-ai-org/ai-setup): a centered identity, a
  concrete one-line promise, a wide product-principles visual, setup immediately after the opening,
  short capability sections, and a compact commands table. Reuse that information hierarchy, not its
  copy or artwork.
- The first screen must answer what the project does, what evidence or inputs it uses, and how to
  start. Move operator detail, edge cases and implementation notes into linked documents.
- Keep README brand assets under `docs/readme/` and technical diagrams under `docs/diagrams/`.
  A principles strip or wordmark is not an architecture diagram.
- **Test the figures.** Put computed figures between hidden markers
  (`<!-- bottom-line:start -->`), and test every number there against its source facts. Add a
  test that a drifted figure gets caught.
- **Test the links and licences.** Every local link must resolve to a tracked file, and the
  licence and third-party credits must be named.

## Architecture and workflow diagrams

**Default tool: the installed `diagram-design` skill.** Use its selection table before drawing,
load the chosen type reference, and apply the project's existing design tokens. C4 remains useful
semantic vocabulary for people, software systems, containers and components, but it does not force a
Structurizr or Mermaid rendering style.

Choose the view that answers the reader's question:

- **Architecture** for components, trust boundaries and external services in one snapshot.
- **Data flow** for evidence, transformations, ownership and handoffs across a pipeline.
- **Exploded axonometric** for the dependency order of three to five parts that form one product.
- **Agent workflow map** for several bounded graphs that share stages, snapshots, models and verification
  gates. Use one lane per graph and name the model or API mode where it actually runs.
- **Venn plus security matrix** when a capability-overlap rule needs both an intuitive picture and
  an exact per-mode account. Keep all labels inside their circle, intersection marker, or matrix cell.
- **DP security matrix** for per-mode or per-role access permissions.
- **Sequence** only when message order and timing are the main point.

Author each publishable diagram as self-contained HTML with inline SVG. Keep the HTML in Git, export an
SVG for README and documentation use, and export PNG only when a slide or target renderer needs it.
Run the skill's self-check before review. Use Figma or FigJam for slides and visual mock-ups unless the
owner explicitly asks for an architecture diagram there.

For public portfolio documentation, expose enough structure to prove engineering judgment without
publishing commercial implementation details. Show component boundaries, evidence ownership, model
choices, sequence and enforced gates. Keep exact prompts, scoring formulas, provider normalization and
policy implementation in private documentation when the product requires that boundary.

The older C4 starter and notation notes remain in
[references/c4-diagrams.md](references/c4-diagrams.md) for projects that already use Structurizr.

- **Title** each diagram with its purpose and scope in plain words.
- **Keep one dominant story.** The overview budget is nine nodes and twelve connections; split a dense
  system into overview and detail views.
- **Every element** has a distinct job. Merge nodes that always travel together.
- **Every visible line** carries information. Use orthogonal routes, separate fan-out points, and short
  verb or protocol labels only where the relationship is not obvious from layout.
- **Use one accent** for one or two focal elements. Keep the rest in ink, muted and surface roles from
  the project's palette.
- **Use a key only when encoding cannot be understood from labels.** Do not add a decorative legend.
- **Measure spacing.** Use a four-pixel grid, equal margins, and enough room for labels at their final
  export size.
- **Check the export itself.** No clipped text, shared connector strokes, orphan labels, or type that
  depends on a remote font to remain readable.
- **Review the GitHub render.** Push the branch, open the actual README and raw SVGs, and inspect them
  at repository width. Source-file geometry checks do not prove that GitHub renders the labels well.

## Before anything goes public

The full method, including how to prove the secret scanner works, is in
[references/pre-publication.md](references/pre-publication.md).

Making the repository public is the owner's gate. Before or right after it:
- scan every blob in the history for secrets, and prove the scanner works with a planted test
  key;
- survey the history for data that must not be published;
- remove personal paths from the current files.

Record all three in the phase's review record.
