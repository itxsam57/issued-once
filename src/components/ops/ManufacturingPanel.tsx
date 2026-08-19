'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type Item = {
  issueId: string; issueCode: string; issueStatus: string; objectType: string; sizeCode: string; colorCode: string;
  designState: string | null; manufacturingState: string | null; providerOrderId: string | null;
  providerStatus: string | null; trackingNumber: string | null; updatedAt: string;
};

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Manufacturing action failed');
}

export function ManufacturingPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [armed, setArmed] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh() {
    const response = await fetch('/ops/api/manufacturing', { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: Item[]; confirmArmed?: boolean; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Manufacturing queue unavailable');
    setItems(payload.items ?? []);
    setArmed(Boolean(payload.confirmArmed));
    if (selected) setSelected((payload.items ?? []).find((item) => item.issueId === selected.issueId) ?? null);
  }

  useEffect(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'Manufacturing unavailable')); }, []);
  useEffect(() => { setConfirmation(''); setReason(''); }, [selected?.issueId]);

  async function run(action: () => Promise<void>) {
    setWorking(true); setError(null);
    try { await action(); await refresh(); setConfirmation(''); setReason(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Manufacturing action failed'); }
    finally { setWorking(false); }
  }

  return (
    <div>
      <div className={styles.panelHead}>
        <div><p>MANUFACTURING / CONTROL</p><h1>What is becoming physical.</h1></div>
        <div><span>{armed ? 'FACTORY CONFIRM / ARMED' : 'FACTORY CONFIRM / SAFE'}</span><button type="button" onClick={() => void refresh()}>REFRESH</button></div>
      </div>
      {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
      <div className={styles.ledgerLayout}>
        <div className={styles.ledgerList}>
          {items.map((item) => <button key={item.issueId} type="button" aria-pressed={selected?.issueId === item.issueId} onClick={() => setSelected(item)}>
            <strong>{item.issueCode}</strong>
            <span>{item.manufacturingState ?? item.issueStatus}</span>
            <span>{item.objectType.toUpperCase()} / {item.sizeCode} / {item.colorCode.toUpperCase()}</span>
            <small>{item.providerOrderId ? `PRINTFUL / ${item.providerOrderId}` : 'NO PRINTFUL ORDER'}</small>
          </button>)}
        </div>
        <section className={styles.detail}>
          {!selected ? <p>SELECT AN ISSUE</p> : <>
            <p>ISSUE / {selected.issueCode}</p><h2>{selected.manufacturingState ?? selected.issueStatus}</h2>
            <div className={styles.detailGrid}>
              <div><span>DESIGN</span><strong>{selected.designState ?? 'NOT YET'}</strong></div>
              <div><span>PRINTFUL</span><strong>{selected.providerOrderId ?? 'NOT YET'}</strong></div>
              <div><span>PROVIDER STATE</span><strong>{selected.providerStatus ?? 'NOT YET'}</strong></div>
              <div><span>TRACKING</span><strong>{selected.trackingNumber ?? 'NOT YET'}</strong></div>
            </div>
            {selected.issueStatus === 'DESIGN_APPROVED' && (!selected.manufacturingState || selected.manufacturingState === 'FAILED') ?
              <button disabled={working} type="button" onClick={() => void run(() => post('/ops/api/manufacturing/create-draft', { issueId: selected.issueId }))}>CREATE / RETRY PRINTFUL DRAFT</button> : null}
            {selected.manufacturingState === 'DRAFT' ? <div className={styles.confirmBox}>
              <p>Confirming charges/submits the Printful draft. The server also requires the factory kill switch.</p>
              <strong>TYPE: CONFIRM {selected.issueCode}</strong>
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              <button disabled={working || !armed || confirmation !== `CONFIRM ${selected.issueCode}`} type="button" onClick={() => void run(() => post('/ops/api/manufacturing/confirm', { issueId: selected.issueId, confirmation }))}>CONFIRM PRODUCTION</button>
            </div> : null}
            {['DESIGN_APPROVED','MANUFACTURING_DRAFT'].includes(selected.issueStatus) ? <div className={styles.quarantineBox}>
              <label>Reason to quarantine<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why should this stop?" /></label>
              <button disabled={working || !reason.trim()} type="button" onClick={() => void run(() => post('/ops/api/manufacturing/quarantine', { issueId: selected.issueId, reason }))}>QUARANTINE</button>
            </div> : null}
          </>}
        </section>
      </div>
    </div>
  );
}
