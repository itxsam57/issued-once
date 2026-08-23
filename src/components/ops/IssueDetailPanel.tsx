'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type RevealCategory = 'contact' | 'shipping' | 'answers' | 'design_brief' | 'support_message';
type Detail = {
  issueId: string; issueCode: string; status: string; objectType: string; sizeCode: string; colorCode: string; amountMinor: number; currency: string;
  paymentStatus: string | null; paymentProvider: string | null; paymentProviderReference: string | null; paymentExceptionCode: string | null;
  designState: string | null; artworkWidth: number | null; artworkHeight: number | null; designProvider: string | null; designModel: string | null;
  manufacturingState: string | null; providerOrderId: string | null; providerStatus: string | null; trackingNumber: string | null; trackingUrl: string | null;
  privacy: { verifiedEmail: boolean; shipping: boolean; answers: boolean; privateBrief: boolean; supportMessage: boolean };
  timeline: Array<{ eventType: string; source: string; safeDetail: Record<string, unknown> | null; createdAt: string }>;
  notifications: Array<{ eventKey: string; status: string; attemptCount: number; updatedAt: string }>;
  support: Array<{ requestId: string; status: string; createdAt: string; updatedAt: string }>;
};
type LoadState = { issueId: string | null; detail: Detail | null; error: string | null };

async function fetchIssueDetail(issueId: string): Promise<Detail> {
  const response = await fetch(`/ops/api/issues/${encodeURIComponent(issueId)}`, { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json() as { issue?: Detail; error?: string };
  if (!response.ok || !payload.issue) throw new Error(payload.error || 'Issue detail unavailable');
  return payload.issue;
}

export function IssueDetailPanel({ issueId }: { issueId: string | null }) {
  const [load, setLoad] = useState<LoadState>({ issueId: null, detail: null, error: null });
  const [revealCategory, setRevealCategory] = useState<RevealCategory | null>(null);
  const [revealIssueId, setRevealIssueId] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [revealed, setRevealed] = useState<unknown>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (!issueId) return;
    let alive = true;
    void fetchIssueDetail(issueId)
      .then((detail) => { if (alive) setLoad({ issueId, detail, error: null }); })
      .catch((cause) => { if (alive) setLoad({ issueId, detail: null, error: cause instanceof Error ? cause.message : 'Issue detail unavailable' }); });
    return () => { alive = false; };
  }, [issueId]);

  async function reveal() {
    if (!issueId || revealIssueId !== issueId || !revealCategory) return;
    setRevealing(true); setRevealError(null); setRevealed(null);
    try {
      const response = await fetch(`/ops/api/issues/${encodeURIComponent(issueId)}/reveal`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: revealCategory, reason: revealReason }),
      });
      const payload = await response.json() as { value?: unknown; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Private reveal failed');
      setRevealed(payload.value ?? null);
    } catch (cause) { setRevealError(cause instanceof Error ? cause.message : 'Private reveal failed'); }
    finally { setRevealing(false); }
  }

  function openReveal(category: RevealCategory) {
    setRevealIssueId(issueId);
    setRevealCategory(category);
    setRevealReason('');
    setRevealed(null);
    setRevealError(null);
  }
  function closeReveal() {
    setRevealIssueId(null); setRevealCategory(null); setRevealReason(''); setRevealed(null); setRevealError(null);
  }

  if (!issueId) return <aside className={styles.detail}><p>SELECT AN ISSUE</p></aside>;
  if (load.issueId !== issueId) return <aside className={styles.detail}><p>READING ISSUE</p></aside>;
  if (load.error) return <aside className={styles.detail}><p role="alert">{load.error}</p></aside>;
  if (!load.detail) return <aside className={styles.detail}><p>READING ISSUE</p></aside>;
  const detail = load.detail;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: detail.currency }).format(detail.amountMinor / 100);
  const revealOptions: Array<{ category: RevealCategory; label: string; available: boolean }> = [
    { category: 'contact', label: 'CONTACT', available: detail.privacy.verifiedEmail },
    { category: 'shipping', label: 'SHIPPING', available: detail.privacy.shipping },
    { category: 'answers', label: '7 ANSWERS', available: detail.privacy.answers },
    { category: 'design_brief', label: 'PRIVATE BRIEF', available: detail.privacy.privateBrief },
    { category: 'support_message', label: 'SUPPORT TEXT', available: detail.privacy.supportMessage },
  ];
  const revealOpen = revealIssueId === issueId && revealCategory !== null;

  return <aside className={styles.detail}>
    <p>ISSUE / {detail.issueCode}</p><h2>{detail.status.replaceAll('_', ' ')}</h2>
    <div className={styles.detailGrid}>
      <div><span>PHYSICAL</span><strong>{detail.objectType.toUpperCase()} / {detail.sizeCode} / {detail.colorCode.toUpperCase()}</strong></div>
      <div><span>VALUE</span><strong>{money}</strong></div><div><span>PAYMENT</span><strong>{detail.paymentStatus ?? 'UNKNOWN'}</strong></div>
      <div><span>DESIGN</span><strong>{detail.designState ?? 'NOT YET'}</strong></div><div><span>FACTORY</span><strong>{detail.manufacturingState ?? 'NOT YET'}</strong></div>
      <div><span>TRACKING</span><strong>{detail.trackingNumber ?? 'NOT YET'}</strong></div>
    </div>
    {detail.paymentExceptionCode ? <p className={styles.alert}>PAYMENT EXCEPTION / {detail.paymentExceptionCode}</p> : null}
    <section><h3>Private data</h3><p className={styles.privacyFlags}>{detail.privacy.verifiedEmail ? 'EMAIL STORED' : 'NO EMAIL'} · {detail.privacy.shipping ? 'SHIPPING STORED' : 'NO SHIPPING'} · {detail.privacy.answers ? 'ANSWERS STORED' : 'NO ANSWERS'} · {detail.privacy.privateBrief ? 'BRIEF STORED' : 'NO BRIEF'}</p><p>Plaintext stays hidden until an audited reveal is requested.</p>
      <div className={styles.revealButtons}>{revealOptions.filter((option) => option.available).map((option) => <button key={option.category} type="button" onClick={() => openReveal(option.category)}>{option.label}</button>)}</div>
    </section>
    {revealOpen ? <section className={styles.revealBox}>
      <div className={styles.panelHead}><strong>REVEAL / {revealCategory.replaceAll('_', ' ').toUpperCase()}</strong><button type="button" onClick={closeReveal}>CLOSE</button></div>
      <label>Reason for access<input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} placeholder="Why do you need this?" /></label>
      <button type="button" disabled={revealing || !revealReason.trim()} onClick={() => void reveal()}>{revealing ? 'REVEALING' : 'REVEAL PRIVATE DATA'}</button>
      {revealError ? <p role="alert">{revealError}</p> : null}{revealed !== null ? <pre>{JSON.stringify(revealed, null, 2)}</pre> : null}
    </section> : null}
    <section><h3>Timeline</h3><div className={styles.timeline}>{detail.timeline.map((event, index) => <div key={`${event.createdAt}-${event.eventType}-${index}`}><strong>{event.eventType.replaceAll('_', ' ')}</strong><span>{event.source}</span><small>{new Date(event.createdAt).toLocaleString()}</small></div>)}{detail.timeline.length === 0 ? <p>NO TIMELINE EVENTS</p> : null}</div></section>
  </aside>;
}
