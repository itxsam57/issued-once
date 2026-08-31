'use client';

import { useState, type FormEvent } from 'react';
import styles from './issue-support-form.module.css';

export type IssueSupportInput = {
  category: string;
  message: string;
};

export type IssueSupportResult = {
  reference: string;
};

type IssueSupportFormProps = {
  submitRequest?: (input: IssueSupportInput) => Promise<IssueSupportResult>;
};

const reasons = [
  { value: 'order-status', label: 'Order status' },
  { value: 'delivery-tracking', label: 'Delivery or tracking' },
  { value: 'access-recovery', label: 'Issue access or recovery' },
  { value: 'payment-refund', label: 'Payment or refund' },
  { value: 'other', label: 'Something else' },
] as const;

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export async function submitIssueSupportRequest(input: IssueSupportInput): Promise<IssueSupportResult> {
  const category = input.category.trim();
  const message = input.message.trim();
  if (!category || message.length < 2) throw new Error('invalid support request');

  const response = await fetch('/api/support', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: `Reason: ${category}\n\n${message}` }),
  });
  const payload = await parseJson(response);
  const reference = typeof payload.reference === 'string' ? payload.reference.trim() : '';
  if (!response.ok || payload.received !== true || !reference) {
    throw new Error('support request failed');
  }
  return { reference };
}

export function IssueSupportForm({ submitRequest = submitIssueSupportRequest }: IssueSupportFormProps) {
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedMessage = message.trim();
    if (!category || normalizedMessage.length < 2) {
      setFailed(true);
      return;
    }

    setSubmitting(true);
    setFailed(false);
    setReference(null);
    try {
      const result = await submitRequest({ category, message: normalizedMessage });
      setReference(result.reference);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.support} aria-labelledby="issue-support-title">
      <p className={styles.signal}>SUPPORT / ATTACHED TO THIS ISSUE</p>
      <h2 id="issue-support-title">Need help?</h2>
      <p className={styles.intro}>Tell us what happened. Your request stays attached to this Issue.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Reason</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} required disabled={submitting}>
            <option value="">Choose one</option>
            {reasons.map((reason) => (
              <option key={reason.value} value={reason.value}>{reason.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>What happened?</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            minLength={2}
            maxLength={4500}
            rows={5}
            required
            disabled={submitting}
            placeholder="A short description is enough."
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'SENDING…' : 'SEND TO SUPPORT'}
        </button>
      </form>

      {reference ? (
        <p className={styles.success} role="status">
          Support request received. Reference: <strong>{reference}</strong>
        </p>
      ) : null}
      {failed ? (
        <p className={styles.error} role="alert">We couldn&apos;t send your request. Please try again.</p>
      ) : null}
    </section>
  );
}
