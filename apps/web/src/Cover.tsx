import { ArrowRight } from 'lucide-react';
import { SimulationStrip } from './Masthead.js';

const boundaries = [
  'Fictional leads and test contacts only',
  'Public vehicle and ZIP lookups, read-only',
  'No quotes or insurance decisions',
  'Drafts need consent and a person’s approval; nothing is sent',
] as const;

const entries = [
  { href: '#intake', label: 'Start an intake', primary: true },
  { href: '#runs', label: 'Review runs and approvals', primary: false },
  { href: '#metrics', label: 'Open the metrics', primary: false },
] as const;

// The home screen: the project's original Phase 0 cover, with copy that
// describes what the workspace behind it does today.
export function Cover() {
  return (
    <div className="cover-page">
      <SimulationStrip />
      <main className="cover-shell" id="main-content">
        <header className="cover-hero" aria-labelledby="cover-title">
          <p className="cover-eyebrow">
            Marketing lead workflow · local prototype
          </p>
          <h1 id="cover-title">LeadFlow AI</h1>
          <p className="cover-lede">
            Scores and enriches fictional insurance leads. Nothing is ever sent.
          </p>
        </header>

        <nav className="cover-entries" aria-label="Open the workspace">
          {entries.map(({ href, label, primary }) => (
            <a
              key={href}
              href={href}
              className={primary ? 'cover-entry is-primary' : 'cover-entry'}
            >
              {label}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          ))}
        </nav>

        <section
          className="cover-boundaries"
          aria-labelledby="cover-boundary-title"
        >
          <h2 id="cover-boundary-title">Boundaries</h2>
          <ul>
            {boundaries.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
