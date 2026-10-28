import { AgentSettingsSchema, type AgentSettings } from '@leadflow-ai/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from './components/ui/button.js';
import { apiFetch } from './session-context.js';

type Fetcher = typeof fetch;

// Local only: turns the paid Claude research and drafting team on or off for
// the leads that follow. Off at start; without a key it explains how to add one.
export function AgentToggle({ fetcher = apiFetch }: { fetcher?: Fetcher }) {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const keyInput = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (showKeySetup) keyInput.current?.focus();
  }, [showKeySetup]);

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

  async function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSetupError(null);
    try {
      const response = await fetcher('/v1/agents/key', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSettings(AgentSettingsSchema.parse(await response.json()));
      setApiKey('');
      setShowKeySetup(false);
      setFailed(false);
    } catch {
      setSetupError(
        'We could not save that key. Check it and try again; nothing was enabled.',
      );
    } finally {
      setBusy(false);
    }
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
        <>
          <p>
            Add one source-backed paragraph to consented draft emails. Your
            Anthropic usage is billed directly and stays capped at $
            {settings.leadCapUsd.toFixed(2)} per lead and $
            {settings.processCapUsd.toFixed(2)} per session. Template drafts
            keep working without it.
          </p>
          {showKeySetup ? (
            <form className="agent-key-setup" onSubmit={saveKey}>
              <div>
                <label htmlFor="anthropic-api-key">Anthropic API key</label>
                <p id="anthropic-api-key-help">
                  Saved only to the gitignored <code>.env</code> on this
                  computer. The key is never shown again or stored in LeadFlow
                  records.
                </p>
              </div>
              <input
                ref={keyInput}
                id="anthropic-api-key"
                name="anthropic-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                minLength={20}
                maxLength={300}
                pattern="sk-ant-[A-Za-z0-9_-]+"
                aria-describedby="anthropic-api-key-help"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                disabled={busy}
                required
              />
              {setupError === null ? null : (
                <p className="agent-key-error" role="alert">
                  {setupError}
                </p>
              )}
              <div className="agent-key-actions">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save key and turn on'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setApiKey('');
                    setSetupError(null);
                    setShowKeySetup(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              onClick={() => {
                setSetupError(null);
                setShowKeySetup(true);
              }}
            >
              Turn on agent research
            </Button>
          )}
        </>
      )}
    </section>
  );
}
