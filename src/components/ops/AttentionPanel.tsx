'use client';

import { useState } from 'react';
import type { OwnerOsSection } from './OwnerOsShell';
import { useLiveResource } from './useLiveResource';
import styles from './owner-os.module.css';

type Item = { kind: string; priority: number; issueId: string | null; issueCode: string | null; targetId: string; detail: string; createdAt: string };
const SECTION: Record<string, OwnerOsSection> = {
  PAID_WITHOUT_ISSUE: 'Issues', PAYMENT_EXCEPTION: 'Issues', FACTORY_MAPPING_MISSING: 'System',
  PROVIDER_STATE_MISMATCH: 'Manufacturing', DESIGN_FAILED: 'Designer', DESIGN_STUCK: 'Designer',
  MANUFACTURING_FAILED: 'Manufacturing', NOTIFICATION_FAILED: 'Support', SUPPORT_AGING: 'Support',
};

async function fetchAttention(): Promise<Item[]> {
  const response = await fetch('/ops/api/attention', { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json() as { items?: Item[]; error?: string };
  if (!response.ok) throw new Error(payload.error || 'Attention queue unavailable');
  return payload.items ?? [];
}

export function AttentionPanel({ onNavigate }: { onNavigate: (section: OwnerOsSection) => void }) {
  const live = useLiveResource({ load: fetchAttention, intervalMs: 10_000 });
  const [actionError, setActionError] = useState<string | null>(null);
  const items = live.data ?? [];
  const error = actionError ?? live.error;

  async function resumePaid(item: Item) {
    const response = await fetch('/ops/api/recovery/paid-issue', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentAttemptId: item.targetId }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Recovery failed');
    await live.refresh();
  }

  return <section className={styles.attention}>
    <div className={styles.panelHead}><div><p>ATTENTION REQUIRED</p><h2>{items.length ? `${items.length} things need you.` : 'Nothing is waiting on you.'}</h2></div><button type="button" onClick={() => void live.refresh()}>CHECK AGAIN</button></div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {items.map((item) => {
      const section = SECTION[item.kind] ?? 'Issues';
      return <article key={`${item.kind}-${item.targetId}`}>
        <div><strong>{item.kind.replaceAll('_',' ')}</strong><span>{item.issueCode ?? item.targetId}</span><p>{item.detail}</p></div>
        <div>
          {item.kind === 'PAID_WITHOUT_ISSUE' ? <button type="button" onClick={() => void resumePaid(item).catch((cause) => setActionError(cause instanceof Error ? cause.message : 'Recovery failed'))}>RESUME ISSUE CREATION</button> : null}
          <button type="button" onClick={() => onNavigate(section)}>OPEN {section.toUpperCase()}</button>
        </div>
      </article>;
    })}
  </section>;
}
