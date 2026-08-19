'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './owner-os.module.css';

type Variant = { id: string; size: string; colorName: string; colorSwatch?: string | null; amountMinor: number; available: boolean };
type Catalog = { currency: 'USD'|'PKR'; products: Record<string, { slug: string; variants: Variant[] }> };
type Question = { questionId: string; version: number; family: string; prompt: string; kind: 'text'|'choice'; optional: boolean; active: boolean; weight: number; usageCount: number };
type State = { catalog: { source: 'BOOT'|'ACTIVE'; version: number; payload: Catalog }; questions: Question[] };

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})) as { error?: string; version?: number };
  if (!response.ok) throw new Error(payload.error || 'Website control failed');
  return payload;
}

export function WebsitePanel() {
  const [state, setState] = useState<State | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ questionId: '', family: 'culture', prompt: '', optional: false });

  async function refresh() {
    const response = await fetch('/ops/api/website', { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json() as State & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Website controls unavailable');
    setState(payload);
    setCatalog(structuredClone(payload.catalog.payload));
  }
  useEffect(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'Website controls unavailable')); }, []);

  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    for (const question of state?.questions ?? []) (groups[question.family] ??= []).push(question);
    return groups;
  }, [state]);

  async function run(action: () => Promise<unknown>) {
    setWorking(true); setError(null);
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Website control failed'); }
    finally { setWorking(false); }
  }

  function mutateVariant(productKey: string, index: number, patch: Partial<Variant>) {
    setCatalog((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.products[productKey].variants[index] = { ...next.products[productKey].variants[index], ...patch };
      return next;
    });
  }

  return <div>
    <div className={styles.panelHead}><div><p>WEBSITE / CONTROL</p><h1>What the next customer can receive.</h1></div><span>{state ? `${state.catalog.source} / V${state.catalog.version}` : 'READING'}</span></div>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {catalog ? <section className={styles.configSection}>
      <div className={styles.panelHead}><div><h2>Retail catalog</h2><p>Changes affect future selections only. Existing quotes and Issues remain frozen.</p></div><button disabled={working} type="button" onClick={() => void run(() => post('/ops/api/website/catalog', catalog))}>PUBLISH CATALOG</button></div>
      {Object.entries(catalog.products).map(([productKey, product]) => <article className={styles.configCard} key={productKey}>
        <h3>{productKey.toUpperCase()} <small>{product.slug}</small></h3>
        <div className={styles.configTable}>
          {product.variants.map((variant, index) => <div key={`${variant.id}-${index}`}>
            <input aria-label={`${productKey} variant id`} value={variant.id} onChange={(event) => mutateVariant(productKey, index, { id: event.target.value })} />
            <input aria-label={`${productKey} size`} value={variant.size} onChange={(event) => mutateVariant(productKey, index, { size: event.target.value })} />
            <input aria-label={`${productKey} color`} value={variant.colorName} onChange={(event) => mutateVariant(productKey, index, { colorName: event.target.value })} />
            <input aria-label={`${productKey} price`} type="number" min="1" value={variant.amountMinor} onChange={(event) => mutateVariant(productKey, index, { amountMinor: Number(event.target.value) })} />
            <label><input type="checkbox" checked={variant.available} onChange={(event) => mutateVariant(productKey, index, { available: event.target.checked })} /> SELL</label>
          </div>)}
        </div>
      </article>)}
    </section> : null}

    <section className={styles.configSection}>
      <h2>Question Vault</h2>
      <p>Future sessions only. Stored question snapshots never change.</p>
      {Object.entries(groupedQuestions).map(([family, questions]) => <article className={styles.configCard} key={family}>
        <h3>{family.toUpperCase()} / ACTIVE {questions.filter((q) => q.active).length}</h3>
        {questions.map((question) => <div className={styles.questionRow} key={`${question.questionId}-${question.version}`}>
          <div><strong>{question.prompt}</strong><small>{question.questionId} / V{question.version} / USED {question.usageCount}</small></div>
          <label>WEIGHT <input type="number" min="0.1" max="100" step="0.1" defaultValue={question.weight} onBlur={(event) => {
            const weight = Number(event.currentTarget.value);
            if (weight !== question.weight) void run(() => post('/ops/api/website/questions', { questionId: question.questionId, version: question.version, active: question.active, weight }));
          }} /></label>
          <button disabled={working} type="button" onClick={() => void run(() => post('/ops/api/website/questions', { questionId: question.questionId, version: question.version, active: !question.active, weight: question.weight }))}>{question.active ? 'RETIRE' : 'ACTIVATE'}</button>
        </div>)}
      </article>)}
      <article className={styles.configCard}>
        <h3>NEW QUESTION / NEW VERSION</h3>
        <input placeholder="Question ID" value={newQuestion.questionId} onChange={(event) => setNewQuestion((current) => ({ ...current, questionId: event.target.value }))} />
        <select value={newQuestion.family} onChange={(event) => setNewQuestion((current) => ({ ...current, family: event.target.value }))}>{['culture','place','rhythm','identity','music','boundary','wildcard'].map((family) => <option key={family}>{family}</option>)}</select>
        <textarea placeholder="Prompt" value={newQuestion.prompt} onChange={(event) => setNewQuestion((current) => ({ ...current, prompt: event.target.value }))} />
        <label><input type="checkbox" checked={newQuestion.optional} onChange={(event) => setNewQuestion((current) => ({ ...current, optional: event.target.checked }))} /> OPTIONAL</label>
        <button disabled={working || !newQuestion.questionId.trim() || !newQuestion.prompt.trim()} type="button" onClick={() => void run(async () => {
          await post('/ops/api/website/questions/version', { ...newQuestion, kind: 'text' });
          setNewQuestion({ questionId: '', family: 'culture', prompt: '', optional: false });
        })}>CREATE VERSION</button>
      </article>
    </section>
  </div>;
}
