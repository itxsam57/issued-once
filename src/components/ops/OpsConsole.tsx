'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './ops.module.css';

type OpsIssue = {
  issueId: string;
  issueCode: string;
  status: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  amountMinor: number;
  currency: string;
  designJobId: string | null;
  designState: string | null;
  artworkUrl: string | null;
  artworkWidth: number | null;
  artworkHeight: number | null;
  manufacturingJobId: string | null;
  manufacturingState: string | null;
  providerOrderId: string | null;
  trackingNumber: string | null;
  updatedAt: string;
};

type ReadinessCheck = {
  key: string;
  label: string;
  state: 'ready' | 'configured' | 'missing' | 'blocked' | 'safe' | 'armed';
  detail: string;
};

type ReadinessPayload = {
  checkedAt: string;
  checks: ReadinessCheck[];
  readyForSandbox: boolean;
  readyForProduction: boolean;
};

async function action(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Operation failed');
}

export function OpsConsole() {
  const [issues, setIssues] = useState<OpsIssue[]>([]);
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});

  async function refreshIssues() {
    const response = await fetch('/ops/api/issues', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Operations list could not be loaded');
    const payload = (await response.json()) as { issues: OpsIssue[] };
    setIssues(payload.issues);
  }

  async function refreshReadiness() {
    const response = await fetch('/ops/api/readiness', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Launch readiness could not be checked');
    setReadiness((await response.json()) as ReadinessPayload);
  }

  async function refreshAll() {
    setError(null);
    await Promise.all([refreshIssues(), refreshReadiness()]);
    setLoading(false);
  }

  useEffect(() => {
    void refreshAll().catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Operations room could not be loaded');
      setLoading(false);
    });
  }, []);

  const counts = useMemo(() => ({
    review: issues.filter((issue) => issue.designState === 'REVIEW').length,
    drafts: issues.filter((issue) => issue.manufacturingState === 'DRAFT').length,
    production: issues.filter((issue) => issue.status === 'IN_PRODUCTION').length,
  }), [issues]);

  async function run(key: string, path: string, body: unknown) {
    setWorking(key);
    setError(null);
    try {
      await action(path, body);
      await refreshIssues();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operation failed');
    } finally {
      setWorking(null);
    }
  }

  async function logout() {
    await fetch('/api/ops/session', { method: 'DELETE' }).catch(() => null);
    window.location.reload();
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.signal}>ISSUED ONCE / OPERATIONS</p>
          <h1>What exists now.</h1>
        </div>
        <button className={styles.quietButton} type="button" onClick={logout}>CLOSE ROOM</button>
      </header>

      <div className={styles.summary} aria-label="Operations summary">
        <span>REVIEW / {counts.review}</span>
        <span>DRAFTS / {counts.drafts}</span>
        <span>PRODUCTION / {counts.production}</span>
      </div>

      <section className={styles.readiness} aria-label="Launch readiness">
        <div className={styles.readinessHead}>
          <div>
            <p className={styles.signal}>
              {readiness?.readyForProduction
                ? 'LAUNCH / PRODUCTION READY'
                : readiness?.readyForSandbox
                  ? 'LAUNCH / SANDBOX READY'
                  : 'LAUNCH / NOT READY'}
            </p>
            <h2>What can actually run.</h2>
          </div>
          <button
            className={styles.quietButton}
            type="button"
            disabled={loading}
            onClick={() => void refreshReadiness().catch((cause) => setError(cause instanceof Error ? cause.message : 'Readiness check failed'))}
          >CHECK AGAIN</button>
        </div>

        <div className={styles.readinessGrid}>
          {readiness?.checks.map((check) => (
            <article className={styles.readinessItem} key={check.key}>
              <div>
                <strong>{check.label}</strong>
                <span data-state={check.state}>{check.state.toUpperCase()}</span>
              </div>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
        <p className={styles.readinessNote}>
          Production never turns green from configuration alone. Signed payment, email, queue, artwork and factory proofs still require observed evidence and the owner launch gate.
        </p>
      </section>

      <p className={styles.privacy}>This room intentionally excludes raw answers, email and shipping details. Production identity is the Issue.</p>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {loading ? <p className={styles.loading}>READING SYSTEM</p> : null}

      <section className={styles.issueList} aria-label="Issues">
        {issues.map((issue) => {
          const key = issue.issueId;
          const isWorking = working === key;
          const canApprove = issue.designState === 'REVIEW' && Boolean(issue.artworkUrl);
          const canDraft = issue.designState === 'APPROVED' && (!issue.manufacturingState || issue.manufacturingState === 'FAILED');
          const canConfirm = issue.manufacturingState === 'DRAFT';
          const expected = `CONFIRM ${issue.issueCode}`;

          return (
            <article className={styles.issue} key={issue.issueId}>
              <div className={styles.issueMeta}>
                <p className={styles.issueCode}>ISSUE / {issue.issueCode}</p>
                <h2>{issue.status.replaceAll('_', ' ')}</h2>
                <div className={styles.physical}>
                  <span>{issue.objectType.toUpperCase()}</span>
                  <span>{issue.sizeCode}</span>
                  <span>{issue.colorCode.toUpperCase()}</span>
                  <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: issue.currency }).format(issue.amountMinor / 100)}</span>
                </div>
                <dl className={styles.states}>
                  <div><dt>DESIGN</dt><dd>{issue.designState ?? 'NOT YET'}</dd></div>
                  <div><dt>FACTORY</dt><dd>{issue.manufacturingState ?? 'NOT YET'}</dd></div>
                  {issue.providerOrderId ? <div><dt>PRINTFUL</dt><dd>{issue.providerOrderId}</dd></div> : null}
                  {issue.trackingNumber ? <div><dt>TRACKING</dt><dd>{issue.trackingNumber}</dd></div> : null}
                </dl>
              </div>

              <div className={styles.artwork}>
                {issue.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={issue.artworkUrl} alt={`Production artwork for ${issue.issueCode}`} />
                ) : (
                  <div className={styles.emptyArt}>NO ARTWORK YET</div>
                )}
                {issue.artworkWidth && issue.artworkHeight ? (
                  <span>{issue.artworkWidth} × {issue.artworkHeight} PNG</span>
                ) : null}
              </div>

              <div className={styles.actions}>
                {canApprove ? (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => void run(key, '/ops/api/design/approve', { issueId: issue.issueId })}
                  >APPROVE ART</button>
                ) : null}
                {canDraft ? (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => void run(key, '/ops/api/manufacturing/create-draft', { issueId: issue.issueId })}
                  >CREATE PRINTFUL DRAFT</button>
                ) : null}
                {canConfirm ? (
                  <div className={styles.confirm}>
                    <p>This charges/submits the Printful draft. Type <strong>{expected}</strong>.</p>
                    <input
                      aria-label={`Production confirmation for ${issue.issueCode}`}
                      value={confirmations[key] ?? ''}
                      onChange={(event) => setConfirmations((current) => ({ ...current, [key]: event.target.value }))}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      disabled={isWorking || confirmations[key] !== expected}
                      onClick={() => void run(key, '/ops/api/manufacturing/confirm', {
                        issueId: issue.issueId,
                        confirmation: confirmations[key],
                      })}
                    >CONFIRM PRODUCTION</button>
                  </div>
                ) : null}
                {!canApprove && !canDraft && !canConfirm ? <p className={styles.noAction}>NO OWNER ACTION REQUIRED</p> : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
