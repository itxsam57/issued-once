'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type Check = { key: string; label: string; state: 'ready'|'configured'|'missing'|'blocked'|'safe'|'armed'; detail: string };
type Readiness = { checkedAt: string; checks: Check[]; readyForSandbox: boolean; readyForProduction: boolean };

export function SystemPanel() {
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    const response = await fetch('/ops/api/readiness', { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as Readiness & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'System readiness unavailable');
    setData(payload);
  }
  useEffect(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'System unavailable')); }, []);
  return <div>
    <div className={styles.panelHead}><div><p>SYSTEM / PROVIDERS</p><h1>What can actually run.</h1></div><button type="button" onClick={() => void refresh()}>CHECK AGAIN</button></div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {!data ? <p>CHECKING SYSTEM</p> : <>
      <p className={styles.systemSignal}>{data.readyForProduction ? 'PRODUCTION READY' : data.readyForSandbox ? 'SANDBOX READY' : 'NOT READY'} / {new Date(data.checkedAt).toLocaleString()}</p>
      <div className={styles.systemGrid}>{data.checks.map((check) => <article key={check.key} data-state={check.state}>
        <div><strong>{check.label}</strong><b>{check.state.toUpperCase()}</b></div><p>{check.detail}</p>
      </article>)}</div>
      <p className={styles.privacyFlags}>Production never turns green from configuration alone. Signed payment, mail, queue, artwork, factory and delivery evidence still govern launch.</p>
    </>}
  </div>;
}
