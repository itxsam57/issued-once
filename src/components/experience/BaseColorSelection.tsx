'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

export type BaseColorOption = {
  code: string;
  label: string;
  swatch: string;
};

type BaseColorSelectionProps = {
  colors: readonly BaseColorOption[];
  onConfirm: (colorCode: string) => Promise<void> | void;
};

export function BaseColorSelection({ colors, onConfirm }: BaseColorSelectionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!selected || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selected);
    } catch (cause) {
      setError(cause instanceof Error && cause.message
        ? cause.message
        : 'That color could not be saved yet.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="base-color" aria-labelledby="base-color-heading">
      <p className="base-color__signal">FIT LOCKED / BASE</p>
      <h1 id="base-color-heading">Color your issue.</h1>

      <fieldset className="base-color__options">
        <legend className="sr-only">Base color</legend>
        {colors.map((color) => (
          <label key={color.code} className="base-color__option">
            <input
              type="radio"
              name="base-color"
              value={color.code}
              checked={selected === color.code}
              onChange={() => {
                setSelected(color.code);
                setError(null);
              }}
              aria-label={color.label}
            />
            <span
              className="base-color__swatch"
              aria-hidden="true"
              style={{ '--base-color-swatch': color.swatch } as CSSProperties}
            />
            <span className="base-color__label">{color.label}</span>
          </label>
        ))}
      </fieldset>

      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={confirm} disabled={!selected || submitting}>
        {submitting ? '...' : 'LOCK BASE'}
      </button>
    </section>
  );
}