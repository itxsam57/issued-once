'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type NotificationEventKey = 'PAYMENT_RECEIVED'|'IN_PRODUCTION'|'SHIPPED'|'DELIVERED';
type Case = { requestId: string; issueId: string; issueCode: string; issueStatus: string; status: 'OPEN'|'CLOSED'; createdAt: string; updatedAt: string; noteCount: number; failedNotifications: NotificationEventKey[] };
async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})) as { error?: string; value?: unknown };
  if (!response.ok) throw new Error(payload.error || 'Support action failed');
  return payload;
}
async function fetchCases(filter: 'OPEN'|'CLOSED'): Promise<Case[]> {
  const response = await fetch(`/ops/api/support?status=${filter}`, { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json() as { items?: Case[]; error?: string };
  if (!response.ok) throw new Error(payload.error || 'Support queue unavailable');
  return payload.items ?? [];
}

export function SupportPanel() {
  const [filter, setFilter] = useState<'OPEN'|'CLOSED'>('OPEN');
  const [items, setItems] = useState<Case[]>([]);
  const [selected, setSelected] = useState<Case | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<unknown>(null);
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh() {
    const next = await fetchCases(filter);
    setItems(next);
    if (selected) setSelected(next.find((item) => item.requestId === selected.requestId) ?? null);
  }
  useEffect(() => {
    let alive = true;
    void fetchCases(filter)
      .then((next) => { if (alive) setItems(next); })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Support unavailable'); });
    return () => { alive = false; };
  }, [filter]);

  function clearEditor() { setReason(''); setMessage(null); setNote(''); setReply(''); }
  function choose(item: Case) { setSelected(item); clearEditor(); setError(null); }
  function changeFilter(next: 'OPEN'|'CLOSED') { setFilter(next); setSelected(null); clearEditor(); setError(null); }

  async function run(action: () => Promise<unknown>) {
    setWorking(true); setError(null);
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Support action failed'); }
    finally { setWorking(false); }
  }

  return <div>
    <div className={styles.panelHead}>
      <div><p>SUPPORT / DESK</p><h1>What needs a human.</h1></div>
      <select value={filter} onChange={(event) => changeFilter(event.target.value as 'OPEN'|'CLOSED')}><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option></select>
    </div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    <div className={styles.ledgerLayout}>
      <div className={styles.ledgerList}>{items.map((item) => <button key={item.requestId} type="button" onClick={() => choose(item)} aria-pressed={selected?.requestId === item.requestId}>
        <strong>{item.issueCode}</strong><span>{item.status}</span><span>{item.issueStatus.replaceAll('_',' ')}</span><small>NOTES / {item.noteCount}{item.failedNotifications.length ? ` · FAILED MAIL / ${item.failedNotifications.length}` : ''}</small>
      </button>)}</div>
      <section className={styles.detail}>{!selected ? <p>SELECT A CASE</p> : <>
        <p>ISSUE / {selected.issueCode}</p><h2>{selected.status}</h2><p>Customer message remains encrypted until you explicitly reveal it.</p>
        <label>Reason to reveal message<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why do you need the message?" /></label>
        <button disabled={working || !reason.trim()} type="button" onClick={() => void run(async () => { const payload = await post(`/ops/api/issues/${selected.issueId}/reveal`, { category: 'support_message', reason }); setMessage(payload.value ?? null); })}>REVEAL MESSAGE</button>
        {message !== null ? <pre className={styles.privatePre}>{JSON.stringify(message, null, 2)}</pre> : null}
        {selected.failedNotifications.length ? <section><h3>Failed notifications</h3><div className={styles.actionRow}>{selected.failedNotifications.map((eventKey) => <button key={eventKey} disabled={working} type="button" onClick={() => void run(() => post('/ops/api/support/notification-retry', { issueId: selected.issueId, eventKey }))}>RETRY {eventKey.replaceAll('_',' ')}</button>)}</div></section> : null}
        <label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button disabled={working || !note.trim()} type="button" onClick={() => void run(async () => { await post('/ops/api/support/note', { issueId: selected.issueId, body: note }); setNote(''); })}>ADD NOTE</button>
        <label>Reply to verified customer<textarea value={reply} onChange={(event) => setReply(event.target.value)} /></label>
        <button disabled={working || reply.trim().length < 2} type="button" onClick={() => void run(async () => { await post('/ops/api/support/reply', { requestId: selected.requestId, message: reply }); setReply(''); })}>SEND REPLY</button>
        <button disabled={working} type="button" onClick={() => void run(() => post('/ops/api/support/status', { requestId: selected.requestId, status: selected.status === 'OPEN' ? 'CLOSED' : 'OPEN' }))}>{selected.status === 'OPEN' ? 'CLOSE CASE' : 'REOPEN CASE'}</button>
      </>}</section>
    </div>
  </div>;
}
