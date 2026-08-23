'use client';

import styles from './owner-os.module.css';
import { useLiveResource } from './useLiveResource';

type Dashboard = {
  sales: {
    currency: string | null;
    today: { orders: number; grossMinor: number };
    sevenDays: { orders: number; grossMinor: number };
    thirtyDays: { orders: number; grossMinor: number };
    lifetime: { orders: number; grossMinor: number };
    refundedMinor: number;
    averageOrderMinor: number;
  };
  operations: {
    paidIssues: number;
    designing: number;
    review: number;
    production: number;
    transit: number;
    delivered: number;
  };
  attention: {
    paymentExceptions: number;
    designFailures: number;
    manufacturingFailures: number;
    notificationFailures: number;
    supportOpen: number;
  };
  activity: Array<{ issueCode: string; eventType: string; source: string; createdAt: string }>;
};

function money(minor: number, currency: string | null) {
  if (!currency) return minor === 0 ? '—' : `${(minor / 100).toFixed(2)} / CURRENCY UNKNOWN`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
}

async function fetchDashboard(): Promise<Dashboard> {
  const response = await fetch('/ops/api/dashboard', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Dashboard unavailable');
  return response.json() as Promise<Dashboard>;
}

export function HomePanel() {
  const {
    data: dashboard,
    error,
    loading,
    updatedAt,
    refresh,
  } = useLiveResource({ load: fetchDashboard, intervalMs: 10_000 });

  if (!dashboard && error) return <p role="alert">{error}</p>;
  if (!dashboard) return <p>READING BUSINESS</p>;

  const attention = Object.values(dashboard.attention).reduce((sum, value) => sum + value, 0);
  return (
    <div>
      <div>
        <p>ISSUED ONCE / LIVE BUSINESS</p>
        <h1>What requires attention now.</h1>
        <p aria-live="polite">
          {updatedAt ? `UPDATED ${updatedAt.toLocaleTimeString()}` : 'SYNCING'}
          {' · '}
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'REFRESHING' : 'REFRESH'}
          </button>
        </p>
      </div>
      {error ? <p role="alert">{error} · showing the last confirmed snapshot.</p> : null}
      <div className={styles.metricGrid}>
        <article><span>TODAY</span><strong>{dashboard.sales.today.orders}</strong><small>{money(dashboard.sales.today.grossMinor, dashboard.sales.currency)}</small></article>
        <article><span>7 DAYS</span><strong>{dashboard.sales.sevenDays.orders}</strong><small>{money(dashboard.sales.sevenDays.grossMinor, dashboard.sales.currency)}</small></article>
        <article><span>30 DAYS</span><strong>{dashboard.sales.thirtyDays.orders}</strong><small>{money(dashboard.sales.thirtyDays.grossMinor, dashboard.sales.currency)}</small></article>
        <article><span>ATTENTION</span><strong>{attention}</strong><small>owner actions</small></article>
      </div>
      <div className={styles.metricGrid}>
        <article><span>DESIGNING</span><strong>{dashboard.operations.designing}</strong></article>
        <article><span>REVIEW</span><strong>{dashboard.operations.review}</strong></article>
        <article><span>PRODUCTION</span><strong>{dashboard.operations.production}</strong></article>
        <article><span>IN TRANSIT</span><strong>{dashboard.operations.transit}</strong></article>
      </div>
      <section className={styles.activity}>
        <h2>Live activity</h2>
        {dashboard.activity.length === 0 ? <p>NO ISSUE EVENTS YET</p> : dashboard.activity.map((event) => (
          <div key={`${event.issueCode}-${event.createdAt}-${event.eventType}`}>
            <strong>{event.issueCode}</strong>
            <span>{event.eventType.replaceAll('_', ' ')}</span>
            <small>{new Date(event.createdAt).toLocaleString()}</small>
          </div>
        ))}
      </section>
    </div>
  );
}
