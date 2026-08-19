'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type Audit = { id: string; actor: 'OWNER'; action: string; issueId: string | null; targetType: string; targetId: string; reason: string | null; safeMetadata: Record<string,string|number|boolean|null>; createdAt: string };

export function AuditPanel() {
  const [items, setItems] = useState<Audit[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load(next: string | null = null, append = false) {
    const params = new URLSearchParams(); if (next) params.set('cursor', next);
    const response = await fetch(`/ops/api/audit?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: Audit[]; nextCursor?: string | null; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Audit unavailable');
    setItems((current) => append ? [...current, ...(payload.items ?? [])] : (payload.items ?? []));
    setCursor(payload.nextCursor ?? null);
  }
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Audit unavailable')); }, []);
  return <div>
    <div className={styles.panelHead}><div><p>AUDIT / OWNER ACTIONS</p><h1>What changed, and why.</h1></div><button type="button" onClick={() => void load()}>REFRESH</button></div>
    <p className={styles.privacyFlags}>Audit metadata never stores raw answers, email, phone, address, secrets or decrypted support text.</p>
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
