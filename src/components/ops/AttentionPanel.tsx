'use client';

import { useEffect, useState } from 'react';
import type { OwnerOsSection } from './OwnerOsShell';
import styles from './owner-os.module.css';

type Item = { kind: string; priority: number; issueId: string | null; issueCode: string | null; targetId: string; detail: string; createdAt: string };
const SECTION: Record<string, OwnerOsSection> = {
  PAYMENT_EXCEPTION: 'Issues', DESIGN_FAILED: 'Designer', DESIGN_STUCK: 'Designer', MANUFACTURING_FAILED: 'Manufacturing',
  NOTIFICATION_FAILED: 'System', SUPPORT_AGING: 'Support', PAID_WITHOUT_ISSUE: 'Issues',
};

export function AttentionPanel({ onNavigate }: { onNavigate: (section: OwnerOsSection) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    const response = await fetch('/ops/api/attention', { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: Item[]; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Attention queue unavailable');
    setItems(payload.items ?? []);
  }
  useEffect(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'Attention unavailable')); }, []);

  async function resumePaid(item: Item) {
    const response = await fetch('/ops/api/recovery/paid-issue', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentAttemptId: item.targetId }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Recovery failed');
    await refresh();
  }

  return <section className={styles.attention}>
    <div className={styles.panelHead}><div><p>ATTENTION REQUIRED</p><h2>{items.length ? `${items.length} things need you.` : 'Nothing is waiting on you.'}</h2></div><button type="button" onClick={() => void refresh()}>CHECK AGAIN</button></div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {items.map((item) => <article key={`${item.kind}-${item.targetId}`}>
      <div><strong>{item.kind.replaceAll('_',' ')}</strong><span>{item.issueCode ?? item.targetId}</span><p>{item.detail}</p></div>
      <div>
        {item.kind === 'PAID_WITHOUT_ISSUE' ? <button type="button" onClick={() => void resumePaid(item).catch((cause) => setError(cause instanceof Error ? cause.message : 'Recovery failed'))}>RESUME ISSUE CREATION</button> : null}
        <button type="button" onClick={() => onNavigate(SECTION[item.kind] ?? 'Issues')}>OPEN {SECTION[item.kind] ?? 'ISSUES'}</button>
      </div>
    </article>)}
  </section>;
}
