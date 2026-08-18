'use client';

import { useState } from 'react';

export type ObjectType = 'tee' | 'hoodie' | 'hat';

type ObjectSelectionProps = {
  onSelect: (object: ObjectType) => Promise<void> | void;
};

const OBJECTS: Array<{ value: ObjectType; label: string; index: string }> = [
  { value: 'tee', label: 'TEE', index: '01' },
  { value: 'hoodie', label: 'HOODIE', index: '02' },
  { value: 'hat', label: 'HAT', index: '03' },
];

export function ObjectSelection({ onSelect }: ObjectSelectionProps) {
  const [selected, setSelected] = useState<ObjectType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function lockForm() {
    if (!selected || submitting) return;

    setSubmitting(true);
    try {
      await onSelect(selected);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="object-selection" aria-labelledby="object-selection-heading">
      <p className="object-selection__signal">FORM / UNLOCKED</p>
      <h1 id="object-selection-heading">Choose what it exists on.</h1>

      <fieldset className="object-selection__options">
        <legend className="sr-only">Physical form</legend>
        {OBJECTS.map((object) => (
          <label key={object.value} className="object-selection__option">
            <input
              type="radio"
              name="object"
              value={object.value}
              checked={selected === object.value}
              onChange={() => setSelected(object.value)}
            />
            <span className="object-selection__index" aria-hidden="true">
              {object.index}
            </span>
            <span>{object.label}</span>
          </label>
        ))}
      </fieldset>

      <button type="button" onClick={lockForm} disabled={!selected || submitting}>
        {submitting ? '...' : 'LOCK FORM'}
      </button>
    </section>
  );
}
