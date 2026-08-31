'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { IssueRecoveryForm } from './IssueRecoveryForm';
import recoveryStyles from './contact-verification.module.css';
import styles from './issue-status.module.css';

type IssueStatusPayload =
  | { found: false }
  | {
      found: true;
      issueCode: string;
      status: string;
      objectType: string;
      sizeCode: string;
      colorCode: string;
      trackingUrl: string | null;
      trackingNumber: string | null;
      updatedAt: string;
    };

type RecoveryRequest = {
  challengeId: string;
  retryAfterSeconds: number;
  requestTag?: string;
};

type RecoveryIdentity = {
  issueCode: string;
  email: string;
};

type SupportState = 'idle' | 'sending' | 'sent' | 'error';

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export function IssueStatusView() {
  const [status, setStatus] = useState<IssueStatusPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportState, setSupportState] = useState<SupportState>('idle');
  const [supportError, setSupportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function read(attempt: number) {
      try {
        const response = await fetch('/api/issue/status', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('status');
        const payload = (await response.json()) as IssueStatusPayload;
        if (!active) return;
        setStatus(payload);
        if (!payload.found && attempt < 20) {
          timer = setTimeout(() => void read(attempt + 1), 3000);
        }
      } catch {
        if (active) setFailed(true);
      }
    }

    void read(0);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function requestRecoveryOtp(input: RecoveryIdentity): Promise<RecoveryRequest> {
    const response = await fetch('/api/issue/recovery/request', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await parseJson(response);
    if (!response.ok) throw new Error('Issue recovery is unavailable');
    return payload as RecoveryRequest;
  }

  async function verifyRecoveryOtp(input: RecoveryIdentity & { challengeId: string; code: string }) {
    const response = await fetch('/api/issue/recovery/verify', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await parseJson(response);
    if (!response.ok || payload.restored !== true) {
      throw new Error('Issue recovery could not be verified');
    }
    return { restored: true as const };
  }

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = supportMessage.trim();
    if (message.length < 2 || supportState === 'sending') return;

    setSupportState('sending');
    setSupportError(null);

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const payload = await parseJson(response);
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Support could not be sent right now.');
      }

      setSupportMessage('');
      setSupportState('sent');
    } catch (error) {
      setSupportState('error');
      setSupportError(error instanceof Error ? error.message : 'Support could not be sent right now.');
    }
  }

  if (failed) {
    return (
      <section className={styles.stage} role="alert">
        <p className={styles.signal}>ISSUE / INTERRUPTED</p>
        <h1>We still have it.</h1>
        <p>Refresh this page to check again.</p>
      </section>
    );
  }

  if (!status || !status.found) {
    if (recovering) {
      return (
        <IssueRecoveryForm
          onRequestOtp={requestRecoveryOtp}
          onVerifyOtp={verifyRecoveryOtp}
          onComplete={() => window.location.reload()}
          onCancel={() => setRecovering(false)}
        />
      );
    }

    return (
      <section className={styles.stage} aria-live="polite">
        <p className={styles.signal}>PAYMENT / CHECKING</p>
        <h1>Hold this thought.</h1>
        <p>We&apos;re confirming that your issue is really yours.</p>
        <div className={recoveryStyles.form}>
          <button type="button" onClick={() => setRecovering(true)}>FIND MY ISSUE</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.stage} aria-live="polite">
      <p className={styles.signal}>ISSUE / {status.issueCode}</p>
      <h1>{status.status}</h1>
      <div className={styles.truth}>
        <span>{status.objectType}</span>
        <span>{status.sizeCode}</span>
        <span>{status.colorCode}</span>
      </div>
      {status.trackingUrl ? (
        <a className={styles.track} href={status.trackingUrl} target="_blank" rel="noreferrer">
          TRACK IT <span aria-hidden="true">↗</span>
        </a>
      ) : null}
      <form className={styles.support} onSubmit={submitSupport}>
        <label htmlFor="issue-support-message">Tell us what happened</label>
        <textarea
          id="issue-support-message"
          value={supportMessage}
          minLength={2}
          maxLength={5000}
          required
          disabled={supportState === 'sending'}
          onChange={(event) => {
            setSupportMessage(event.target.value);
            if (supportState !== 'idle') {
              setSupportState('idle');
              setSupportError(null);
            }
          }}
        />
        <button type="submit" disabled={supportState === 'sending' || supportMessage.trim().length < 2}>
          {supportState === 'sending' ? 'SENDING…' : 'SEND TO SUPPORT'}
        </button>
        {supportState === 'sent' ? (
          <p className={styles.supportStatus}>Support received. We&apos;ll reply to the verified email attached to this Issue.</p>
        ) : null}
        {supportState === 'error' && supportError ? (
          <p className={styles.supportStatus} role="alert">{supportError}</p>
        ) : null}
      </form>
      <p className={styles.note}>Keep your Issue Code. It&apos;s the shortest way back to this piece.</p>
    </section>
  );
}
