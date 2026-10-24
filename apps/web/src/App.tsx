import { useState } from 'react';

const boundaries = [
  'No real personal information',
  'No live model or enrichment calls',
  'No quotes or insurance decisions',
  'No automatic outreach',
] as const;

export function App() {
  const [expanded, setExpanded] = useState(false);

  return (
    <main className="page-shell">
      <header className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Phase 0 · Local synthetic foundation</p>
        <h1 id="page-title">LeadFlow AI</h1>
        <p className="lede">
          A secure starting point for a human-reviewed marketing lead workflow.
          Runtime agents, external evidence, and operational metrics are not
          active in this phase.
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" className="status-dot" />
          Local application shell ready for deterministic checks
        </div>
      </header>

      <section className="boundary-card" aria-labelledby="boundary-title">
        <div>
          <p className="section-kicker">Current boundary</p>
          <h2 id="boundary-title">Foundation, not live operations</h2>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide boundaries' : 'Review boundaries'}
        </button>
        {expanded ? (
          <ul>
            {boundaries.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <footer>
        Evidence shown here is local and synthetic. No Military.com
        intake-parity claim is made.
      </footer>
    </main>
  );
}
