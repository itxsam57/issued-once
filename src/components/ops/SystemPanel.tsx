'use client';

import { useState } from 'react';
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
  const [qaUrl, setQaUrl] = useState<string | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaWorking, setQaWorking] = useState(false);
  const data = live.data;
  const safepaySandboxReady = data?.checks.some((check) => check.key === 'safepay' && check.state === 'configured') ?? false;

  async function startSandboxQa() {
    setQaWorking(true);
    setQaError(null);
    setQaUrl(null);
    try {
      const response = await fetch('/ops/api/safepay-sandbox/session', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { active?: boolean; url?: string; error?: string };
      if (!response.ok || payload.active !== true || payload.url !== '/begin?qa=safepay') {
        throw new Error(payload.error || 'Safepay sandbox QA could not be started');
      }
      setQaUrl(payload.url);
    } catch (cause) {
      setQaError(cause instanceof Error ? cause.message : 'Safepay sandbox QA could not be started');
    } finally {
      setQaWorking(false);
    }
  }

  return <div>
    <div className={styles.panelHead}><div><p>SYSTEM / PROVIDERS</p><h1>What can actually run.</h1></div><button type="button" onClick={() => void live.refresh()}>CHECK AGAIN</button></div>
    {live.error ? <p role="alert" className={styles.alert}>{live.error}</p> : null}
    {qaError ? <p role="alert" className={styles.alert}>{qaError}</p> : null}
    {!data ? <p>CHECKING SYSTEM</p> : <>
      <p className={styles.systemSignal}>{data.readyForProduction ? 'PRODUCTION READY' : data.readyForSandbox ? 'SANDBOX READY' : 'NOT READY'} / {new Date(data.checkedAt).toLocaleString()}</p>
      <div className={styles.systemGrid}>{data.checks.map((check) => <article key={check.key} data-state={check.state}><div><strong>{check.label}</strong><b>{check.state.toUpperCase()}</b></div><p>{check.detail}</p></article>)}</div>
      {safepaySandboxReady ? <div className={styles.actionRow}>
        <button type="button" disabled={qaWorking} onClick={() => void startSandboxQa()}>{qaWorking ? 'STARTING SANDBOX QA' : 'START SAFEPAY SANDBOX QA'}</button>
        {qaUrl ? <a href={qaUrl}>OPEN SANDBOX CUSTOMER</a> : null}
      </div> : null}
      <p className={styles.privacyFlags}>Production never turns green from configuration alone. Public merchant disclosure plus signed payment, mail, queue, artwork, factory and delivery evidence still govern launch.</p>
    </>}
  </div>;
}
