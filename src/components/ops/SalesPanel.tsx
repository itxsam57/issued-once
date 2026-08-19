'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type Snapshot = {
  days: number; currency: string | null; grossMinor: number; refundedMinor: number; netAfterRefundMinor: number; paidOrders: number; averageOrderMinor: number;
  failedPayments: number; exceptionPayments: number;
  byProduct: Array<{ key: string; orders: number }>;
  byCountry: Array<{ key: string; orders: number }>;
  funnel: { started: number; answered: number; physical: number; verified: number; shipping: number; checkout: number; paid: number };
};

function money(minor: number, currency: string | null) {
  if (!currency) return minor === 0 ? '—' : `${(minor / 100).toFixed(2)} / CURRENCY UNKNOWN`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
}

export function SalesPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    fetch(`/ops/api/sales?days=${days}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as Snapshot & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Sales unavailable');
        return payload;
      })
      .then((value) => { if (alive) setData(value); })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Sales unavailable'); });
    return () => { alive = false; };
  }, [days]);

  return <div>
    <div className={styles.panelHead}>
      <div><p>SALES / CANONICAL</p><h1>What actually sold.</h1></div>
      <select aria-label="Sales window" value={days} onChange={(event) => setDays(Number(event.target.value))}>
        <option value={7}>7 DAYS</option><option value={30}>30 DAYS</option><option value={90}>90 DAYS</option><option value={3650}>LIFETIME</option>
      </select>
    </div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {!data ? <p>READING SALES</p> : <>
      <div className={styles.metricGrid}>
        <article><span>PAID ORDERS</span><strong>{data.paidOrders}</strong></article>
        <article><span>GROSS</span><strong>{money(data.grossMinor, data.currency)}</strong></article>
        <article><span>REFUNDED</span><strong>{money(data.refundedMinor, data.currency)}</strong></article>
        <article><span>NET AFTER REFUNDS</span><strong>{money(data.netAfterRefundMinor, data.currency)}</strong></article>
      </div>
      <div className={styles.metricGrid}>
        <article><span>AVERAGE ORDER</span><strong>{money(data.averageOrderMinor, data.currency)}</strong></article>
        <article><span>FAILED PAYMENTS</span><strong>{data.failedPayments}</strong></article>
        <article><span>PAYMENT EXCEPTIONS</span><strong>{data.exceptionPayments}</strong></article>
        <article><span>PAID CONVERSION</span><strong>{data.funnel.started ? `${Math.round((data.funnel.paid / data.funnel.started) * 100)}%` : '—'}</strong></article>
      </div>
      <section className={styles.funnel}>
        <h2>Journey</h2>
        {Object.entries(data.funnel).map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ').toUpperCase()}</span><strong>{value}</strong><i style={{ width: `${data.funnel.started ? Math.max(2, (value / data.funnel.started) * 100) : 2}%` }} /></div>)}
      </section>
      <div className={styles.twoColumn}>
        <section><h2>Forms</h2>{data.byProduct.map((row) => <div className={styles.statRow} key={row.key}><span>{row.key.toUpperCase()}</span><strong>{row.orders}</strong></div>)}</section>
        <section><h2>Countries</h2>{data.byCountry.map((row) => <div className={styles.statRow} key={row.key}><span>{row.key}</span><strong>{row.orders}</strong></div>)}</section>
      </div>
    </>}
  </div>;
}
