'use client';

import { useCallback, useEffect, useState } from 'react';
import { IssueDetailPanel } from './IssueDetailPanel';
import styles from './owner-os.module.css';

type IssueRow = {
  issueId: string;
  issueCode: string;
  status: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  amountMinor: number;
  currency: string;
  paymentStatus: string | null;
  designState: string | null;
  manufacturingState: string | null;
  providerOrderId: string | null;
  trackingNumber: string | null;
  paymentExceptionCode: string | null;
  updatedAt: string;
};

export function IssuesPanel() {
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null = null, append = false) => {
    const params = new URLSearchParams({ view: 'ledger', limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (cursor) params.set('cursor', cursor);
    const response = await fetch(`/ops/api/issues?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: IssueRow[]; nextCursor?: string | null; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Issue ledger unavailable');
    setRows((current) => append ? [...current, ...(payload.items ?? [])] : (payload.items ?? []));
    setNextCursor(payload.nextCursor ?? null);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError(null);
      void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Issue ledger unavailable'));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <div className={styles.panelHead}>
        <div><p>ISSUES / CANONICAL LEDGER</p><h1>Every paid piece.</h1></div>
        <input
          aria-label="Search Issues"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Issue / Safepay / Printful / tracking"
        />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div className={styles.ledgerLayout}>
        <div className={styles.ledgerList}>
          {rows.map((issue) => (
            <button key={issue.issueId} type="button" onClick={() => setSelected(issue.issueId)} aria-pressed={selected === issue.issueId}>
              <strong>{issue.issueCode}</strong>
              <span>{issue.objectType.toUpperCase()} / {issue.sizeCode} / {issue.colorCode.toUpperCase()}</span>
              <span>{issue.status.replaceAll('_', ' ')}</span>
              <small>{new Intl.NumberFormat('en-US', { style: 'currency', currency: issue.currency }).format(issue.amountMinor / 100)}</small>
              {issue.paymentExceptionCode ? <em>PAYMENT ATTENTION</em> : null}
            </button>
          ))}
          {nextCursor ? <button type="button" onClick={() => void load(nextCursor, true)}>LOAD MORE</button> : null}
          {rows.length === 0 ? <p>NO ISSUES MATCH</p> : null}
        </div>
        <IssueDetailPanel issueId={selected} />
      </div>
    </div>
  );
}
