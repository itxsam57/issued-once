'use client';

import { useState } from 'react';
import styles from './owner-os.module.css';
import { useLiveResource } from './useLiveResource';

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
  manualUploadApproval: 'AUTO_APPROVE' | 'REQUIRE_APPROVAL';
  answerRevealDefault: 'HIDDEN_UNTIL_REVEALED' | 'VISIBLE';
  manufacturingHandoff: 'WAIT_FOR_OWNER' | 'AUTO_CREATE_DRAFT_AFTER_APPROVAL';
  factoryConfirmation: 'WAIT_FOR_OWNER' | 'ALLOW_AUTOMATION_WHEN_ARMED';
};
type EffectivePolicy = { globalVersion: number; override: Partial<DesignPolicy> | null; policy: DesignPolicy };
type RevealedAnswer = { slot: string; prompt: string; answer: unknown };
type ReadinessCheck = { key: string; label: string; state: 'ready' | 'configured' | 'missing' | 'blocked' | 'safe' | 'armed'; detail: string };
type Readiness = { checkedAt: string; checks: ReadinessCheck[]; readyForSandbox: boolean; readyForProduction: false };
type DesignerSnapshot = { items: QueueItem[]; policy: DesignPolicy; readiness: Readiness };

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
async function fetchReadiness(): Promise<Readiness> {
  const response = await fetch('/ops/api/readiness', { credentials: 'same-origin', cache: 'no-store' });
  return readJson<Readiness>(response, 'Design runtime readiness unavailable');
}
async function fetchDesignerSnapshot(): Promise<DesignerSnapshot> {
  const [items, policy, readiness] = await Promise.all([fetchDesignerQueue(), fetchGlobalPolicy(), fetchReadiness()]);
  return { items, policy, readiness };
}

const QUICK_REASONS = ['TOO BUSY', 'TOO LITERAL', 'WEAK CONCEPT', 'WRONG MOOD', 'TYPOGRAPHY', 'PLACEMENT', 'NOT WEARABLE', 'OTHER'] as const;

