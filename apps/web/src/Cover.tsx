import { ArrowRight } from 'lucide-react';
import type { CSSProperties } from 'react';
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
  { href: '#intake', label: 'Intake', primary: true },
  { href: '#runs', label: 'Runs', primary: false },
  { href: '#metrics', label: 'Metrics', primary: false },
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
            Scores and researches auto insurance leads, then drafts follow-ups
            for your team to approve.
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
            {/* Each step lights in turn, like a lead moving through. */}
            {pipeline.map((step, index) => (
              <li key={step} style={{ '--step': index } as CSSProperties}>
                <span className="step-dot" aria-hidden="true" />
                <span className="step-label">{step}</span>
                {index < pipeline.length - 1 ? (
                  <span className="step-rail" aria-hidden="true">
                    <span />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
