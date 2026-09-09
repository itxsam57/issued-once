'use client';

import { useState } from 'react';
import styles from './repeat-order-choice.module.css';

type ReturningSessionChoiceProps = {
  onContinue: () => Promise<void> | void;
  onStartAgain: () => Promise<void> | void;
};

export function ReturningSessionChoice({
  onContinue,
  onStartAgain,
}: ReturningSessionChoiceProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<'continue' | 'restart' | null>(null);

  async function submit(action: 'continue' | 'restart') {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (action === 'continue') await onContinue();
      else await onStartAgain();
    } catch {
      setError(action);
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.choice} aria-labelledby="returning-session-heading">
      <p className="interview-complete__signal">ISSUE / RETURN</p>
      <h1 id="returning-session-heading">PICK UP WHERE YOU LEFT OFF?</h1>
      <p className={styles.copy}>Your unfinished Issue is still here.</p>

      <div className={styles.actions}>
        <button type="button" disabled={submitting} onClick={() => void submit('continue')}>
          {submitting ? '...' : 'CONTINUE'}
        </button>
        <button type="button" disabled={submitting} onClick={() => void submit('restart')}>
          {submitting ? '...' : 'START AGAIN'}
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error === 'continue'
            ? 'That saved Issue could not be opened. Try again.'
            : 'A fresh Issue could not be started. Try again.'}
        </p>
      ) : null}
    </section>
  );
}
