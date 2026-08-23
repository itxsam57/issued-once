'use client';

import { useEffect, useState } from 'react';
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

export function IssueStatusView() {
  const [status, setStatus] = useState<IssueStatusPayload | null>(null);
  const [failed, setFailed] = useState(false);

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
    return (
      <section className={styles.stage} aria-live="polite">
        <p className={styles.signal}>PAYMENT / CHECKING</p>
        <h1>Hold this thought.</h1>
        <p>We&apos;re confirming that your issue is really yours.</p>
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
      <p className={styles.note}>Keep your Issue Code. It&apos;s the shortest way back to this piece.</p>
    </section>
  );
}
