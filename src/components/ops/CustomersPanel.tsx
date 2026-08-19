'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type Customer = {
  contactAlias: string; issueCount: number; currency: string | null; paidMinor: number | null; refundedIssues: number;
  activeDeliveries: number; supportCount: number; lastSeenAt: string;
};

function lifetimeValue(customer: Customer) {
  if (customer.currency === null || customer.paidMinor === null) return 'MULTI-CURRENCY';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: customer.currency }).format(customer.paidMinor / 100);
}

export function CustomersPanel() {
  const [email, setEmail] = useState('');
  const [items, setItems] = useState<Customer[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(next: string | null = null, append = false) {
    const params = new URLSearchParams();
    if (email.trim()) params.set('email', email.trim());
    if (next) params.set('cursor', next);
    const response = await fetch(`/ops/api/customers?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: Customer[]; nextCursor?: string | null; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Customers unavailable');
    setItems((current) => append ? [...current, ...(payload.items ?? [])] : (payload.items ?? []));
    setCursor(payload.nextCursor ?? null);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Customers unavailable')), 200);
    return () => window.clearTimeout(timer);
  }, [email]);

  return <div>
    <div className={styles.panelHead}>
      <div><p>CUSTOMERS / CONTACT GROUPS</p><h1>People, without turning them into profiles.</h1></div>
      <input aria-label="Find customer by verified email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Find by verified email" />
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
    {cursor ? <button type="button" onClick={() => void load(cursor, true)}>LOAD MORE</button> : null}
  </div>;
}
