'use client';

import { useState } from 'react';

export type ObjectType = 'tee' | 'hoodie' | 'hat' | 'tote';

type ObjectSelectionProps = {
  onSelect: (object: ObjectType) => Promise<void> | void;
};

const CURRENT_ISSUE_OBJECTS: Array<{ value: ObjectType; label: string; index: string }> = [
  { value: 'tee', label: 'TEE', index: '01' },
  { value: 'hat', label: 'CAP', index: '02' },
  { value: 'tote', label: 'TOTE', index: '03' },
];

export function ObjectSelection({ onSelect }: ObjectSelectionProps) {
  const [selected, setSelected] = useState<ObjectType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lockForm() {
    if (!selected || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSelect(selected);
    } catch (cause) {
      setError(cause instanceof Error && cause.message
        ? cause.message
        : 'That form could not be saved yet.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="object-selection" aria-labelledby="object-selection-heading">
      <p className="object-selection__signal">FORM / CURRENT ISSUE</p>
      <h1 id="object-selection-heading">Pick the shape your issue lives on.</h1>

      <fieldset className="object-selection__options">
        <legend className="sr-only">Shape</legend>
        {CURRENT_ISSUE_OBJECTS.map((object) => (
          <label key={object.value} className="object-selection__option">
            <input
              type="radio"
              name="object"
              value={object.value}
              checked={selected === object.value}
              onChange={() => {
                setSelected(object.value);
                setError(null);
              }}
            />
            <span className="object-selection__index" aria-hidden="true">
              {object.index}
            </span>
            <span>{object.label}</span>
          </label>
        ))}
      </fieldset>

      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={lockForm} disabled={!selected || submitting}>
        {submitting ? '...' : 'LOCK FORM'}
      </button>
    </section>
  );
}