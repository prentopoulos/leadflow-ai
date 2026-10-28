import { ArrowRight } from 'lucide-react';
import { SimulationStrip } from './Masthead.js';

// The agent pipeline in the order a lead moves through it (README "How it
// works" and "Agent pipeline").
const pipeline = [
  'Store',
  'Score',
  'Enrich',
  'Research',
  'Draft',
  'Check',
  'Approve',
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
          className="cover-pipeline"
          aria-labelledby="cover-pipeline-title"
        >
          <h2 id="cover-pipeline-title">Pipeline</h2>
          <ol>
            {pipeline.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
