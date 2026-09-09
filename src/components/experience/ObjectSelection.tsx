'use client';

import Image from 'next/image';
import type { CSSProperties, PointerEvent } from 'react';
import { useState } from 'react';

export type ObjectType = 'tee' | 'hoodie' | 'hat' | 'tote';
type InspectionMode = 'FORM' | 'MATERIAL' | 'TECHNICAL' | 'DISPLAY';

type ObjectSelectionProps = {
  onSelect: (object: ObjectType) => Promise<void> | void;
};

const MODES: readonly InspectionMode[] = ['FORM', 'MATERIAL', 'TECHNICAL', 'DISPLAY'];
const MODE_PERCENT = ['25%', '50%', '75%', '100%'] as const;
const ASSET_PREFIX: Record<InspectionMode, string> = {
  FORM: 'form',
  MATERIAL: 'macro',
  TECHNICAL: 'tech',
  DISPLAY: 'museum',
};

const CURRENT_ISSUE_OBJECTS = [
  { value: 'tee' as const, label: 'TEE', asset: 'tee', alt: 'Tee physical form study' },
  { value: 'hat' as const, label: 'CAP', asset: 'cap', alt: 'Cap physical form study' },
  { value: 'tote' as const, label: 'TOTE', asset: 'tote', alt: 'Tote physical form study' },
];

type InspectStyle = CSSProperties & { '--inspect-x': string; '--inspect-y': string };

function assetFor(mode: InspectionMode, asset: string) {
  return `/assets/issued-once/asset-${ASSET_PREFIX[mode]}-${asset}.jpg`;
}

export function ObjectSelection({ onSelect }: ObjectSelectionProps) {
  const [selected, setSelected] = useState<ObjectType | null>(null);
  const [modeIndex, setModeIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function activate(object: ObjectType) {
    setError(null);
    if (selected === object) {
      setModeIndex((current) => (current + 1) % MODES.length);
      return;
    }
    setSelected(object);
    setModeIndex(0);
  }

  function inspect(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.width > 0 ? event.clientX - bounds.left : event.clientX;
    const y = bounds.height > 0 ? event.clientY - bounds.top : event.clientY;
    event.currentTarget.style.setProperty('--inspect-x', `${Math.round(x)}px`);
    event.currentTarget.style.setProperty('--inspect-y', `${Math.round(y)}px`);
  }

  async function lockForm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSelect(selected);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'That form could not be saved yet.');
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
        {CURRENT_ISSUE_OBJECTS.map((object) => {
          const isSelected = selected === object.value;
          const mode = isSelected ? MODES[modeIndex] : 'FORM';
          return (
            <article
              className="object-selection__card"
              data-object-card
              data-selected={isSelected ? 'true' : 'false'}
              data-mode={mode}
              key={object.value}
              onPointerMove={inspect}
              style={{ '--inspect-x': '50%', '--inspect-y': '50%' } as InspectStyle}
            >
              <label className="object-selection__option">
                <input
                  type="radio"
                  name="object"
                  value={object.value}
                  aria-label={object.label}
                  checked={isSelected}
                  disabled={submitting}
                  onChange={() => undefined}
                  onClick={() => activate(object.value)}
                />
                <Image
                  src={assetFor(mode, object.asset)}
                  alt={object.alt}
                  fill
                  sizes="(max-width: 720px) calc(100vw - 36px), (max-width: 900px) calc((100vw - 236px) / 3), calc((min(1020px, 100vw - 210px - 2 * 58px) - 32px) / 3)"
                  unoptimized
                />
                <span className="object-selection__shade" aria-hidden="true" />
                <span className="object-selection__meta">
                  <span>{object.label}</span>
                  <span>{mode}</span>
                </span>
              </label>

              {isSelected ? (
                <div className="object-selection__rail" aria-label={`${object.label} inspection mode`}>
                  {MODES.map((item, index) => (
                    <span data-active={index === modeIndex ? 'true' : 'false'} key={item}>
                      {MODE_PERCENT[index]}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </fieldset>

      <p className="object-selection__hint">Select once to choose. Select again to inspect.</p>
      {error ? <p className="object-selection__error" role="alert">{error}</p> : null}
      <button type="button" onClick={lockForm} disabled={!selected || submitting}>
        {submitting ? '...' : 'LOCK FORM'}
      </button>
    </section>
  );
}
