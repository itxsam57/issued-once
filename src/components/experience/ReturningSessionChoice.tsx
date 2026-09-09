'use client';

import { useState } from 'react';
import styles from './repeat-order-choice.module.css';

type ReturningSessionChoiceProps = {
  onContinue: () => void;
  onStartAgain: () => Promise<void>;
};

export function ReturningSessionChoice({
  onContinue,
  onStartAgain,
}: ReturningSessionChoiceProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function startAgain() {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      await onStartAgain();
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.choice} aria-labelledby="returning-session-heading">
      <p className="interview-complete__signal">ISSUE / RETURN</p>
      <h1 id="returning-session-heading">PICK UP WHERE YOU LEFT OFF?</h1>
      <p className={styles.copy}>Your unfinished Issue is still here.</p>

      <div className={styles.actions}>
        <button type="button" disabled={submitting} onClick={onContinue}>
          CONTINUE
        </button>
        <button type="button" disabled={submitting} onClick={() => void startAgain()}>
          {submitting ? '...' : 'START AGAIN'}
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          A fresh Issue could not be started. Try again.
        </p>
      ) : null}
    </section>
  );
}
