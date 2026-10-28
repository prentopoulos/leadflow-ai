import {
  EXAMPLE_MILITARY_ANSWERS,
  MILITARY_AUTO_CARRIERS,
} from '@leadflow-ai/domain';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import {
  CHOICE_OPTIONS,
  MILITARY_QUESTIONS,
  type ChoiceKey,
} from './military-flow.js';

export function ChoiceQuestion({ field }: { field: ChoiceKey }) {
  const example = EXAMPLE_MILITARY_ANSWERS[field];
  return (
    <fieldset className="flow-question">
      <legend>{MILITARY_QUESTIONS[field]}</legend>
      <div className="choice-pills">
        {CHOICE_OPTIONS[field].map(([value, label]) => (
          <label key={value} className="choice-pill">
            <input
              type="radio"
              name={`military.${field}`}
              value={value}
              defaultChecked={example === value}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CarrierQuestion() {
  return (
    <div className="flow-question">
      <label htmlFor="currentCarrier">
        {MILITARY_QUESTIONS.currentCarrier}
      </label>
      <select
        id="currentCarrier"
        name="military.currentCarrier"
        defaultValue={EXAMPLE_MILITARY_ANSWERS.currentCarrier ?? ''}
      >
        <option value="">Select an insurer</option>
        {MILITARY_AUTO_CARRIERS.map((carrier) => (
          <option key={carrier} value={carrier}>
            {carrier}
          </option>
        ))}
      </select>
    </div>
  );
}

// The live flow takes up to five vehicles; the first uses the intake's own
// year, make and model fields.
export function AdditionalVehicles() {
  const [rows, setRows] = useState<number[]>([]);
  const [next, setNext] = useState(0);
  return (
    <div className="additional-vehicles">
      {rows.map((row, index) => (
        <div key={row} className="field-grid vehicle-grid extra-vehicle">
          <div className="field">
            <label htmlFor={`extraVehicle-${row}-year`}>
              Vehicle {index + 2} year
            </label>
            <input
              id={`extraVehicle-${row}-year`}
              name={`extraVehicle.${row}.year`}
              type="number"
              min="1981"
              max="2027"
              inputMode="numeric"
            />
          </div>
          <div className="field">
            <label htmlFor={`extraVehicle-${row}-make`}>
              Vehicle {index + 2} make
            </label>
            <input
              id={`extraVehicle-${row}-make`}
              name={`extraVehicle.${row}.make`}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor={`extraVehicle-${row}-model`}>
              Vehicle {index + 2} model
            </label>
            <input
              id={`extraVehicle-${row}-model`}
              name={`extraVehicle.${row}.model`}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="icon-action"
            aria-label={`Remove vehicle ${index + 2}`}
            onClick={() => setRows(rows.filter((item) => item !== row))}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
      {rows.length < 4 ? (
        <button
          type="button"
          className="secondary-action add-vehicle"
          onClick={() => {
            setRows([...rows, next]);
            setNext(next + 1);
          }}
        >
          <Plus size={16} aria-hidden="true" /> Add another vehicle
        </button>
      ) : null}
    </div>
  );
}
