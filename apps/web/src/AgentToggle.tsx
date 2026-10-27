import { AgentSettingsSchema, type AgentSettings } from '@leadflow-ai/domain';
import { useEffect, useState } from 'react';
import { Button } from './components/ui/button.js';
import { apiFetch } from './session-context.js';

type Fetcher = typeof fetch;

// Local only: turns the paid Claude research and drafting team on or off for
// the leads that follow. Off at start; without a key it explains how to add one.
export function AgentToggle({ fetcher = apiFetch }: { fetcher?: Fetcher }) {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(init?: RequestInit) {
    try {
      const response = await fetcher('/v1/agents', init);
      if (!response.ok) throw new Error(String(response.status));
      setSettings(AgentSettingsSchema.parse(await response.json()));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    if (settings === null) return;
    setBusy(true);
    await load({
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !settings.enabled }),
    });
    setBusy(false);
  }

  return (
    <section
      className="synthetic-panel agent-toggle"
      aria-labelledby="agent-toggle-title"
    >
      <h2 id="agent-toggle-title">AI research agents</h2>
      {settings === null ? (
        <p>{failed ? 'Agent settings are unavailable.' : 'Loading…'}</p>
      ) : settings.available ? (
        <>
          <p>
            When on, each consented lead's draft gets one paragraph researched
            on the web and written by Claude, with every source shown in the
            dossier. Adds about 30 s per lead. Capped at $
            {settings.leadCapUsd.toFixed(2)} per lead and $
            {settings.processCapUsd.toFixed(2)} per session.
          </p>
          <div className="draft-actions">
            <Button
              aria-pressed={settings.enabled}
              disabled={busy}
              onClick={() => void toggle()}
            >
              {settings.enabled ? 'Agents on · turn off' : 'Turn agents on'}
            </Button>
            <span role="status">
              Claude spend this session: ${settings.spentUsd.toFixed(4)}
            </span>
          </div>
        </>
      ) : (
        <p>
          Off: no API key. Add <code>ANTHROPIC_API_KEY</code> to a{' '}
          <code>.env</code> file in the repository root and restart{' '}
          <code>pnpm demo</code> to try them. Template drafts work without it.
        </p>
      )}
    </section>
  );
}
