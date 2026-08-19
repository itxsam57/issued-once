'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type Detail = {
  issueId: string;
  issueCode: string;
  status: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  amountMinor: number;
  currency: string;
  paymentStatus: string | null;
  paymentProvider: string | null;
  paymentProviderReference: string | null;
  paymentExceptionCode: string | null;
  designState: string | null;
  artworkWidth: number | null;
  artworkHeight: number | null;
  designProvider: string | null;
  designModel: string | null;
  manufacturingState: string | null;
  providerOrderId: string | null;
  providerStatus: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  privacy: { verifiedEmail: boolean; shipping: boolean; answers: boolean; privateBrief: boolean; supportMessage: boolean };
  timeline: Array<{ eventType: string; source: string; safeDetail: Record<string, unknown> | null; createdAt: string }>;
  notifications: Array<{ eventKey: string; status: string; attemptCount: number; updatedAt: string }>;
  support: Array<{ requestId: string; status: string; createdAt: string; updatedAt: string }>;
};

export function IssueDetailPanel({ issueId }: { issueId: string | null }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!issueId) return;
    let alive = true;
    fetch(`/ops/api/issues/${encodeURIComponent(issueId)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { issue?: Detail; error?: string };
        if (!response.ok || !payload.issue) throw new Error(payload.error || 'Issue detail unavailable');
        return payload.issue;
      })
      .then((value) => { if (alive) setDetail(value); })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Issue detail unavailable'); });
    return () => { alive = false; };
  }, [issueId]);

  if (!issueId) return <aside className={styles.detail}><p>SELECT AN ISSUE</p></aside>;
  if (error) return <aside className={styles.detail}><p role="alert">{error}</p></aside>;
  if (!detail) return <aside className={styles.detail}><p>READING ISSUE</p></aside>;

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: detail.currency }).format(detail.amountMinor / 100);
  return (
    <aside className={styles.detail}>
      <p>ISSUE / {detail.issueCode}</p>
      <h2>{detail.status.replaceAll('_', ' ')}</h2>
      <div className={styles.detailGrid}>
        <div><span>PHYSICAL</span><strong>{detail.objectType.toUpperCase()} / {detail.sizeCode} / {detail.colorCode.toUpperCase()}</strong></div>
        <div><span>VALUE</span><strong>{money}</strong></div>
        <div><span>PAYMENT</span><strong>{detail.paymentStatus ?? 'UNKNOWN'}</strong></div>
        <div><span>DESIGN</span><strong>{detail.designState ?? 'NOT YET'}</strong></div>
        <div><span>FACTORY</span><strong>{detail.manufacturingState ?? 'NOT YET'}</strong></div>
        <div><span>TRACKING</span><strong>{detail.trackingNumber ?? 'NOT YET'}</strong></div>
      </div>
      {detail.paymentExceptionCode ? <p className={styles.alert}>PAYMENT EXCEPTION / {detail.paymentExceptionCode}</p> : null}
      <section>
        <h3>Private data</h3>
        <p className={styles.privacyFlags}>
          {detail.privacy.verifiedEmail ? 'EMAIL STORED' : 'NO EMAIL'} · {detail.privacy.shipping ? 'SHIPPING STORED' : 'NO SHIPPING'} · {detail.privacy.answers ? 'ANSWERS STORED' : 'NO ANSWERS'} · {detail.privacy.privateBrief ? 'BRIEF STORED' : 'NO BRIEF'}
        </p>
        <p>Plaintext stays hidden until an audited reveal is requested.</p>
      </section>
      <section>
        <h3>Timeline</h3>
        <div className={styles.timeline}>
          {detail.timeline.map((event, index) => (
            <div key={`${event.createdAt}-${event.eventType}-${index}`}>
              <strong>{event.eventType.replaceAll('_', ' ')}</strong>
              <span>{event.source}</span>
              <small>{new Date(event.createdAt).toLocaleString()}</small>
            </div>
          ))}
          {detail.timeline.length === 0 ? <p>NO TIMELINE EVENTS</p> : null}
        </div>
      </section>
    </aside>
  );
}
