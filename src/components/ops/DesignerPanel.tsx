'use client';

import { useEffect, useState } from 'react';
import styles from './owner-os.module.css';

type QueueItem = {
  issueId: string; issueCode: string; issueStatus: string; objectType: string; sizeCode: string; colorCode: string;
  designJobId: string; designState: string; artworkUrl: string | null; width: number | null; height: number | null;
  provider: string | null; model: string | null; candidateCount: number; updatedAt: string;
};

type Candidate = {
  id: string; issueId: string; generationKey: string; source: string; artworkUrl: string;
  width: number; height: number; provider: string; model: string; safeSummary: string | null; selected: boolean; createdAt: string;
};

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Designer action failed');
}

export function DesignerPanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh() {
    const response = await fetch('/ops/api/designer', { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: QueueItem[]; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Designer queue unavailable');
    setItems(payload.items ?? []);
    if (selected) setSelected((payload.items ?? []).find((item) => item.issueId === selected.issueId) ?? null);
  }

  async function loadCandidates(issueId: string) {
    const response = await fetch(`/ops/api/designer/${encodeURIComponent(issueId)}/candidates`, { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as { items?: Candidate[]; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Candidates unavailable');
    setCandidates(payload.items ?? []);
  }

  useEffect(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'Designer unavailable')); }, []);
  useEffect(() => { setCandidates([]); setReason(''); if (selected) void loadCandidates(selected.issueId).catch((cause) => setError(cause instanceof Error ? cause.message : 'Candidates unavailable')); }, [selected?.issueId]);

  async function run(action: () => Promise<void>) {
    setWorking(true); setError(null);
    try { await action(); await refresh(); if (selected) await loadCandidates(selected.issueId); setReason(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Designer action failed'); }
    finally { setWorking(false); }
  }

  return (
    <div>
      <div className={styles.panelHead}><div><p>DESIGNER / STUDIO</p><h1>What each mind became.</h1></div><button type="button" onClick={() => void refresh()}>REFRESH</button></div>
      {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
      <div className={styles.ledgerLayout}>
        <div className={styles.ledgerList}>
          {items.map((item) => (
            <button key={item.issueId} type="button" aria-pressed={selected?.issueId === item.issueId} onClick={() => setSelected(item)}>
              <strong>{item.issueCode}</strong><span>{item.designState}</span><span>{item.objectType.toUpperCase()} / {item.sizeCode} / {item.colorCode.toUpperCase()}</span><small>CANDIDATES / {item.candidateCount}</small>
            </button>
          ))}
        </div>
        <section className={styles.detail}>
          {!selected ? <p>SELECT A DESIGN</p> : <>
            <p>ISSUE / {selected.issueCode}</p><h2>{selected.designState}</h2>
            {selected.artworkUrl ? <img className={styles.largeArtwork} src={selected.artworkUrl} alt={`Artwork for ${selected.issueCode}`} /> : <div className={styles.emptyArtwork}>NO ARTWORK YET</div>}
            <p>{selected.width && selected.height ? `${selected.width} × ${selected.height}` : 'DIMENSIONS PENDING'} · {selected.model ?? 'MODEL PENDING'}</p>
            {selected.designState === 'FAILED' ? <div className={styles.actionRow}><button disabled={working} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/retry`, {}))}>RETRY FAILED DESIGN</button></div> : null}
            {selected.designState === 'REVIEW' ? <>
              <div className={styles.actionRow}><button disabled={working} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/review`, { decision: 'approve' }))}>APPROVE</button></div>
              <label>Reason for revision<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What should change?" /></label>
              <div className={styles.actionRow}>
                <button disabled={working || !reason.trim()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/rework`, { mode: 'regenerate', reason }))}>REGENERATE ART</button>
                <button disabled={working || !reason.trim()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/rework`, { mode: 'reinterpret', reason }))}>REINTERPRET</button>
                <button disabled={working || !reason.trim()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/review`, { decision: 'revise', next: 'regenerate', reason }))}>REVISE</button>
              </div>
            </> : null}
            <h3>Candidate history</h3>
            <div className={styles.candidateGrid}>
              {candidates.map((candidate) => <article key={candidate.id} data-selected={candidate.selected || undefined}>
                <img src={candidate.artworkUrl} alt={`${selected.issueCode} candidate`} />
                <small>{candidate.source.replaceAll('_', ' ')} · {candidate.width}×{candidate.height}</small>
                {candidate.selected ? <strong>SELECTED</strong> : <button type="button" disabled={working || !reason.trim()} onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/select`, { candidateId: candidate.id, reason }))}>SELECT</button>}
              </article>)}
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}
