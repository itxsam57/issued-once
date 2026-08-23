'use client';

import { useState } from 'react';
import styles from './repeat-order-choice.module.css';

export type RepeatOrderMode = 'reuse' | 'fresh';

type RepeatOrderChoiceProps = {
  onChoose: (mode: RepeatOrderMode) => Promise<void> | void;
};

export function RepeatOrderChoice({ onChoose }: RepeatOrderChoiceProps) {
  const [submitting, setSubmitting] = useState<RepeatOrderMode | null>(null);
  const [error, setError] = useState(false);

  async function choose(mode: RepeatOrderMode) {
    if (submitting) return;

    setSubmitting(mode);
    setError(false);
    try {
      await onChoose(mode);
    } catch {
      setError(true);
      setSubmitting(null);
    }
  }

  return (
    <section className={styles.choice} aria-labelledby="repeat-order-heading">
      <p className="interview-complete__signal">NEXT ISSUE / PROFILE</p>
      <h1 id="repeat-order-heading">MAKE ANOTHER ONE?</h1>
      <p className={styles.copy}>
        Keep what you already told us, or give this Issue a completely new set of traces.
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => void choose('reuse')}
        >
          {submitting === 'reuse' ? '...' : 'KEEP PREVIOUS ANSWERS'}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => void choose('fresh')}
        >
          {submitting === 'fresh' ? '...' : 'ANSWER AGAIN'}
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          That choice did not hold. Try it again.
        </p>
      ) : null}
    </section>
  );
}
