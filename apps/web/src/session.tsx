import { LockKeyhole, RefreshCw, ShieldX } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SessionResponse } from '@leadflow-ai/domain';
import {
  SessionContext,
  loadSession,
  onAuthFailure,
  type SessionLoader,
  type SessionState,
} from './session-context.js';

function GatePanel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main id="main-content" className="page-shell session-gate">
      <section className="session-panel" aria-labelledby="session-title">
        <span className="session-icon" aria-hidden="true">
          {icon}
        </span>
        <h1 id="session-title" ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {children}
      </section>
    </main>
  );
}

// Renders nothing of the workspace until the API confirms the access mode.
// In hosted mode a later authentication denial unmounts the workspace, which
// stops its polling and actions rather than showing stale state as fresh.
export function SessionGate({
  children,
  initial,
  loader = loadSession,
}: {
  children: ReactNode;
  initial?: SessionResponse;
  loader?: SessionLoader;
}) {
  const [state, setState] = useState<SessionState>(
    initial === undefined
      ? { status: 'loading' }
      : { status: 'ready', session: initial },
  );
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await loader());
  }, [loader]);

  useEffect(() => {
    if (initial === undefined) void load();
  }, [initial, load]);
  useEffect(
    () =>
      onAuthFailure((failure) =>
        setState({ status: failure === 'expired' ? 'expired' : 'denied' }),
      ),
    [],
  );

  if (state.status === 'ready') {
    return (
      <SessionContext.Provider value={state.session}>
        {children}
      </SessionContext.Provider>
    );
  }
  if (state.status === 'loading') {
    return (
      <main id="main-content" className="page-shell session-gate">
        <p className="session-loading" role="status">
          Checking access…
        </p>
      </main>
    );
  }
  if (state.status === 'expired') {
    return (
      <GatePanel icon={<LockKeyhole size={28} />} title="Session expired">
        <p>
          Sign in again to continue. Nothing changed while the session was
          expired; stored runs resume from their saved state.
        </p>
        <button
          type="button"
          className="session-action"
          onClick={() => window.location.reload()}
        >
          Sign in again
        </button>
      </GatePanel>
    );
  }
  if (state.status === 'denied') {
    return (
      <GatePanel icon={<ShieldX size={28} />} title="Access denied">
        <p>
          This account is not allowed to use the private demo. Switch to the
          owner account and reload.
        </p>
      </GatePanel>
    );
  }
  return (
    <GatePanel icon={<RefreshCw size={28} />} title="Service unavailable">
      <p>The service did not confirm access. Nothing was submitted.</p>
      <button
        type="button"
        className="session-action"
        onClick={() => void load()}
      >
        Retry
      </button>
    </GatePanel>
  );
}
