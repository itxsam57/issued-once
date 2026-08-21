'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './owner-os.module.css';

type ReferralValue =
  | { mode: 'PERCENT'; basisPoints: number }
  | { mode: 'FIXED'; amountMinor: number };

type ReferralRules = {
  customerDiscount: ReferralValue;
  creatorReward: ReferralValue;
  payoutCadence: 'MONTHLY' | 'THRESHOLD';
  payoutThresholdMinor: number | null;
  attributionWindowDays: number;
};

type Balance = {
  currency: string;
  pendingMinor: number;
  availableMinor: number;
  paidOutMinor: number;
  reversedMinor: number;
  payoutReady: boolean;
};

type Creator = {
  creatorId: string;
  displayName: string;
  code: string;
  referralPath: string;
  active: boolean;
  ruleVersionId?: string;
  ruleVersion: number;
  rules: ReferralRules;
  salesCount: number;
  balances: Balance[];
};

type Payout = {
  payoutId: string;
  creatorId: string;
  currency: string;
  requestedAmountMinor: number;
  conversionCount: number;
  status: 'REQUESTED' | 'PAID' | 'CANCELLED';
  requestedAt: string;
  paidAt: string | null;
};

type Snapshot = { creators: Creator[]; payouts: Payout[] };
type Mode = '' | 'PERCENT' | 'FIXED';
type Cadence = '' | 'MONTHLY' | 'THRESHOLD';
type Editor = { kind: 'create' } | { kind: 'edit'; creatorId: string };
type RuleForm = {
  displayName: string;
  email: string;
  code: string;
  discountMode: Mode;
  discountValue: string;
  rewardMode: Mode;
  rewardValue: string;
  payoutCadence: Cadence;
  payoutThreshold: string;
  attributionWindowDays: string;
};

const emptyForm: RuleForm = {
  displayName: '',
  email: '',
  code: '',
  discountMode: '',
  discountValue: '',
  rewardMode: '',
  rewardValue: '',
  payoutCadence: '',
  payoutThreshold: '',
  attributionWindowDays: '',
};

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

function referralValueText(value: ReferralValue) {
  return value.mode === 'PERCENT'
    ? `${(value.basisPoints / 100).toFixed(2).replace(/\.00$/, '')}%`
    : `${(value.amountMinor / 100).toFixed(2)} / order currency`;
}

