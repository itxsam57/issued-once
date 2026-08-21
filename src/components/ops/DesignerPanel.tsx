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
type DesignMode = 'AUTO' | 'MANUAL' | 'HYBRID';
type DesignPolicy = {
  mode: DesignMode;
  approvalRequired: boolean;
  rejectBehavior: 'AUTO_REGENERATE' | 'WAIT_FOR_OWNER';
  manualUploadApproval: 'AUTO_APPROVE' | 'REQUIRE_OWNER_APPROVAL';
  answerRevealDefault: 'HIDDEN_UNTIL_REVEALED' | 'VISIBLE';
  manufacturingHandoff: 'WAIT_FOR_OWNER' | 'AUTO_CREATE_DRAFT_AFTER_APPROVAL';
  factoryConfirmation: 'NEVER_AUTO_CONFIRM' | 'OWNER_ARMED_ONLY';
};
type EffectivePolicy = { globalVersion: number; override: Partial<DesignPolicy> | null; policy: DesignPolicy };
type RevealedAnswer = { slot: string; prompt: string; answer: unknown };

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload;
}
async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await readJson(response, 'Designer action failed');
}
async function fetchDesignerQueue(): Promise<QueueItem[]> {
  const response = await fetch('/ops/api/designer', { credentials: 'same-origin', cache: 'no-store' });
  const payload = await readJson<{ items?: QueueItem[] }>(response, 'Designer queue unavailable');
  return payload.items ?? [];
}
async function fetchCandidates(issueId: string): Promise<Candidate[]> {
  const response = await fetch(`/ops/api/designer/${encodeURIComponent(issueId)}/candidates`, { credentials: 'same-origin', cache: 'no-store' });
  const payload = await readJson<{ items?: Candidate[] }>(response, 'Candidates unavailable');
  return payload.items ?? [];
}
async function fetchGlobalPolicy(): Promise<DesignPolicy> {
  const response = await fetch('/ops/api/designer/policy', { credentials: 'same-origin', cache: 'no-store' });
  return (await readJson<{ policy: DesignPolicy }>(response, 'Global design policy unavailable')).policy;
}
async function fetchIssuePolicy(issueId: string): Promise<EffectivePolicy> {
  const response = await fetch(`/ops/api/designer/${encodeURIComponent(issueId)}/policy`, { credentials: 'same-origin', cache: 'no-store' });
  return readJson<EffectivePolicy>(response, 'Issue design policy unavailable');
}

const QUICK_REASONS = ['TOO BUSY', 'WRONG MOOD', 'TOO LITERAL', 'TOO GENERIC'] as const;

