'use client';

import { useLiveResource } from './useLiveResource';
import styles from './owner-os.module.css';

type Check = { key: string; label: string; state: 'ready'|'configured'|'missing'|'blocked'|'safe'|'armed'; detail: string };
type Readiness = { checkedAt: string; checks: Check[]; readyForSandbox: boolean; readyForProduction: boolean };

async function fetchReadiness(): Promise<Readiness> {
  const response = await fetch('/ops/api/readiness', { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json() as Readiness & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'System readiness unavailable');
  return payload;
}

export function SystemPanel() {
  const live = useLiveResource({ load: fetchReadiness, intervalMs: 15_000 });
  const data = live.data;
  return <div>
    <div className={styles.panelHead}><div><p>SYSTEM / PROVIDERS</p><h1>What can actually run.</h1></div><button type="button" onClick={() => void live.refresh()}>CHECK AGAIN</button></div>
    {live.error ? <p role="alert" className={styles.alert}>{live.error}</p> : null}
    {!data ? <p>CHECKING SYSTEM</p> : <>
      <p className={styles.systemSignal}>{data.readyForProduction ? 'PRODUCTION READY' : data.readyForSandbox ? 'SANDBOX READY' : 'NOT READY'} / {new Date(data.checkedAt).toLocaleString()}</p>
      <div className={styles.systemGrid}>{data.checks.map((check) => <article key={check.key} data-state={check.state}><div><strong>{check.label}</strong><b>{check.state.toUpperCase()}</b></div><p>{check.detail}</p></article>)}</div>
      <p className={styles.privacyFlags}>Production never turns green from configuration alone. Public merchant disclosure plus signed payment, mail, queue, artwork, factory and delivery evidence still govern launch.</p>
    </>}
  </div>;
}
