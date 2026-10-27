import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root.js';
import { SessionGate } from './session.js';
import { LOCAL_SESSION } from './session-context.js';
import './styles.css';

const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Application root not found.');

// The API confirms local or hosted access before any workspace renders.
let content = (
  <SessionGate>
    <Root />
  </SessionGate>
);
if (import.meta.env.DEV) {
  const fixtureName = new URLSearchParams(window.location.search).get(
    'fixture',
  );
  if (fixtureName !== null) {
    const { createDevelopmentFixture, developmentFixtureNames } =
      await import('./development-fixtures.js');
    if (
      developmentFixtureNames.includes(
        fixtureName as (typeof developmentFixtureNames)[number],
      )
    ) {
      const fixture = createDevelopmentFixture(
        fixtureName as (typeof developmentFixtureNames)[number],
      );
      content = (
        <SessionGate initial={LOCAL_SESSION}>
          <p className="development-fixture-notice" role="status">
            {fixture.label}
          </p>
          <Root
            intakeClient={fixture.intakeClient}
            runClient={fixture.runClient}
            idempotencyKeyFactory={() => `fixture-${fixtureName}`}
          />
        </SessionGate>
      );
    }
  }
}

createRoot(root).render(<StrictMode>{content}</StrictMode>);