export function DesignerPanel() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [issuePolicy, setIssuePolicy] = useState<EffectivePolicy | null>(null);
  const [reason, setReason] = useState('');
  const [instruction, setInstruction] = useState('');
  const [revealReason, setRevealReason] = useState('Design review');
  const [answers, setAnswers] = useState<RevealedAnswer[] | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [uploadReason, setUploadReason] = useState('Owner artwork replacement');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const live = useLiveResource<DesignerSnapshot>({ load: fetchDesignerSnapshot, intervalMs: 15_000 });
  const items = live.data?.items ?? [];
  const globalPolicy = live.data?.policy ?? null;
  const readiness = live.data?.readiness ?? null;
  const selected = selectedId ? items.find((item) => item.issueId === selectedId) ?? null : null;

  const readinessCheck = (key: string) => readiness?.checks.find((check) => check.key === key);
  const openAI = readinessCheck('openai');
  const blob = readinessCheck('blob');
  const queues = readinessCheck('queues');
  const factorySwitch = readinessCheck('factory-confirm');
  const aiReady = openAI?.state === 'ready' && blob?.state === 'ready' && ['ready', 'configured'].includes(queues?.state ?? '');
  const manualReady = blob?.state === 'ready';
  const factorySafe = factorySwitch?.state === 'safe';

  async function refresh() { await live.refresh(); }
  async function loadCandidates(issueId: string) { setCandidates(await fetchCandidates(issueId)); }

  function choose(item: QueueItem) {
    setSelectedId(item.issueId);
    setCandidates([]);
    setIssuePolicy(null);
    setReason('');
    setInstruction('');
    setAnswers(null);
    setArtworkFile(null);
    setError(null);
    setNotice(null);
    void Promise.all([fetchCandidates(item.issueId), fetchIssuePolicy(item.issueId)])
      .then(([nextCandidates, effective]) => { setCandidates(nextCandidates); setIssuePolicy(effective); })
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
    await readJson<{ policy: DesignPolicy }>(response, 'Global design policy could not be saved');
  }

  async function saveIssueField<K extends keyof DesignPolicy>(key: K, value: DesignPolicy[K] | undefined) {
    if (!selected || !issuePolicy) return;
    const path = `/ops/api/designer/${encodeURIComponent(selected.issueId)}/policy`;
    const nextOverride: Partial<DesignPolicy> = { ...(issuePolicy.override ?? {}) };
    if (value === undefined) delete nextOverride[key];
    else nextOverride[key] = value;
    const hasOverride = Object.keys(nextOverride).length > 0;
    const response = hasOverride
      ? await fetch(path, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(nextOverride) })
      : await fetch(path, { method: 'DELETE', credentials: 'same-origin' });
    setIssuePolicy(await readJson<EffectivePolicy>(response, 'Issue design policy could not be saved'));
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
    if (!selected || !artworkFile || !uploadReason.trim() || !manualReady) return;
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

  function updateGlobal<K extends keyof DesignPolicy>(key: K, value: DesignPolicy[K], message: string) {
    if (!globalPolicy) return;
    const next = { ...globalPolicy, [key]: value };
    void run(() => saveGlobalPolicy(next), message);
  }

  const visibleError = error ?? live.error;

  return <div>
    <div className={styles.panelHead}><div><p>DESIGNER / STUDIO</p><h1>What each mind became.</h1></div><button type="button" disabled={working} onClick={() => void refresh()}>REFRESH</button></div>

    <section className={styles.detail} aria-label="Global design controls">
      <p>GLOBAL DESIGN MODE</p>
      <div className={styles.detailGrid} aria-label="Design runtime readiness">
        <div><span>AI RUNTIME</span><strong>{aiReady ? 'AI AUTOMATION READY' : 'AI AUTOMATION UNAVAILABLE'}</strong><small>{openAI?.detail ?? 'OpenAI status pending.'}</small></div>
        <div><span>MANUAL RUNTIME</span><strong>{manualReady ? 'MANUAL ARTWORK READY' : 'MANUAL ARTWORK BLOCKED'}</strong><small>{blob?.detail ?? 'Private Blob status pending.'}</small></div>
        <div><span>FACTORY SAFETY</span><strong>{factorySafe ? 'FACTORY CHARGE SWITCH SAFE' : factorySwitch?.state === 'armed' ? 'FACTORY CHARGE SWITCH ARMED' : 'FACTORY CHARGE SWITCH UNKNOWN'}</strong><small>{factorySwitch?.detail ?? 'Factory kill-switch status pending.'}</small></div>
      </div>
      {!globalPolicy ? <small>LOADING POLICY…</small> : <div className={styles.actionRow}>
        <label>Global design mode
          <select aria-label="Global design mode" value={globalPolicy.mode} disabled={working} onChange={(event) => updateGlobal('mode', event.target.value as DesignMode, `Global mode set to ${event.target.value}.`)}>
            <option value="HYBRID">HYBRID — AI + OWNER</option><option value="AUTO">AUTO — AI FIRST</option><option value="MANUAL">MANUAL — OWNER ART</option>
          </select>
        </label>
        <label>Approval gate
          <select value={globalPolicy.approvalRequired ? 'REQUIRED' : 'AUTOMATIC'} disabled={working} onChange={(event) => updateGlobal('approvalRequired', event.target.value === 'REQUIRED', 'Approval gate updated.')}>
            <option value="REQUIRED">OWNER APPROVAL REQUIRED</option><option value="AUTOMATIC">AUTO APPROVE AFTER QUALITY GATE</option>
          </select>
        </label>
        <label>After rejection
          <select value={globalPolicy.rejectBehavior} disabled={working} onChange={(event) => updateGlobal('rejectBehavior', event.target.value as DesignPolicy['rejectBehavior'], 'Reject behavior updated.')}>
            <option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="AUTO_REGENERATE">AUTO REGENERATE</option>
          </select>
        </label>
        <label>Manual upload approval
          <select aria-label="Manual upload approval" value={globalPolicy.manualUploadApproval} disabled={working} onChange={(event) => updateGlobal('manualUploadApproval', event.target.value as DesignPolicy['manualUploadApproval'], 'Manual upload approval updated.')}>
            <option value="REQUIRE_APPROVAL">REQUIRE OWNER APPROVAL</option><option value="AUTO_APPROVE">AUTO APPROVE AFTER QUALITY GATE</option>
          </select>
        </label>
        <label>Answer reveal default
          <select aria-label="Answer reveal default" value={globalPolicy.answerRevealDefault} disabled={working} onChange={(event) => updateGlobal('answerRevealDefault', event.target.value as DesignPolicy['answerRevealDefault'], 'Answer reveal default updated.')}>
            <option value="HIDDEN_UNTIL_REVEALED">HIDDEN UNTIL AUDITED REVEAL</option><option value="VISIBLE">VISIBLE TO OWNER DESIGNER</option>
          </select>
        </label>
        <label>After approval
          <select value={globalPolicy.manufacturingHandoff} disabled={working} onChange={(event) => updateGlobal('manufacturingHandoff', event.target.value as DesignPolicy['manufacturingHandoff'], 'Manufacturing handoff updated.')}>
            <option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="AUTO_CREATE_DRAFT_AFTER_APPROVAL">AUTO CREATE UNCONFIRMED PRINTFUL DRAFT</option>
          </select>
        </label>
        <label>Factory confirmation policy
          <select aria-label="Factory confirmation policy" value={globalPolicy.factoryConfirmation} disabled={working} onChange={(event) => updateGlobal('factoryConfirmation', event.target.value as DesignPolicy['factoryConfirmation'], 'Factory confirmation policy updated.')}>
            <option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="ALLOW_AUTOMATION_WHEN_ARMED">ALLOW ONLY WHILE INDEPENDENT KILL SWITCH IS ARMED</option>
          </select>
        </label>
      </div>}
      <p className={styles.privacyFlags}>Policy never bypasses the independent factory charge switch. A design handoff creates only an unconfirmed draft unless the separate production gate is deliberately armed and confirmed.</p>
    </section>

    {visibleError ? <p role="alert" className={styles.alert}>{visibleError}</p> : null}
    {notice ? <p role="status" className={styles.alert}>{notice}</p> : null}
    <div className={styles.ledgerLayout}>
      <div className={styles.ledgerList}>{items.map((item) => <button key={item.issueId} type="button" aria-pressed={selected?.issueId === item.issueId} onClick={() => choose(item)}>
        <strong>{item.issueCode}</strong><span>{item.designState}</span><span>{item.objectType.toUpperCase()} / {item.sizeCode} / {item.colorCode.toUpperCase()}</span><small>CANDIDATES / {item.candidateCount}</small>
      </button>)}</div>
      <section className={styles.detail}>{!selected ? <p>SELECT A DESIGN</p> : <>
        <p>ISSUE / {selected.issueCode}</p><h2>{selected.designState}</h2>
        <div className={styles.detailGrid} aria-label="This Issue policy overrides">
          <label>This Issue Mode
            <select aria-label="This Issue Mode" value={issuePolicy?.override?.mode ?? 'INHERIT'} disabled={working || !issuePolicy} onChange={(event) => {
              const value = event.target.value as 'INHERIT' | DesignMode;
              void run(() => saveIssueField('mode', value === 'INHERIT' ? undefined : value), 'Issue mode override updated.');
            }}><option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.mode ?? '…'})</option><option value="HYBRID">HYBRID</option><option value="AUTO">AUTO</option><option value="MANUAL">MANUAL</option></select>
          </label>
          <label>This Issue Approval
            <select aria-label="This Issue Approval" value={issuePolicy?.override?.approvalRequired === undefined ? 'INHERIT' : issuePolicy.override.approvalRequired ? 'REQUIRED' : 'AUTOMATIC'} disabled={working || !issuePolicy} onChange={(event) => {
              const value = event.target.value; void run(() => saveIssueField('approvalRequired', value === 'INHERIT' ? undefined : value === 'REQUIRED'), 'Issue approval override updated.');
            }}><option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.approvalRequired ? 'REQUIRED' : 'AUTOMATIC'})</option><option value="REQUIRED">REQUIRED</option><option value="AUTOMATIC">AUTOMATIC AFTER QUALITY GATE</option></select>
          </label>
          <label>This Issue Reject Behavior
            <select aria-label="This Issue Reject Behavior" value={issuePolicy?.override?.rejectBehavior ?? 'INHERIT'} disabled={working || !issuePolicy} onChange={(event) => {
              const value = event.target.value as 'INHERIT' | DesignPolicy['rejectBehavior']; void run(() => saveIssueField('rejectBehavior', value === 'INHERIT' ? undefined : value), 'Issue reject override updated.');
            }}><option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.rejectBehavior ?? '…'})</option><option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="AUTO_REGENERATE">AUTO REGENERATE</option></select>
          </label>
          <label>This Issue Manual Upload Approval
            <select aria-label="This Issue Manual Upload Approval" value={issuePolicy?.override?.manualUploadApproval ?? 'INHERIT'} disabled={working || !issuePolicy} onChange={(event) => {
              const value = event.target.value as 'INHERIT' | DesignPolicy['manualUploadApproval']; void run(() => saveIssueField('manualUploadApproval', value === 'INHERIT' ? undefined : value), 'Issue manual upload override updated.');
            }}><option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.manualUploadApproval ?? '…'})</option><option value="REQUIRE_APPROVAL">REQUIRE APPROVAL</option><option value="AUTO_APPROVE">AUTO APPROVE</option></select>
          </label>
          <label>This Issue Answer Reveal
            <select aria-label="This Issue Answer Reveal" value={issuePolicy?.override?.answerRevealDefault ?? 'INHERIT'} disabled={working || !issuePolicy} onChange={(event) => {
              const value = event.target.value as 'INHERIT' | DesignPolicy['answerRevealDefault']; void run(() => saveIssueField('answerRevealDefault', value === 'INHERIT' ? undefined : value), 'Issue answer reveal override updated.');
            }}><option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.answerRevealDefault ?? '…'})</option><option value="HIDDEN_UNTIL_REVEALED">HIDDEN UNTIL REVEAL</option><option value="VISIBLE">VISIBLE</option></select>
          </label>
          <label>This Issue Manufacturing Handoff
            <select aria-label="This Issue Manufacturing Handoff" value={issuePolicy?.override?.manufacturingHandoff ?? 'INHERIT'} disabled={working || !issuePolicy} onChange={(event) => {
              const value = event.target.value as 'INHERIT' | DesignPolicy['manufacturingHandoff']; void run(() => saveIssueField('manufacturingHandoff', value === 'INHERIT' ? undefined : value), 'Issue manufacturing override updated.');
            }}><option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.manufacturingHandoff ?? '…'})</option><option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="AUTO_CREATE_DRAFT_AFTER_APPROVAL">AUTO CREATE DRAFT</option></select>
          </label>
          <label>This Issue Factory Confirmation
            <select aria-label="This Issue Factory Confirmation" value={issuePolicy?.override?.factoryConfirmation ?? 'INHERIT'} disabled={working || !issuePolicy} onChange={(event) => {
              const value = event.target.value as 'INHERIT' | DesignPolicy['factoryConfirmation']; void run(() => saveIssueField('factoryConfirmation', value === 'INHERIT' ? undefined : value), 'Issue factory policy override updated.');
            }}><option value="INHERIT">INHERIT GLOBAL ({issuePolicy?.policy.factoryConfirmation ?? '…'})</option><option value="WAIT_FOR_OWNER">WAIT FOR OWNER</option><option value="ALLOW_AUTOMATION_WHEN_ARMED">ALLOW ONLY WHEN ARMED</option></select>
          </label>
        </div>
        {selected.artworkUrl ? <img className={styles.largeArtwork} src={selected.artworkUrl} alt={`Artwork for ${selected.issueCode}`} /> : <div className={styles.emptyArtwork}>NO ARTWORK YET</div>}
        <p>{selected.width && selected.height ? `${selected.width} × ${selected.height}` : 'DIMENSIONS PENDING'} · {selected.model ?? 'MODEL PENDING'}</p>

        <h3>Private design context</h3>
        <label>Reveal reason<input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} placeholder="Why do you need the answers?" /></label>
        <div className={styles.actionRow}><button disabled={working || !revealReason.trim()} type="button" onClick={() => void revealAnswers()}>{answers ? 'REFRESH REVEALED ANSWERS' : 'REVEAL ANSWERS'}</button>{answers ? <button type="button" onClick={() => setAnswers(null)}>HIDE ANSWERS</button> : null}</div>
        {answers ? <div>{answers.map((entry) => <article key={entry.slot}><small>{entry.slot.toUpperCase()}</small><p>{entry.prompt}</p><strong>{typeof entry.answer === 'string' ? entry.answer : JSON.stringify(entry.answer)}</strong></article>)}</div> : null}

        <h3>Manual artwork</h3>
        <label>Manual artwork PNG<input aria-label="Manual artwork PNG" type="file" accept="image/png,.png" disabled={!manualReady || working} onChange={(event) => setArtworkFile(event.target.files?.[0] ?? null)} /></label>
        <label>Upload reason<input value={uploadReason} onChange={(event) => setUploadReason(event.target.value)} /></label>
        <div className={styles.actionRow}><button disabled={working || !manualReady || !artworkFile || !uploadReason.trim()} type="button" onClick={() => void uploadArtwork()}>UPLOAD PNG</button></div>
        {!manualReady ? <p className={styles.privacyFlags}>Manual upload is blocked until private artwork storage is ready.</p> : null}

        {selected.designState === 'FAILED' ? <div className={styles.actionRow}><button disabled={working || !aiReady} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/retry`, {}), 'Failed design queued for retry.')}>RETRY FAILED DESIGN</button></div> : null}
        {selected.designState === 'REVIEW' ? <>
          <div className={styles.actionRow}><button disabled={working} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/review`, { decision: 'approve' }), 'Design approved.')}>APPROVE</button></div>
          <h3>Feedback</h3>
          <div className={styles.actionRow}>{QUICK_REASONS.map((quick) => <button key={quick} type="button" aria-pressed={reason === quick} disabled={working} onClick={() => setReason(quick)}>{quick}</button>)}</div>
          <label>Revision reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What should change?" /></label>
          <label>Custom design instruction<input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Specific direction for the next pass" /></label>
          <div className={styles.actionRow}>
            <button disabled={working || !aiReady || !feedbackReason()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/rework`, { mode: 'regenerate', reason: feedbackReason() }), 'Artwork regeneration queued.')}>REGENERATE ART</button>
            <button disabled={working || !aiReady || !feedbackReason()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/rework`, { mode: 'reinterpret', reason: feedbackReason() }), 'Reinterpretation queued.')}>REINTERPRET</button>
            <button disabled={working || !feedbackReason()} type="button" onClick={() => void run(() => post(`/ops/api/designer/${selected.issueId}/review`, { decision: 'revise', next: 'regenerate', reason: feedbackReason() }), 'Design rejected with feedback.')}>REJECT / APPLY POLICY</button>
          </div>
        </> : null}
        {selected.designState === 'APPROVED' ? <div className={styles.confirmBox}>
          <strong>SEND TO MANUFACTURING</strong>
          <p>This creates or reconciles an unconfirmed Printful draft only. It does not authorize a charge or production.</p>
          <button disabled={working} type="button" onClick={() => void run(
            () => post('/ops/api/manufacturing/create-draft', { issueId: selected.issueId }),
            'Unconfirmed Printful draft created or reconciled. Production is still not confirmed.',
          )}>SEND TO MANUFACTURING</button>
        </div> : null}
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
