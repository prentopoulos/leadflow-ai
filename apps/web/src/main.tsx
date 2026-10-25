import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Application root not found.');

let content = <App />;
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
        <>
          <p className="development-fixture-notice" role="status">
            {fixture.label}
          </p>
          <App
            intakeClient={fixture.intakeClient}
            runClient={fixture.runClient}
            idempotencyKeyFactory={() => `fixture-${fixtureName}`}
          />
        </>
      );
    }
  }
}

createRoot(root).render(<StrictMode>{content}</StrictMode>);
