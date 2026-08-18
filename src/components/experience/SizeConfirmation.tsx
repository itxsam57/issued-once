'use client';

import { useState } from 'react';
import type { ObjectType } from './ObjectSelection';

export type SizeOption = {
  code: string;
  label: string;
  measurements: string;
};

type SizeConfirmationProps = {
  object: ObjectType;
  sizes: readonly SizeOption[];
  onConfirm: (sizeCode: string) => Promise<void> | void;
};

export function SizeConfirmation({ object, sizes, onConfirm }: SizeConfirmationProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedSize = sizes.find((size) => size.code === selected) ?? null;

  async function confirm() {
    if (!selected || submitting) return;

    setSubmitting(true);
    try {
      await onConfirm(selected);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="size-confirmation" aria-labelledby="size-confirmation-heading" data-object={object}>
      <p className="size-confirmation__signal">FORM LOCKED / FIT</p>
      <h1 id="size-confirmation-heading">Choose the size it should become.</h1>

      <fieldset className="size-confirmation__options">
        <legend className="sr-only">Size</legend>
        {sizes.map((size) => (
          <label key={size.code} className="size-confirmation__option">
            <input
              type="radio"
              name="size"
              value={size.code}
              checked={selected === size.code}
              onChange={() => setSelected(size.code)}
              aria-label={`${size.label} — ${size.measurements}`}
            />
            <span className="size-confirmation__code">{size.code}</span>
            <span className="size-confirmation__label">{size.label}</span>
            <span className="size-confirmation__measurements">{size.measurements}</span>
          </label>
        ))}
      </fieldset>

      {selectedSize ? (
        <p className="size-confirmation__check">Check this one carefully. This is the size we’ll make.</p>
      ) : null}

      <button type="button" onClick={confirm} disabled={!selected || submitting}>
        {submitting ? '...' : 'CONFIRM SIZE'}
      </button>
    </section>
  );
}
