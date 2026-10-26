export type AppView = 'intake' | 'runs' | 'metrics';

export function SimulationStrip() {
  return (
    <div className="simulation-strip" role="note">
      <span className="simulation-mark" aria-hidden="true" />
      <strong>SIMULATION</strong>
      <span aria-hidden="true">·</span>
      <span>Synthetic leads and outcomes</span>
      <span className="simulation-scope">
        This machine · public lookups read-only
      </span>
    </div>
  );
}

export function Masthead({ view }: { view: AppView }) {
  const operations = view !== 'intake';
  return (
    <header className="masthead">
      <a className="brand" href="#intake" aria-label="LeadFlow AI intake">
        <span className="brand-mark" aria-hidden="true">
          LF
        </span>
        <span>
          <strong>LeadFlow AI</strong>
          <small>Operator workspace</small>
        </span>
      </a>
      <nav className="workspace-nav" aria-label="Workspace">
        <a href="#intake" aria-current={operations ? undefined : 'page'}>
          Intake
        </a>
        <a href="#runs" aria-current={operations ? 'page' : undefined}>
          Operations
        </a>
      </nav>
      <div className="phase-stamp">
        <span>Phase 2</span>
        <strong>Enrichment + review</strong>
      </div>
    </header>
  );
}
