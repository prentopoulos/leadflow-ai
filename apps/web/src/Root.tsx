import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentProps,
} from 'react';
import { App } from './App.js';
import type { AppView } from './Masthead.js';
import type { OperationsWorkspace as Workspace } from './OperationsWorkspace.js';

// The operations views carry Recharts; load them only when opened.
const OperationsWorkspace = lazy(async () => ({
  default: (await import('./OperationsWorkspace.js')).OperationsWorkspace,
}));

function viewFromHash(hash: string): AppView {
  if (hash === '#runs') return 'runs';
  if (hash === '#metrics') return 'metrics';
  return 'intake';
}

export function Root(
  props: ComponentProps<typeof App> &
    Pick<ComponentProps<typeof Workspace>, 'operationsClient'>,
) {
  const [view, setView] = useState<AppView>(() =>
    viewFromHash(window.location.hash),
  );
  useEffect(() => {
    const update = () => setView(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const { operationsClient, ...appProps } = props;
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
