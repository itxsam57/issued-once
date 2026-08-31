'use client';

import { FormEvent, useState } from 'react';
import styles from './contact-verification.module.css';

type RecoveryRequest = {
  challengeId: string;
  retryAfterSeconds: number;
  requestTag?: string;
};

type RecoveryIdentity = {
  issueCode: string;
  email: string;
};

type IssueRecoveryFormProps = {
  onRequestOtp: (input: RecoveryIdentity) => Promise<RecoveryRequest>;
  onVerifyOtp: (input: RecoveryIdentity & { challengeId: string; code: string }) => Promise<{ restored: true }>;
  onComplete: () => void;
  onCancel?: () => void;
};

type RecoveryMode = 'identity' | 'otp';

export function IssueRecoveryForm({
  onRequestOtp,
  onVerifyOtp,
  onComplete,
  onCancel,
}: IssueRecoveryFormProps) {
  const [issueCode, setIssueCode] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<RecoveryMode>('identity');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [requestTag, setRequestTag] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedIssueCode = issueCode.trim();
  const normalizedEmail = email.trim();

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await onRequestOtp({
        issueCode: normalizedIssueCode,
        email: normalizedEmail,
      });
      setChallengeId(result.challengeId);
      setRequestTag(result.requestTag ?? null);
      setCode('');
      setMode('otp');
    } catch {
      setError('Recovery is unavailable right now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function restore(event: FormEvent) {
    event.preventDefault();
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      await onVerifyOtp({
        issueCode: normalizedIssueCode,
        email: normalizedEmail,
        challengeId,
        code,
      });
      onComplete();
    } catch {
      setError('Issue recovery could not be verified.');
    } finally {
      setBusy(false);
    }
  }

  function changeDetails() {
    setMode('identity');
    setChallengeId(null);
    setRequestTag(null);
    setCode('');
    setError(null);
  }

  return (
    <section className={styles.stage} aria-labelledby="issue-recovery-heading">
      <p className={styles.signal}>ISSUE / RECOVERY</p>
      <h1 id="issue-recovery-heading">Find your Issue.</h1>

      {mode === 'identity' ? (
        <form className={styles.form} onSubmit={requestCode}>
          <label className={styles.field}>
            <span>Issue Code</span>
            <input
              type="text"
              autoComplete="off"
              value={issueCode}
              onChange={(event) => setIssueCode(event.target.value)}
              required
              maxLength={32}
            />
          </label>
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
          <p className={styles.note}>Use the email you verified when this Issue was placed.</p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.actions}>
            {onCancel ? (
              <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>BACK</button>
            ) : null}
            <button type="submit" disabled={busy || !normalizedIssueCode || !normalizedEmail}>
              {busy ? 'CHECKING' : 'SEND CODE'}
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'otp' ? (
        <form className={styles.form} onSubmit={restore}>
          <p className={styles.note}>If those details match an Issue, six digits are on the way.</p>
          {requestTag ? <p className={styles.note}>Request <strong>{requestTag}</strong></p> : null}
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
            <button type="button" className={styles.secondary} onClick={changeDetails} disabled={busy}>CHANGE DETAILS</button>
            <button type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'CHECKING' : 'RESTORE ISSUE'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
