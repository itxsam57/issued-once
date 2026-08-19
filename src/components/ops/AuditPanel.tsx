'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type Audit = { id: string; actor: 'OWNER'; action: string; issueId: string | null; targetType: string; targetId: string; reason: string | null; safeMetadata: Record<string,string|number|boolean|null>; createdAt: string };
type Filters = { action: string; issueCode: string; target: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { action: '', issueCode: '', target: '', from: '', to: '' };

export function AuditPanel() {
  const [items, setItems] = useState<Audit[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [error, setError] = useState<string | null>(null);

  async function load(next: string | null = null, append = false, active: Filters = applied) {
    const params = new URLSearchParams();
    if (next) params.set('cursor', next);
    if (active.action.trim()) params.set('action', active.action.trim());
    if (active.issueCode.trim()) params.set('issueCode', active.issueCode.trim());
    if (active.target.trim()) params.set('target', active.target.trim());
    if (active.from) params.set('from', new Date(`${active.from}T00:00:00`).toISOString());
    if (active.to) params.set('to', new Date(`${active.to}T23:59:59.999`).toISOString());
    const response = await fetch(`/ops/api/audit?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: Audit[]; nextCursor?: string | null; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Audit unavailable');
    setItems((current) => append ? [...current, ...(payload.items ?? [])] : (payload.items ?? []));
    setCursor(payload.nextCursor ?? null);
  }

  useEffect(() => { void load(null, false, EMPTY_FILTERS).catch((cause) => setError(cause instanceof Error ? cause.message : 'Audit unavailable')); }, []);

  async function applyFilters() {
    setError(null);
    setApplied(filters);
    try { await load(null, false, filters); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Audit unavailable'); }
  }

  return <div>
    <div className={styles.panelHead}><div><p>AUDIT / OWNER ACTIONS</p><h1>What changed, and why.</h1></div><button type="button" onClick={() => void load()}>REFRESH</button></div>
    <p className={styles.privacyFlags}>Audit metadata never stores raw answers, email, phone, address, secrets or decrypted support text.</p>
    <div className={styles.filterBar}>
      <input aria-label="Audit action" placeholder="ACTION" value={filters.action} onChange={(event) => setFilters((value) => ({ ...value, action: event.target.value }))} />
      <input aria-label="Audit Issue Code" placeholder="ISSUE CODE" value={filters.issueCode} onChange={(event) => setFilters((value) => ({ ...value, issueCode: event.target.value }))} />
      <input aria-label="Audit target" placeholder="TARGET" value={filters.target} onChange={(event) => setFilters((value) => ({ ...value, target: event.target.value }))} />
      <input aria-label="Audit from date" type="date" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} />
      <input aria-label="Audit to date" type="date" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} />
      <button type="button" onClick={() => void applyFilters()}>FILTER</button>
    </div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    <div className={styles.auditList}>{items.map((item) => <article key={item.id}>
      <div><strong>{item.action.replaceAll('_',' ')}</strong><span>{item.issueId ? `ISSUE / ${item.issueId.slice(0,8)}` : item.targetType.toUpperCase()}</span></div>
      <small>{new Date(item.createdAt).toLocaleString()}</small>
      {item.reason ? <p>REASON / {item.reason}</p> : null}
      <pre>{JSON.stringify(item.safeMetadata)}</pre>
    </article>)}</div>
    {cursor ? <button type="button" onClick={() => void load(cursor, true)}>LOAD MORE</button> : null}
  </div>;
}
