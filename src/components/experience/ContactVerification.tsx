'use client';

import { FormEvent, useState } from 'react';
import styles from './contact-verification.module.css';

type ContactVerificationProps = {
  onRequestOtp: (email: string) => Promise<{ challengeId: string; retryAfterSeconds: number }>;
  onVerifyOtp: (challengeId: string, code: string) => Promise<{ verified: true }>;
  onComplete: () => void;
};

export function ContactVerification({ onRequestOtp, onVerifyOtp, onComplete }: ContactVerificationProps) {
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await onRequestOtp(email.trim());
      setChallengeId(result.challengeId);
      setCode('');
    } catch {
      setError('That address could not be verified yet.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      await onVerifyOtp(challengeId, code);
      onComplete();
    } catch {
      setError('That code did not match.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.stage} aria-labelledby="contact-heading">
      <p className={styles.signal}>ISSUE / CONTACT</p>
      <h1 id="contact-heading">Where do we find you?</h1>
      {!challengeId ? (
        <form className={styles.form} onSubmit={sendCode}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={320}
            />
          </label>
          <p className={styles.note}>We&apos;ll send six digits. Nothing else to remember.</p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button type="submit" disabled={busy || !email.trim()}>{busy ? 'SENDING' : 'SEND CODE'}</button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={verify}>
          <p className={styles.note}>Six digits went to <strong>{email.trim()}</strong>.</p>
          <label className={styles.field}>
            <span>Verification code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </label>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => { setChallengeId(null); setCode(''); setError(null); }}>
              CHANGE EMAIL
            </button>
            <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'CHECKING' : 'VERIFY'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
