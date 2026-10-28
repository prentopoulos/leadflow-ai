export type AppView = 'intake' | 'runs' | 'metrics' | 'pipeline' | 'enrichment';

// The one page-level label for fictional leads, spend and outcomes; values
// below it stay unmarked (owner, 2026-10-27).
export function SimulationStrip() {
  return (
    <div className="simulation-strip" role="note">
      <strong>SIMULATION</strong>
    </div>
  );
}

export function Masthead({ view }: { view: AppView }) {
  const operations = view !== 'intake';
  return (
    <header className="masthead">
      <a className="brand" href="#home" aria-label="LeadFlow AI home">
        <span className="brand-mark" aria-hidden="true">
          LF
        </span>
        <strong>LeadFlow AI</strong>
      </a>
      <nav className="workspace-nav" aria-label="Workspace">
        <a href="#intake" aria-current={operations ? undefined : 'page'}>
          Intake
        </a>
        <a href="#runs" aria-current={operations ? 'page' : undefined}>
          Operations
        </a>
      </nav>
    </header>
  );
}
