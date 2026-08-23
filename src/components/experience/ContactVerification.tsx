'use client';

import { FormEvent, useState } from 'react';
import styles from './contact-verification.module.css';

type OtpRequest = {
  challengeId: string;
  retryAfterSeconds: number;
  requestTag?: string;
};

type OtpError = Error & {
  code?: string;
  attemptsRemaining?: number;
};

type ContactVerificationProps = {
  onCheckEmail?: (email: string) => Promise<{ alreadyVerified: boolean }>;
  onReuseVerified?: (email: string) => Promise<{ verified: true }>;
  onRequestOtp: (email: string) => Promise<OtpRequest>;
  onVerifyOtp: (challengeId: string, code: string) => Promise<{ verified: true }>;
  onComplete: () => void;
};

type ContactMode = 'email' | 'reuse-confirm' | 'otp';

const RECOVERABLE_OTP_CODES = new Set([
  'ATTEMPT_LIMIT',
  'EXPIRED',
  'USED_OR_STALE',
  'CHALLENGE_NOT_FOUND',
]);

function otpErrorMessage(error: unknown): { message: string; recoverable: boolean } {
  if (!(error instanceof Error)) {
    return { message: 'That code could not be verified.', recoverable: false };
  }

  const typed = error as OtpError;
  if (typed.code === 'WRONG_CODE') {
    const remaining = typed.attemptsRemaining;
    return {
      message: typeof remaining === 'number'
        ? `${error.message} ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : error.message,
      recoverable: false,
    };
  }

  return {
    message: error.message || 'That code could not be verified.',
    recoverable: Boolean(typed.code && RECOVERABLE_OTP_CODES.has(typed.code)),
  };
}

export function ContactVerification({
  onCheckEmail,
  onReuseVerified,
  onRequestOtp,
  onVerifyOtp,
  onComplete,
}: ContactVerificationProps) {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<ContactMode>('email');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [requestTag, setRequestTag] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSendNewCode, setCanSendNewCode] = useState(false);

  const normalizedEmail = email.trim();

  async function startOtp() {
    const result = await onRequestOtp(normalizedEmail);
    setChallengeId(result.challengeId);
    setRequestTag(result.requestTag ?? null);
    setCode('');
    setCanSendNewCode(false);
    setMode('otp');
  }

  async function continueWithEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (onCheckEmail) {
        try {
          const continuity = await onCheckEmail(normalizedEmail);
          if (continuity.alreadyVerified && onReuseVerified) {
            setMode('reuse-confirm');
            return;
          }
        } catch {
          // Continuity is only an OTP-skipping convenience. If it cannot be
          // checked, fail closed by using normal OTP verification instead.
        }
      }
      await startOtp();
    } catch (caught) {
      setError(caught instanceof Error && caught.message
        ? caught.message
        : 'That address could not be verified yet.');
    } finally {
      setBusy(false);
    }
  }

  async function reuseEmail() {
    if (!onReuseVerified) return;
    setBusy(true);
    setError(null);
    try {
      await onReuseVerified(normalizedEmail);
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error && caught.message
        ? caught.message
        : 'That verified email could not be reused.');
    } finally {
      setBusy(false);
    }
  }

  async function sendNewCode() {
    setBusy(true);
    setError(null);
    try {
      await startOtp();
    } catch (caught) {
      setError(caught instanceof Error && caught.message
        ? caught.message
        : 'A new code could not be sent yet.');
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
    } catch (caught) {
      const failure = otpErrorMessage(caught);
      setError(failure.message);
      setCanSendNewCode(failure.recoverable);
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setMode('email');
    setChallengeId(null);
    setRequestTag(null);
    setCode('');
    setError(null);
    setCanSendNewCode(false);
  }

  return (
    <section className={styles.stage} aria-labelledby="contact-heading">
      <p className={styles.signal}>ISSUE / CONTACT</p>
      <h1 id="contact-heading">Where do we find you?</h1>

      {mode === 'email' ? (
        <form className={styles.form} onSubmit={continueWithEmail}>
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
          <p className={styles.note}>We&apos;ll check this address first. If it is new, we&apos;ll send six digits.</p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button type="submit" disabled={busy || !normalizedEmail}>{busy ? 'CHECKING' : 'SEND CODE'}</button>
        </form>
      ) : null}

      {mode === 'reuse-confirm' ? (
        <div className={styles.form}>
          <p className={styles.signal}>THIS EMAIL IS ALREADY VERIFIED.</p>
          <p className={styles.note}><strong>{normalizedEmail}</strong> was verified earlier in this browser&apos;s order chain.</p>
          <p className={styles.note}>Use it for this order, or change the email.</p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={changeEmail} disabled={busy}>CHANGE EMAIL</button>
            <button type="button" onClick={() => void reuseEmail()} disabled={busy}>{busy ? 'CHECKING' : 'USE THIS EMAIL'}</button>
          </div>
        </div>
      ) : null}

      {mode === 'otp' ? (
        <form className={styles.form} onSubmit={verify}>
          <p className={styles.note}>Six digits went to <strong>{normalizedEmail}</strong>.</p>
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
            <button type="button" className={styles.secondary} onClick={changeEmail} disabled={busy}>CHANGE EMAIL</button>
            {canSendNewCode ? (
              <button type="button" onClick={() => void sendNewCode()} disabled={busy}>{busy ? 'SENDING' : 'SEND NEW CODE'}</button>
            ) : (
              <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'CHECKING' : 'VERIFY'}</button>
            )}
          </div>
        </form>
      ) : null}
    </section>
  );
}