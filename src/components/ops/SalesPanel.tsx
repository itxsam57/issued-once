'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveResource } from './useLiveResource';
import styles from './owner-os.module.css';

type Snapshot = {
  days: number; currency: string | null; grossMinor: number; refundedMinor: number; netAfterRefundMinor: number; paidOrders: number; averageOrderMinor: number;
  failedPayments: number; exceptionPayments: number; byProduct: Array<{ key: string; orders: number }>; bySize: Array<{ key: string; orders: number }>;
  byColor: Array<{ key: string; orders: number }>; byCountry: Array<{ key: string; orders: number }>;
  timing: { averageHoursStartToPaid: number | null; averageHoursPaidToProduction: number | null; averageHoursProductionToDelivered: number | null };
  funnel: { started: number; answered: number; physical: number; verified: number; shipping: number; checkout: number; paid: number };
};

function money(minor: number, currency: string | null) {
  if (!currency) return minor === 0 ? '—' : `${(minor / 100).toFixed(2)} / CURRENCY UNKNOWN`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
}
function duration(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
async function fetchSales(days: number): Promise<Snapshot> {
  const response = await fetch(`/ops/api/sales?days=${days}`, { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json() as Snapshot & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Sales unavailable');
  return payload;
}

export function SalesPanel() {
  const [days, setDays] = useState(30);
  const previousDays = useRef(days);
  const load = useCallback(() => fetchSales(days), [days]);
  const { data, error, refresh } = useLiveResource({ load, intervalMs: 20_000 });

  useEffect(() => {
    if (previousDays.current === days) return;
    previousDays.current = days;
    void refresh();
  }, [days, refresh]);
  return <div>
    <div className={styles.panelHead}>
      <div><p>SALES / CANONICAL</p><h1>What actually sold.</h1></div>
      <div className={styles.actionRow}>
        <select aria-label="Sales window" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          <option value={7}>7 DAYS</option><option value={30}>30 DAYS</option><option value={90}>90 DAYS</option><option value={3650}>LIFETIME</option>
        </select>
        <button type="button" onClick={() => void refresh()}>REFRESH</button>
      </div>
    </div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {!data ? <p>READING SALES</p> : <>
      <div className={styles.metricGrid}>
        <article><span>PAID ORDERS</span><strong>{data.paidOrders}</strong></article><article><span>GROSS</span><strong>{money(data.grossMinor, data.currency)}</strong></article>
        <article><span>REFUNDED</span><strong>{money(data.refundedMinor, data.currency)}</strong></article><article><span>NET AFTER REFUNDS</span><strong>{money(data.netAfterRefundMinor, data.currency)}</strong></article>
      </div>
      <div className={styles.metricGrid}>
        <article><span>AVERAGE ORDER</span><strong>{money(data.averageOrderMinor, data.currency)}</strong></article><article><span>FAILED PAYMENTS</span><strong>{data.failedPayments}</strong></article>
        <article><span>PAYMENT EXCEPTIONS</span><strong>{data.exceptionPayments}</strong></article><article><span>PAID CONVERSION</span><strong>{data.funnel.started ? `${Math.round((data.funnel.paid / data.funnel.started) * 100)}%` : '—'}</strong></article>
      </div>
      <div className={styles.metricGrid}>
        <article><span>START → PAID</span><strong>{duration(data.timing.averageHoursStartToPaid)}</strong></article><article><span>PAID → PRODUCTION</span><strong>{duration(data.timing.averageHoursPaidToProduction)}</strong></article>
        <article><span>PRODUCTION → DELIVERED</span><strong>{duration(data.timing.averageHoursProductionToDelivered)}</strong></article><article><span>WINDOW</span><strong>{data.days === 3650 ? 'LIFETIME' : `${data.days}D`}</strong></article>
      </div>
      <section className={styles.funnel}><h2>Journey</h2>{Object.entries(data.funnel).map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ').toUpperCase()}</span><strong>{value}</strong><i style={{ width: `${data.funnel.started ? Math.max(2, (value / data.funnel.started) * 100) : 2}%` }} /></div>)}</section>
      <div className={styles.twoColumn}>
        <section><h2>Forms</h2>{data.byProduct.map((row) => <div className={styles.statRow} key={row.key}><span>{row.key.toUpperCase()}</span><strong>{row.orders}</strong></div>)}</section>
        <section><h2>Countries</h2>{data.byCountry.map((row) => <div className={styles.statRow} key={row.key}><span>{row.key}</span><strong>{row.orders}</strong></div>)}</section>
        <section><h2>Sizes</h2>{data.bySize.map((row) => <div className={styles.statRow} key={row.key}><span>{row.key}</span><strong>{row.orders}</strong></div>)}</section>
        <section><h2>Base colours</h2>{data.byColor.map((row) => <div className={styles.statRow} key={row.key}><span>{row.key.toUpperCase()}</span><strong>{row.orders}</strong></div>)}</section>
      </div>
    </>}
  </div>;
}
