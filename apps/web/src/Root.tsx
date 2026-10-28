import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentProps,
} from 'react';
import { App } from './App.js';
import { Cover } from './Cover.js';
import type { AppView } from './Masthead.js';
import type { OperationsWorkspace as Workspace } from './OperationsWorkspace.js';

// The operations views carry Recharts; load them only when opened.
const OperationsWorkspace = lazy(async () => ({
  default: (await import('./OperationsWorkspace.js')).OperationsWorkspace,
}));

type RouteView = AppView | 'home';

// The cover is the home screen; each workspace view keeps its own hash.
function viewFromHash(hash: string): RouteView {
  if (hash === '#intake') return 'intake';
  if (hash === '#runs') return 'runs';
  if (hash === '#metrics') return 'metrics';
  if (hash === '#pipeline') return 'pipeline';
  if (hash === '#enrichment') return 'enrichment';
  return 'home';
}

export function Root(
  props: ComponentProps<typeof App> &
    Pick<ComponentProps<typeof Workspace>, 'operationsClient'>,
) {
  const [view, setView] = useState<RouteView>(() =>
    viewFromHash(window.location.hash),
  );
  useEffect(() => {
    const update = () => setView(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const { operationsClient, ...appProps } = props;
  if (view === 'home') return <Cover />;
  if (view === 'intake') return <App {...appProps} />;
  return (
    <Suspense
      fallback={
        <p className="operations-loading" role="status">
          Loading the operator workspace…
        </p>
      }
    >
      <OperationsWorkspace
        view={view}
        {...(operationsClient === undefined ? {} : { operationsClient })}
        {...(appProps.runClient === undefined
          ? {}
          : { runClient: appProps.runClient })}
      />
    </Suspense>
  );
}
