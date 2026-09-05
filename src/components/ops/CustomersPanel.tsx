'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveResource } from './useLiveResource';
import styles from './owner-os.module.css';

type Customer = {
  contactAlias: string; issueCount: number; currency: string | null; paidMinor: number | null; refundedIssues: number;
  activeDeliveries: number; supportCount: number; lastSeenAt: string;
};
type CustomerPage = { items: Customer[]; nextCursor: string | null };

function lifetimeValue(customer: Customer) {
  if (customer.currency === null || customer.paidMinor === null) return 'MULTI-CURRENCY';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: customer.currency }).format(customer.paidMinor / 100);
}

async function fetchCustomers(email: string, cursor: string | null = null): Promise<CustomerPage> {
  const params = new URLSearchParams();
  if (email.trim()) params.set('email', email.trim());
  if (cursor) params.set('cursor', cursor);
  const response = await fetch(`/ops/api/customers?${params}`, { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json() as { items?: Customer[]; nextCursor?: string | null; error?: string };
  if (!response.ok) throw new Error(payload.error || 'Customers unavailable');
  return { items: payload.items ?? [], nextCursor: payload.nextCursor ?? null };
}

export function CustomersPanel() {
  const [email, setEmail] = useState('');
  const [items, setItems] = useState<Customer[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [appendError, setAppendError] = useState<string | null>(null);
  const firstPageCount = useRef(0);
  const loadedMore = useRef(false);
  const firstQuery = useRef(true);
  const load = useCallback(() => fetchCustomers(email), [email]);
  const { data: liveData, error: liveError, refresh } = useLiveResource({ load, intervalMs: 30_000 });

  useEffect(() => {
    if (!liveData) return;
    const page = liveData;
    setItems((current) => {
      const tail = loadedMore.current ? current.slice(firstPageCount.current) : [];
      const firstIds = new Set(page.items.map((item) => `${item.contactAlias}:${item.lastSeenAt}`));
      firstPageCount.current = page.items.length;
      return [...page.items, ...tail.filter((item) => !firstIds.has(`${item.contactAlias}:${item.lastSeenAt}`))];
    });
    if (!loadedMore.current) setCursor(page.nextCursor);
  }, [liveData]);

  useEffect(() => {
    if (firstQuery.current) {
      firstQuery.current = false;
      return;
    }
    loadedMore.current = false;
    firstPageCount.current = 0;
    setItems([]);
    setCursor(null);
    setAppendError(null);
    const timer = window.setTimeout(() => void refresh(), 200);
    return () => window.clearTimeout(timer);
  }, [email, refresh]);

  async function loadMore() {
    if (!cursor) return;
    try {
      const page = await fetchCustomers(email, cursor);
      loadedMore.current = true;
      setItems((current) => {
        const known = new Set(current.map((item) => `${item.contactAlias}:${item.lastSeenAt}`));
        return [...current, ...page.items.filter((item) => !known.has(`${item.contactAlias}:${item.lastSeenAt}`))];
      });
      setCursor(page.nextCursor);
      setAppendError(null);
    } catch (cause) {
      setAppendError(cause instanceof Error ? cause.message : 'Customers unavailable');
    }
  }

  const error = appendError ?? liveError;
  return <div>
    <div className={styles.panelHead}>
      <div><p>CUSTOMERS / CONTACT GROUPS</p><h1>People, without turning them into profiles.</h1></div>
      <div className={styles.actionRow}>
        <input aria-label="Find customer by verified email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Find by verified email" />
        <button type="button" onClick={() => void refresh()}>REFRESH</button>
      </div>
    </div>
    <p className={styles.privacyFlags}>Search is HMAC-matched server-side. Plain email is not returned in this list. Reveal contact data only from a specific Issue.</p>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    <div className={styles.customerGrid}>
      {items.map((customer) => <article key={`${customer.contactAlias}-${customer.lastSeenAt}`}>
        <strong>{customer.contactAlias}</strong>
        <div><span>ISSUES</span><b>{customer.issueCount}</b></div>
        <div><span>PAID VALUE</span><b>{lifetimeValue(customer)}</b></div>
        <div><span>ACTIVE DELIVERY</span><b>{customer.activeDeliveries}</b></div>
        <div><span>REFUNDED</span><b>{customer.refundedIssues}</b></div>
        <div><span>SUPPORT</span><b>{customer.supportCount}</b></div>
        <small>LAST ACTIVITY / {new Date(customer.lastSeenAt).toLocaleString()}</small>
      </article>)}
    </div>
    {cursor ? <button type="button" onClick={() => void loadMore()}>LOAD MORE</button> : null}
  </div>;
}
