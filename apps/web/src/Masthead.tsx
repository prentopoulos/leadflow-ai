import { useSession } from './session-context.js';

export type AppView = 'intake' | 'runs' | 'metrics';

export function SimulationStrip() {
  const session = useSession();
  const hosted = session.mode === 'cloud';
  return (
    <div className="simulation-strip" role="note">
      <span className="simulation-mark" aria-hidden="true" />
      <strong>SIMULATION</strong>
      <span aria-hidden="true">·</span>
      <span>Synthetic leads and outcomes</span>
      <span className="simulation-scope">
        {hosted
          ? 'Private hosted demo · signed in · recorded lookups only'
          : 'This machine · public lookups read-only'}
      </span>
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
