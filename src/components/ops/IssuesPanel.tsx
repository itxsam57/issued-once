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

type Filters = {
  issueStatus: string;
  paymentStatus: string;
  designState: string;
  manufacturingState: string;
  objectType: string;
  supportOpen: string;
  paymentException: string;
  country: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  issueStatus: '', paymentStatus: '', designState: '', manufacturingState: '', objectType: '',
  supportOpen: '', paymentException: '', country: '', from: '', to: '',
};

export function IssuesPanel() {
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null = null, append = false) => {
    const params = new URLSearchParams({ view: 'ledger', limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (cursor) params.set('cursor', cursor);
    for (const [key, value] of Object.entries(filters)) {
      const trimmed = value.trim();
      if (trimmed) params.set(key, key === 'country' ? trimmed.toUpperCase() : trimmed);
    }
    const response = await fetch(`/ops/api/issues?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: IssueRow[]; nextCursor?: string | null; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Issue ledger unavailable');
    setRows((current) => append ? [...current, ...(payload.items ?? [])] : (payload.items ?? []));
    setNextCursor(payload.nextCursor ?? null);
  }, [search, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError(null);
      void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Issue ledger unavailable'));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const setFilter = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

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
      <div className={styles.filterBar}>
        <select aria-label="Issue status filter" value={filters.issueStatus} onChange={(event) => setFilter('issueStatus', event.target.value)}>
          <option value="">ALL ISSUE STATES</option>
          {['RECEIVED','BEING_INTERPRETED','DESIGN_REVIEW','DESIGN_APPROVED','MANUFACTURING_DRAFT','IN_PRODUCTION','IN_TRANSIT','DELIVERED','EXCEPTION','CANCELED'].map((value) => <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}
        </select>
        <select aria-label="Payment status filter" value={filters.paymentStatus} onChange={(event) => setFilter('paymentStatus', event.target.value)}>
          <option value="">ALL PAYMENTS</option>
          {['CREATED','REDIRECTED','PAID','FAILED','REFUNDED','EXCEPTION'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Design status filter" value={filters.designState} onChange={(event) => setFilter('designState', event.target.value)}>
          <option value="">ALL DESIGN</option>
          {['QUEUED','INTERPRETING','GENERATING','REVIEW','APPROVED','FAILED'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Manufacturing status filter" value={filters.manufacturingState} onChange={(event) => setFilter('manufacturingState', event.target.value)}>
          <option value="">ALL FACTORY</option>
          {['RESERVED','DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED','FAILED','CANCELED'].map((value) => <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}
        </select>
        <select aria-label="Issue form filter" value={filters.objectType} onChange={(event) => setFilter('objectType', event.target.value)}>
          <option value="">ALL FORMS</option><option value="tee">TEE</option><option value="hat">CAP</option><option value="tote">TOTE</option>
        </select>
        <select aria-label="Support status filter" value={filters.supportOpen} onChange={(event) => setFilter('supportOpen', event.target.value)}>
          <option value="">ANY SUPPORT</option><option value="true">OPEN SUPPORT</option><option value="false">NO OPEN SUPPORT</option>
        </select>
        <select aria-label="Payment exception filter" value={filters.paymentException} onChange={(event) => setFilter('paymentException', event.target.value)}>
          <option value="">ANY PAYMENT STATE</option><option value="true">PAYMENT ATTENTION</option><option value="false">NO PAYMENT ATTENTION</option>
        </select>
        <input aria-label="Issue country filter" value={filters.country} maxLength={2} onChange={(event) => setFilter('country', event.target.value)} placeholder="COUNTRY" />
        <input aria-label="Issue updated from" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
        <input aria-label="Issue updated to" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
        <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>CLEAR</button>
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
