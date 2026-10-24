# Ledger frontend case study

This records why the first Ledger interface was accepted quickly and what later use revealed.
It is a worked example of the frontend-product method, not a universal visual template.

## Inputs that mattered

- The owner asked for a clean, non-generic product UI and explicitly asked to use the available
  frontend skills and Figma.
- Eva AI and Autobid supplied the visual references. Their screens were treated as evidence for
  restraint, hierarchy, editorial spacing, and product density rather than as layouts to copy.
- The product already had a strong information model: a ticker request produces a verdict,
  financials, valuation, risks, sources, traces, exports, and a grounded conversation.
- The data rule was strict: the interface could not use simulated company results.

## The sequence

### 1. Convert references into an art direction

The reference pass produced a concrete thesis: an editorial financial-research workspace with
paper-like surfaces, strong ink, a restrained blue accent, and dense evidence that still reads
calmly. The first token set paired an expressive display face with a neutral UI face, used borders
instead of decorative shadows, kept radii controlled, and reserved blue for state and navigation.

This prevented component-by-component styling. Every later choice could be checked against one
visual sentence.

### 2. Let information architecture determine the composition

The complete research task became one continuous workspace:

1. a compact masthead and ticker search;
2. a left report index for orientation;
3. a central memo with the verdict, key metrics, financials, valuation, risks, and conclusion;
4. a right rail for sources, trace visibility, and grounded chat.

The verdict was the dominant editorial statement. Metrics formed a fast scan beneath it. Evidence
stayed visible near the research instead of moving to a separate administration screen. This gave
the interface a recognizable shape before individual controls were styled.

### 3. Give each design tool one job

- **Figma** established composition, typography, density, and the relationship between the report
  and evidence rail before the implementation details accumulated.
- **design-taste-frontend** supplied the anti-generic art-direction checks where public-facing
  presentation was involved; its advice was not used to restyle the dashboard as a landing page.
- **impeccable** supported product-UI critique and polish.
- **ui-ux-pro-max** supplied targeted palette, typography, accessibility, and interaction lookups.
- **21st.dev** was an inspiration or sketch source when useful. Generated code was never allowed to
  replace the project's own stack, data contracts, or design system.
- **design-eval** provided a final review role rather than an alternative art direction.

The tools were coordinated around one thesis. Their outputs did not become competing styles.

### 4. Build the primary result with live states

The first complete slice made ticker search reach a real report, then presented its actual data and
provenance. Loading, unavailable, and failure states used the same hierarchy. The UI avoided fake
portfolio numbers and placeholder company claims, so its spacing and labels were tested against the
content users would really see.

### 5. Add progressive disclosure

The report remained readable on first paint. Trace detail was optional. The chat occupied a narrow
rail for reference and could expand into a focused workspace. Report and Explore were separated
because they had different evidence permissions. Export controls stayed compact, and slow memo prose
could finish in the background without blocking the deterministic report.

### 6. Refine from observed use

Later fixes came from running the product, not inspecting source alone:

- the blue report indicator had to follow the section currently visible while scrolling;
- chat answers needed reliable auto-scroll, safe Markdown, tables, bold text, and validated citation
  links while keeping the structured source rail;
- expanding chat needed focus return and a stable report layout underneath;
- the verdict needed its own layout constraints in the expanded state;
- the bottom Trace section had to become reachable by scrolling, not only by clicking its link;
- queued exports had to wait for the same final memo shown in the interface;
- PDF spacing and margins required review of the generated PDF, not the browser page;
- product-launch media needed to reuse or record the production UI because a reconstruction drifted
  from the real product.

These were system behaviors spanning layout, state, and data. Treating them as isolated CSS details
would have hidden the cause.

## Why the first screen worked

- The visual direction was settled before component polish.
- The owner's references and earlier preferences were treated as constraints with continuity.
- A small set of type, color, border, and spacing roles made the screen feel authored.
- Real research content supplied the hierarchy and gave every region a job.
- The full primary workflow was visible, so the result felt like a product rather than a collection
  of polished components.
- Secondary complexity appeared only when requested.
- The implementation was reviewed as a running interface and later corrected from actual use.

## Review matrix for a similar workspace

Inspect at least these combinations before calling the frontend complete:

| Area | States to inspect |
|---|---|
| Search | initial, typing, loading, unsupported identifier, provider failure |
| Report | short and long content, top/middle/bottom, partial and complete memo |
| Navigation | click-to-section, manual scroll, last section, browser resizing |
| Chat | empty, multi-turn, long answer, citations, table/list, error, auto-scroll |
| Expanded UI | open, focus movement, Escape/close, focus return, background layout |
| Evidence | source rail, unavailable source, trace collapsed/expanded |
| Export | memo pending, queued download, Markdown, PDF, long-page pagination |
| Responsive | target desktop, narrow desktop, mobile, keyboard-only, reduced motion |

The evidence for this review is the rendered product or artifact. Passing type checks and builds is
necessary, but it does not prove visual completion.
