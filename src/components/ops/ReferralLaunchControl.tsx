'use client';

import { useState } from 'react';
import styles from './owner-os.module.css';

type Result = { considered: number; sent: number; skipped: number; failed: number };

export function ReferralLaunchControl() {
  const [campaign, setCampaign] = useState('launch-v1');
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendLaunchEmails() {
    const confirmed = window.confirm('Send launch referral emails to up to 50 active creators who have not already received this campaign?');
    if (!confirmed) return;
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/ops/api/referrals/launch-outreach', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation: 'SEND_LAUNCH_REFERRALS', campaign, limit: 50 }),
      });
      const payload = await response.json().catch(() => ({})) as Partial<Result> & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Referral launch outreach failed');
      setResult({
        considered: payload.considered ?? 0,
        sent: payload.sent ?? 0,
        skipped: payload.skipped ?? 0,
        failed: payload.failed ?? 0,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Referral launch outreach failed');
    } finally {
      setWorking(false);
    }
  }

  return <main>
    <div className={styles.panelHead}>
      <div><p>REFERRALS / LAUNCH</p><h1>Tell creators we are live.</h1></div>
      <a href="/ops">BACK TO OWNER OS</a>
    </div>
    <section className={styles.detail}>
      <p>Only active creators are contacted. A successful campaign email is never sent twice to the same creator.</p>
      <label>
        Campaign
        <input value={campaign} onChange={(event) => setCampaign(event.target.value)} aria-label="Referral launch campaign" />
      </label>
      <button type="button" disabled={working || campaign.trim().length < 3} onClick={() => void sendLaunchEmails()}>
        {working ? 'SENDING…' : 'SEND LAUNCH EMAILS'}
      </button>
      {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
      {result ? <p className={styles.privacyFlags}>
        CONSIDERED / {result.considered} · SENT / {result.sent} · SKIPPED / {result.skipped} · FAILED / {result.failed}
      </p> : null}
      <p>Run again only if more creators remain or a failed delivery needs retrying. Successful sends are protected from duplicates.</p>
    </section>
  </main>;
}
