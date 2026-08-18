'use client';

import { useState } from 'react';
import type { ObjectType } from './ObjectSelection';

export type CommitmentQuote = {
  quoteId: string;
  amountMinor: number;
  currency: string;
  expiresAt: string;
};

type CommitmentScreenProps = {
  selection: {
    object: ObjectType;
    sizeCode: string;
    colorLabel: string;
  };
  quote: CommitmentQuote;
  onCommit: (quoteId: string) => Promise<void> | void;
};

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function CommitmentScreen({ selection, quote, onCommit }: CommitmentScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const lockedSelection = `${selection.object.toUpperCase()} / ${selection.sizeCode.toUpperCase()} / ${selection.colorLabel.toUpperCase()}`;

  async function commit() {
    if (submitting) return;

    setSubmitting(true);
    try {
      await onCommit(quote.quoteId);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="commitment" aria-labelledby="commitment-heading" data-quote-id={quote.quoteId}>
      <p className="commitment__signal">FORM COMPLETE</p>
      <h1 id="commitment-heading">From here, it becomes ours to interpret.</h1>

      <div className="commitment__ledger" aria-label="Locked physical form">
        <span className="commitment__selection">{lockedSelection}</span>
        <span className="commitment__price">{formatMoney(quote.amountMinor, quote.currency)}</span>
      </div>

      <p className="commitment__unknown">Everything else stays unknown until it arrives.</p>

      <button type="button" onClick={commit} disabled={submitting}>
        {submitting ? '...' : 'ISSUE MINE'}
      </button>
    </section>
  );
}