function positiveNumber(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} is required`);
  return parsed;
}

function decimalToMinor(value: string, label: string) {
  const minor = Math.round(positiveNumber(value, label) * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error(`${label} is invalid`);
  return minor;
}

function valueFromForm(mode: Mode, value: string, label: string): ReferralValue {
  if (mode === 'PERCENT') {
    const basisPoints = Math.round(positiveNumber(value, label) * 100);
    if (!Number.isSafeInteger(basisPoints)) throw new Error(`${label} is invalid`);
    return { mode, basisPoints };
  }
  if (mode === 'FIXED') return { mode, amountMinor: decimalToMinor(value, label) };
  throw new Error(`${label} mode is required`);
}

function rulesFromForm(form: RuleForm): ReferralRules {
  if (!form.payoutCadence) throw new Error('Payout cadence is required');
  const attributionWindowDays = Number(form.attributionWindowDays);
  if (!Number.isSafeInteger(attributionWindowDays) || attributionWindowDays <= 0) {
    throw new Error('Attribution window is required');
  }
  return {
    customerDiscount: valueFromForm(form.discountMode, form.discountValue, 'Customer discount'),
    creatorReward: valueFromForm(form.rewardMode, form.rewardValue, 'Creator reward'),
    payoutCadence: form.payoutCadence,
    payoutThresholdMinor: form.payoutCadence === 'THRESHOLD'
      ? decimalToMinor(form.payoutThreshold, 'Payout threshold')
      : null,
    attributionWindowDays,
  };
}

function formFromCreator(creator: Creator): RuleForm {
  const value = (rule: ReferralValue) => rule.mode === 'PERCENT'
    ? String(rule.basisPoints / 100)
    : String(rule.amountMinor / 100);
  return {
    displayName: creator.displayName,
    email: '',
    code: creator.code,
    discountMode: creator.rules.customerDiscount.mode,
    discountValue: value(creator.rules.customerDiscount),
    rewardMode: creator.rules.creatorReward.mode,
    rewardValue: value(creator.rules.creatorReward),
    payoutCadence: creator.rules.payoutCadence,
    payoutThreshold: creator.rules.payoutThresholdMinor == null ? '' : String(creator.rules.payoutThresholdMinor / 100),
    attributionWindowDays: String(creator.rules.attributionWindowDays),
  };
}

async function loadSnapshot(): Promise<Snapshot> {
  const response = await fetch('/ops/api/referrals', { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json().catch(() => ({})) as Partial<Snapshot> & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Referral data unavailable');
  return { creators: payload.creators ?? [], payouts: payload.payouts ?? [] };
}

async function send(path: string, method: string, body: unknown) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Referral action failed');
  return payload;
}

export function ReferralsPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [payoutCurrency, setPayoutCurrency] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutName, setPayoutName] = useState('');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutReason, setPayoutReason] = useState('');
  const [payoutId, setPayoutId] = useState('');
  const [revealReason, setRevealReason] = useState('');
  const [settleReason, setSettleReason] = useState('');
  const [revealed, setRevealed] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    void loadSnapshot()
      .then((next) => {
        if (!alive) return;
        setSnapshot(next);
        setSelectedId(next.creators[0]?.creatorId ?? null);
      })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Referral data unavailable'); });
    return () => { alive = false; };
  }, []);

  const selected = snapshot?.creators.find((creator) => creator.creatorId === selectedId) ?? null;
  const creatorPayouts = useMemo(
    () => snapshot?.payouts.filter((payout) => payout.creatorId === selectedId) ?? [],
    [snapshot, selectedId],
  );
  const selectedPayout = creatorPayouts.find((payout) => payout.payoutId === payoutId) ?? creatorPayouts[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setPayoutCurrency('');
      setPayoutId('');
      return;
    }
    setPayoutCurrency((current) => selected.balances.some((balance) => balance.currency === current)
      ? current
      : selected.balances[0]?.currency ?? '');
    setPayoutId((current) => creatorPayouts.some((payout) => payout.payoutId === current)
      ? current
      : creatorPayouts[0]?.payoutId ?? '');
    setRevealed(null);
    setRevealReason('');
    setSettleReason('');
  }, [selected, creatorPayouts]);

  async function refresh(preferredId?: string | null) {
    const next = await loadSnapshot();
    setSnapshot(next);
    const wanted = preferredId ?? selectedId;
    setSelectedId(wanted && next.creators.some((creator) => creator.creatorId === wanted)
      ? wanted
      : next.creators[0]?.creatorId ?? null);
  }

  async function mutation(action: () => Promise<void>, preferredId?: string | null) {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await refresh(preferredId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Referral action failed');
    } finally {
      setWorking(false);
    }
  }

  function choose(creator: Creator) {
    setSelectedId(creator.creatorId);
    setEditor(null);
    setError(null);
    setNotice(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditor({ kind: 'create' });
    setError(null);
    setNotice(null);
  }

  function openEdit() {
    if (!selected) return;
    setForm(formFromCreator(selected));
    setEditor({ kind: 'edit', creatorId: selected.creatorId });
    setError(null);
    setNotice(null);
  }

  async function saveEditor() {
    if (!editor) return;
    let rules: ReferralRules;
    try {
      rules = rulesFromForm(form);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Referral rules are invalid');
      return;
    }
    await mutation(async () => {
      if (editor.kind === 'create') {
        const result = await send('/ops/api/referrals', 'POST', {
          displayName: form.displayName,
          email: form.email,
          code: form.code,
          rules,
        });
        const createdId = typeof result.creatorId === 'string' ? result.creatorId : null;
        setEditor(null);
        setNotice('CREATOR CREATED');
        if (createdId) setSelectedId(createdId);
      } else {
        await send(`/ops/api/referrals/${editor.creatorId}`, 'PUT', {
          displayName: form.displayName,
          code: form.code,
          rules,
        });
        setEditor(null);
        setNotice('NEW RULE VERSION SAVED');
      }
    }, editor.kind === 'edit' ? editor.creatorId : selectedId);
  }

  async function toggleActive() {
    if (!selected) return;
    await mutation(async () => {
      await send(`/ops/api/referrals/${selected.creatorId}`, 'PATCH', { active: !selected.active });
      setNotice(selected.active ? 'CREATOR PAUSED' : 'CREATOR RESUMED');
    }, selected.creatorId);
  }

  async function copyLink() {
    if (!selected) return;
    try {
      const url = new URL(selected.referralPath, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setNotice('REFERRAL LINK COPIED');
      setError(null);
    } catch {
      setError('Referral link could not be copied');
    }
  }

  const payoutBalance = selected?.balances.find((balance) => balance.currency === payoutCurrency) ?? null;
  const payoutReady = Boolean(
    payoutBalance?.payoutReady
    && payoutMethod
    && payoutName.trim()
    && payoutRef.trim()
    && payoutReason.trim().length >= 3,
  );

  async function requestPayout() {
    if (!selected || !payoutBalance || !payoutReady) return;
    await mutation(async () => {
      await send('/ops/api/referrals/payouts', 'POST', {
        action: 'REQUEST',
        creatorId: selected.creatorId,
        currency: payoutBalance.currency,
        details: { method: payoutMethod, accountName: payoutName.trim(), accountRef: payoutRef.trim() },
        reason: payoutReason.trim(),
      });
      setPayoutMethod('');
      setPayoutName('');
      setPayoutRef('');
      setPayoutReason('');
      setNotice('PAYOUT REQUEST CREATED');
    }, selected.creatorId);
  }

  async function revealPayout() {
    if (!selectedPayout || revealReason.trim().length < 3) return;
    setWorking(true);
    setError(null);
    try {
      const payload = await send('/ops/api/referrals/payouts', 'POST', {
        action: 'REVEAL',
        payoutId: selectedPayout.payoutId,
        reason: revealReason.trim(),
      });
      setRevealed(payload.value ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payout reveal failed');
    } finally {
      setWorking(false);
    }
  }

  async function markPaid() {
    if (!selectedPayout || selectedPayout.status !== 'REQUESTED' || settleReason.trim().length < 3) return;
    await mutation(async () => {
      await send('/ops/api/referrals/payouts', 'POST', {
        action: 'MARK_PAID',
        payoutId: selectedPayout.payoutId,
        reason: settleReason.trim(),
      });
      setRevealed(null);
      setNotice('PAYOUT MARKED PAID');
    }, selectedId);
  }

  return <div>
    <div className={styles.panelHead}>
      <div><p>REFERRALS / CREATOR LEDGER</p><h1>Who is bringing people in.</h1></div>
      <button type="button" onClick={openCreate}>NEW CREATOR</button>
    </div>

    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {notice ? <p className={styles.privacyFlags}>{notice}</p> : null}
    {!snapshot ? <p>READING REFERRALS</p> : <div className={styles.ledgerLayout}>
      <div className={styles.ledgerList}>
        {snapshot.creators.length === 0 ? <p>NO CREATORS YET</p> : snapshot.creators.map((creator) => <button
          key={creator.creatorId}
          type="button"
          onClick={() => choose(creator)}
          aria-pressed={selected?.creatorId === creator.creatorId}
        >
          <strong>{creator.code}</strong>
          <span>{creator.displayName}</span>
          <span>{creator.active ? 'ACTIVE' : 'PAUSED'}</span>
          <small>SALES / {creator.salesCount} · RULE / V{creator.ruleVersion}</small>
        </button>)}
      </div>

      <section className={styles.detail}>
        {editor ? <CreatorEditor
          editor={editor}
          form={form}
          setForm={setForm}
          working={working}
          onSave={() => void saveEditor()}
          onCancel={() => setEditor(null)}
        /> : !selected ? <p>SELECT A CREATOR</p> : <>
          <p>CREATOR / {selected.displayName}</p>
          <h2>{selected.code}</h2>
          <p className={styles.privacyFlags}>Creator contact and payout destinations are encrypted. They are never part of this normal ledger view.</p>
          <div className={styles.actionRow}>
            <button type="button" disabled={working} onClick={() => void copyLink()}>COPY LINK</button>
            <button type="button" disabled={working} onClick={openEdit}>EDIT RULES</button>
            <button type="button" disabled={working} onClick={() => void toggleActive()}>{selected.active ? 'PAUSE CREATOR' : 'RESUME CREATOR'}</button>
          </div>

          <div className={styles.metricGrid}>
            <article><span>SALES</span><strong>{selected.salesCount}</strong></article>
            <article><span>RULE VERSION</span><strong>V{selected.ruleVersion}</strong></article>
            <article><span>STATE</span><strong>{selected.active ? 'LIVE' : 'PAUSED'}</strong></article>
            <article><span>LINK</span><strong>{selected.referralPath}</strong></article>
          </div>

          <section>
            <h3>Current economics</h3>
            <div className={styles.twoColumn}>
              <div className={styles.statRow}><span>CUSTOMER DISCOUNT</span><strong>{referralValueText(selected.rules.customerDiscount)}</strong></div>
              <div className={styles.statRow}><span>CREATOR REWARD</span><strong>{referralValueText(selected.rules.creatorReward)}</strong></div>
              <div className={styles.statRow}><span>PAYOUT CADENCE</span><strong>{selected.rules.payoutCadence}</strong></div>
              <div className={styles.statRow}><span>ATTRIBUTION WINDOW</span><strong>{selected.rules.attributionWindowDays} DAYS</strong></div>
              {selected.rules.payoutCadence === 'THRESHOLD' && selected.rules.payoutThresholdMinor != null
                ? <div className={styles.statRow}><span>PAYOUT THRESHOLD</span><strong>{(selected.rules.payoutThresholdMinor / 100).toFixed(2)} / order currency</strong></div>
                : null}
            </div>
          </section>

          <section>
            <h3>Balances</h3>
            {selected.balances.length === 0 ? <p>NO EARNINGS YET</p> : selected.balances.map((balance) => <article className={styles.configCard} key={balance.currency}>
              <h3>{balance.currency} <small>{balance.payoutReady ? 'PAYOUT READY' : 'NOT READY'}</small></h3>
              <div className={styles.twoColumn}>
                <div className={styles.statRow}><span>PENDING</span><strong>{money(balance.pendingMinor, balance.currency)}</strong></div>
                <div className={styles.statRow}><span>AVAILABLE</span><strong>{money(balance.availableMinor, balance.currency)}</strong></div>
                <div className={styles.statRow}><span>PAID OUT</span><strong>{money(balance.paidOutMinor, balance.currency)}</strong></div>
                <div className={styles.statRow}><span>REVERSED</span><strong>{money(balance.reversedMinor, balance.currency)}</strong></div>
              </div>
            </article>)}
          </section>

          <section>
            <h3>Request payout</h3>
            <p className={styles.privacyFlags}>Only AVAILABLE earnings can be allocated. Destination details are encrypted before storage.</p>
            <div className={styles.twoColumn}>
              <label>Payout currency<select aria-label="Payout currency" value={payoutCurrency} onChange={(event) => setPayoutCurrency(event.target.value)}>
                {selected.balances.length === 0 ? <option value="">NO BALANCE</option> : selected.balances.map((balance) => <option key={balance.currency} value={balance.currency}>{balance.currency}</option>)}
              </select></label>
              <label>Destination type<select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)}>
                <option value="">CHOOSE</option><option value="bank">BANK</option><option value="wallet">WALLET</option><option value="other">OTHER</option>
              </select></label>
              <label>Recipient name<input value={payoutName} onChange={(event) => setPayoutName(event.target.value)} autoComplete="off" /></label>
              <label>Destination / reference<input value={payoutRef} onChange={(event) => setPayoutRef(event.target.value)} autoComplete="off" /></label>
            </div>
            <label>Reason for payout request<input value={payoutReason} onChange={(event) => setPayoutReason(event.target.value)} placeholder="Why is this payout being prepared?" /></label>
            <div className={styles.actionRow}>
              <button type="button" disabled={working || !payoutReady} onClick={() => void requestPayout()}>REQUEST PAYOUT</button>
            </div>
          </section>

          <section>
            <h3>Payout ledger</h3>
            {creatorPayouts.length === 0 ? <p>NO PAYOUT REQUESTS YET</p> : <>
              <label>Payout record<select aria-label="Payout record" value={selectedPayout?.payoutId ?? ''} onChange={(event) => { setPayoutId(event.target.value); setRevealed(null); setRevealReason(''); setSettleReason(''); }}>
                {creatorPayouts.map((payout) => <option key={payout.payoutId} value={payout.payoutId}>{payout.status} · {money(payout.requestedAmountMinor, payout.currency)} · {new Date(payout.requestedAt).toLocaleDateString()}</option>)}
              </select></label>
              {selectedPayout ? <div className={styles.revealBox}>
                <div className={styles.detailGrid}>
                  <div><span>STATUS</span><strong>{selectedPayout.status}</strong></div>
                  <div><span>AMOUNT</span><strong>{money(selectedPayout.requestedAmountMinor, selectedPayout.currency)}</strong></div>
                  <div><span>REWARDS</span><strong>{selectedPayout.conversionCount}</strong></div>
                </div>
                <p>Destination remains encrypted until you provide an audit reason.</p>
                <label>Reason to reveal payout details<input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} /></label>
                <button type="button" disabled={working || revealReason.trim().length < 3} onClick={() => void revealPayout()}>REVEAL PAYOUT DETAILS</button>
                {revealed !== null ? <pre className={styles.privatePre}>{JSON.stringify(revealed, null, 2)}</pre> : null}
                {selectedPayout.status === 'REQUESTED' ? <>
                  <label>Reason to mark payout paid<input value={settleReason} onChange={(event) => setSettleReason(event.target.value)} placeholder="External transfer confirmation" /></label>
                  <button type="button" disabled={working || settleReason.trim().length < 3} onClick={() => void markPaid()}>MARK PAYOUT PAID</button>
                </> : null}
              </div> : null}
            </>}
          </section>
        </>}
      </section>
    </div>}
  </div>;
}

function CreatorEditor({
  editor,
  form,
  setForm,
  working,
  onSave,
  onCancel,
}: {
  editor: Editor;
  form: RuleForm;
  setForm: (next: RuleForm) => void;
  working: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  function patch<K extends keyof RuleForm>(key: K, value: RuleForm[K]) {
    setForm({ ...form, [key]: value });
  }
  return <div>
    <p>{editor.kind === 'create' ? 'NEW CREATOR' : 'NEW IMMUTABLE RULE VERSION'}</p>
    <h2>{editor.kind === 'create' ? 'Add a creator.' : 'Change what applies next.'}</h2>
    <p className={styles.privacyFlags}>Rule changes affect only future attribution and quotes. Existing quotes, conversions and earnings keep their frozen snapshots.</p>
    <div className={styles.twoColumn}>
      <label>Display name<input value={form.displayName} onChange={(event) => patch('displayName', event.target.value)} /></label>
      <label>Referral code<input value={form.code} onChange={(event) => patch('code', event.target.value)} autoCapitalize="characters" /></label>
      {editor.kind === 'create' ? <label>Creator email<input type="email" value={form.email} onChange={(event) => patch('email', event.target.value)} autoComplete="off" /></label> : null}
      <label>Customer discount mode<select value={form.discountMode} onChange={(event) => patch('discountMode', event.target.value as Mode)}>
        <option value="">CHOOSE</option><option value="PERCENT">PERCENT</option><option value="FIXED">FIXED AMOUNT</option>
      </select></label>
      <label>Customer discount {form.discountMode === 'PERCENT' ? '%' : 'amount'}<input inputMode="decimal" value={form.discountValue} onChange={(event) => patch('discountValue', event.target.value)} /></label>
      <label>Creator reward mode<select value={form.rewardMode} onChange={(event) => patch('rewardMode', event.target.value as Mode)}>
        <option value="">CHOOSE</option><option value="PERCENT">PERCENT</option><option value="FIXED">FIXED AMOUNT</option>
      </select></label>
      <label>Creator reward {form.rewardMode === 'PERCENT' ? '%' : 'amount'}<input inputMode="decimal" value={form.rewardValue} onChange={(event) => patch('rewardValue', event.target.value)} /></label>
      <label>Payout cadence<select value={form.payoutCadence} onChange={(event) => patch('payoutCadence', event.target.value as Cadence)}>
        <option value="">CHOOSE</option><option value="MONTHLY">MONTHLY</option><option value="THRESHOLD">THRESHOLD</option>
      </select></label>
      {form.payoutCadence === 'THRESHOLD' ? <label>Payout threshold amount<input inputMode="decimal" value={form.payoutThreshold} onChange={(event) => patch('payoutThreshold', event.target.value)} /></label> : null}
      <label>Attribution window / days<input inputMode="numeric" value={form.attributionWindowDays} onChange={(event) => patch('attributionWindowDays', event.target.value)} /></label>
    </div>
    <div className={styles.actionRow}>
      <button type="button" disabled={working} onClick={onSave}>{editor.kind === 'create' ? 'CREATE CREATOR' : 'SAVE NEW RULE VERSION'}</button>
      <button type="button" disabled={working} onClick={onCancel}>CANCEL</button>
    </div>
  </div>;
}