export function DesignerPanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [globalPolicy, setGlobalPolicy] = useState<DesignPolicy | null>(null);
  const [issuePolicy, setIssuePolicy] = useState<EffectivePolicy | null>(null);
  const [issueMode, setIssueMode] = useState<'INHERIT' | DesignMode>('INHERIT');
  const [reason, setReason] = useState('');
  const [instruction, setInstruction] = useState('');
  const [revealReason, setRevealReason] = useState('Design review');
  const [answers, setAnswers] = useState<RevealedAnswer[] | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [uploadReason, setUploadReason] = useState('Owner artwork replacement');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh() {
    const [next, policy] = await Promise.all([fetchDesignerQueue(), fetchGlobalPolicy()]);
    setItems(next);
    setGlobalPolicy(policy);
    if (selected) {
      const nextSelected = next.find((item) => item.issueId === selected.issueId) ?? null;
      setSelected(nextSelected);
      if (nextSelected) {
        const effective = await fetchIssuePolicy(nextSelected.issueId);
        setIssuePolicy(effective);
        setIssueMode(effective.override?.mode ?? 'INHERIT');
      }
    }
  }
  async function loadCandidates(issueId: string) { setCandidates(await fetchCandidates(issueId)); }

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchDesignerQueue(), fetchGlobalPolicy()])
      .then(([next, policy]) => { if (alive) { setItems(next); setGlobalPolicy(policy); } })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Designer unavailable'); });
    return () => { alive = false; };
  }, []);

  function choose(item: QueueItem) {
    setSelected(item);
    setCandidates([]);
    setIssuePolicy(null);
    setIssueMode('INHERIT');
    setReason('');
    setInstruction('');
    setAnswers(null);
    setArtworkFile(null);
    setError(null);
    setNotice(null);
    void Promise.all([fetchCandidates(item.issueId), fetchIssuePolicy(item.issueId)])
      .then(([nextCandidates, effective]) => {
        setCandidates(nextCandidates);
        setIssuePolicy(effective);
        setIssueMode(effective.override?.mode ?? 'INHERIT');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Designer detail unavailable'));
  }

  async function run(action: () => Promise<void>, success?: string) {
    setWorking(true); setError(null); setNotice(null);
    try {
      await action();
      await refresh();
      if (selected) await loadCandidates(selected.issueId);
      setReason(''); setInstruction('');
      if (success) setNotice(success);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Designer action failed'); }
    finally { setWorking(false); }
  }

  async function saveGlobalPolicy(policy: DesignPolicy) {
    const response = await fetch('/ops/api/designer/policy', {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(policy),
    });
    const saved = await readJson<{ policy: DesignPolicy }>(response, 'Global design policy could not be saved');
    setGlobalPolicy(saved.policy);
  }

  async function saveIssueMode(mode: 'INHERIT' | DesignMode) {
    if (!selected) return;
    const path = `/ops/api/designer/${encodeURIComponent(selected.issueId)}/policy`;
    const response = mode === 'INHERIT'
      ? await fetch(path, { method: 'DELETE', credentials: 'same-origin' })
      : await fetch(path, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode }) });
    const effective = await readJson<EffectivePolicy>(response, 'Issue design mode could not be saved');
    setIssuePolicy(effective);
    setIssueMode(mode);
  }

  async function revealAnswers() {
    if (!selected || !revealReason.trim()) return;
    setWorking(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/ops/api/issues/${encodeURIComponent(selected.issueId)}/reveal`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: 'answers', reason: revealReason.trim() }),
      });
      const payload = await readJson<{ value: RevealedAnswer[] }>(response, 'Answers could not be revealed');
      setAnswers(payload.value);
      setNotice('Answers revealed for this owner session. The reveal was audited.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Answers could not be revealed'); }
    finally { setWorking(false); }
  }

  async function uploadArtwork() {
    if (!selected || !artworkFile || !uploadReason.trim()) return;
    const form = new FormData();
    form.set('file', artworkFile);
    form.set('reason', uploadReason.trim());
    await run(async () => {
      const response = await fetch(`/ops/api/designer/${encodeURIComponent(selected.issueId)}/upload`, {
        method: 'POST', credentials: 'same-origin', body: form,
      });
      await readJson(response, 'Manual artwork upload failed');
      setArtworkFile(null);
    }, 'Manual artwork saved to candidate history.');
  }

  function feedbackReason() {
    return [reason.trim(), instruction.trim()].filter(Boolean).join(' — ');
  }

  return <div>
    <div className={styles.panelHead}><div><p>DESIGNER / STUDIO</p><h1>What each mind became.</h1></div><button type="button" disabled={working} onClick={() => void refresh()}>REFRESH</button></div>

    <section className={styles.detail} aria-label="Global design controls">
      <p>GLOBAL DESIGN MODE</p>
      {!globalPolicy ? <small>LOADING POLICY…</small> : <div className={styles.actionRow}>
        <label>Global design mode
          <select aria-label="Global design mode" value={globalPolicy.mode} disabled={working} onChange={(event) => {
            const next = { ...globalPolicy, mode: event.target.value as DesignMode };
            setGlobalPolicy(next);
            void run(() => saveGlobalPolicy(next), `Global mode set to ${next.mode}.`);
          }}>
            <option value="HYBRID">HYBRID — AI + OWNER</option><option value="AUTO">AUTO — AI FIRST</option><option value="MANUAL">MANUAL — OWNER ART</option>
          </select>
        </label>
        <label>Approval gate
          <select value={globalPolicy.approvalRequired ? 'REQUIRED' : 'AUTOMATIC'} disabled={working} onChange={(event) => {
            const next = { ...globalPolicy, approvalRequired: event.target.value === 'REQUIRED' };
            setGlobalPolicy(next); void run(() => saveGlobalPolicy(next), 'Approval gate updated.');
          }}><option value="REQUIRED">OWNER APPROVAL REQUIRED</option><option value="AUTOMATIC">AUTO APPROVE AFTER QUALITY GATE</option></select>
        </label>
        <label>After rejection
          <select value={globalPolicy.rejectBehavior} disabled={working} onChange={(event) => {
            const next = { ...globalPolicy, rejectBehavior: event.target.value as DesignPolicy['rejectBehavior'] };
            setGlobalPolicy(next); void run(() => saveGlobalPolicy(next), 'Reject behavior updated.');
          }}><option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="AUTO_REGENERATE">AUTO REGENERATE</option></select>
        </label>
        <label>After approval
          <select value={globalPolicy.manufacturingHandoff} disabled={working} onChange={(event) => {
            const next = { ...globalPolicy, manufacturingHandoff: event.target.value as DesignPolicy['manufacturingHandoff'] };
            setGlobalPolicy(next); void run(() => saveGlobalPolicy(next), 'Manufacturing handoff updated.');
          }}><option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="AUTO_CREATE_DRAFT_AFTER_APPROVAL">AUTO CREATE PRINTFUL DRAFT</option></select>
        </label>
      </div>}
    </section>

    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {notice ? <p role="status" className={styles.alert}>{notice}</p> : null}
    <div className={styles.ledgerLayout}>
      <div className={styles.ledgerList}>{items.map((item) => <button key={item.issueId} type="button" aria-pressed={selected?.issueId === item.issueId} onClick={() => choose(item)}>
        <strong>{item.issueCode}</strong><span>{item.designState}</span><span>{item.objectType.toUpperCase()} / {item.sizeCode} / {item.colorCode.toUpperCase()}</span><small>CANDIDATES / {item.candidateCount}</small>
      </button>)}</div>
      <section className={styles.detail}>{!selected ? <p>SELECT A DESIGN</p> : <>
        <p>ISSUE / {selected.issueCode}</p><h2>{selected.designState}</h2>
        <label>This Issue Mode
          <select aria-label="This Issue Mode" value={issueMode} disabled={working || !issuePolicy} onChange={(event) => {
            const mode = event.target.value as 'INHERIT' | DesignMode;
            setIssueMode(mode); void run(() => saveIssueMode(mode), mode === 'INHERIT' ? 'Issue now inherits global design policy.' : `Issue mode set to ${mode}.`);
          }}>
            <option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.mode ?? '…'})</option><option value="HYBRID">HYBRID</option><option value="AUTO">AUTO</option><option value="MANUAL">MANUAL</option>
          </select>
        </label>
        {selected.artworkUrl ? <img className={styles.largeArtwork} src={selected.artworkUrl} alt={`Artwork for ${selected.issueCode}`} /> : <div className={styles.emptyArtwork}>NO ARTWORK YET</div>}
        <p>{selected.width && selected.height ? `${selected.width} × ${selected.height}` : 'DIMENSIONS PENDING'} · {selected.model ?? 'MODEL PENDING'}</p>

        <h3>Private design context</h3>
        <label>Reveal reason<input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} placeholder="Why do you need the answers?" /></label>
        <div className={styles.actionRow}><button disabled={working || !revealReason.trim()} type="button" onClick={() => void revealAnswers()}>{answers ? 'REFRESH REVEALED ANSWERS' : 'REVEAL ANSWERS'}</button>{answers ? <button type="button" onClick={() => setAnswers(null)}>HIDE ANSWERS</button> : null}</div>
        {answers ? <div>{answers.map((entry) => <article key={entry.slot}><small>{entry.slot.toUpperCase()}</small><p>{entry.prompt}</p><strong>{typeof entry.answer === 'string' ? entry.answer : JSON.stringify(entry.answer)}</strong></article>)}</div> : null}

        <h3>Manual artwork</h3>
        <label>Manual artwork PNG<input aria-label="Manual artwork PNG" type="file" accept="image/png,.png" onChange={(event) => setArtworkFile(event.target.files?.[0] ?? null)} /></label>
        <label>Upload reason<input value={uploadReason} onChange={(event) => setUploadReason(event.target.value)} /></label>
        <div className={styles.actionRow}><button disabled={working || !artworkFile || !uploadReason.trim()} type="button" onClick={() => void uploadArtwork()}>UPLOAD PNG</button></div>

        {selected.designState === 'FAILED' ? <div className={styles.actionRow}><button disabled={working} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/retry`, {}), 'Failed design queued for retry.')}>RETRY FAILED DESIGN</button></div> : null}
        {selected.designState === 'REVIEW' ? <>
          <div className={styles.actionRow}><button disabled={working} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/review`, { decision: 'approve' }), 'Design approved.')}>APPROVE</button></div>
          <h3>Feedback</h3>
          <div className={styles.actionRow}>{QUICK_REASONS.map((quick) => <button key={quick} type="button" aria-pressed={reason === quick} disabled={working} onClick={() => setReason(quick)}>{quick}</button>)}</div>
          <label>Revision reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What should change?" /></label>
          <label>Custom design instruction<input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Specific direction for the next pass" /></label>
          <div className={styles.actionRow}>
            <button disabled={working || !feedbackReason()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/rework`, { mode: 'regenerate', reason: feedbackReason() }), 'Artwork regeneration queued.')}>REGENERATE ART</button>
            <button disabled={working || !feedbackReason()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/rework`, { mode: 'reinterpret', reason: feedbackReason() }), 'Reinterpretation queued.')}>REINTERPRET</button>
            <button disabled={working || !feedbackReason()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/review`, { decision: 'revise', next: 'regenerate', reason: feedbackReason() }), 'Design rejected with feedback.')}>REJECT / APPLY POLICY</button>
          </div>
        </> : null}
        <h3>Candidate history</h3>
        <div className={styles.candidateGrid}>{candidates.map((candidate) => <article key={candidate.id} data-selected={candidate.selected || undefined}>
          <img src={candidate.artworkUrl} alt={`${selected.issueCode} candidate`} />
          <small>{candidate.source.replaceAll('_', ' ')} · {candidate.width}×{candidate.height}</small>
          {candidate.safeSummary ? <p>{candidate.safeSummary}</p> : null}
          {candidate.selected ? <strong>SELECTED</strong> : <button type="button" disabled={working || !feedbackReason()} onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/select`, { candidateId: candidate.id, reason: feedbackReason() }), 'Candidate selected.')}>SELECT</button>}
        </article>)}</div>
      </>}</section>
    </div>
  </div>;
}
