'use client';

import { useEffect, useRef, useState } from 'react';
import type { ObjectType } from './ObjectSelection';

export type CommitmentQuote = {
  quoteId: string;
  amountMinor: number;
  currency: string;
  expiresAt: string;
  grossAmountMinor?: number;
  discountAmountMinor?: number;
  normalizedCode?: string;
};

export type ReferralApplicationQuote = {
  quoteId: string;
  grossAmountMinor: number;
  discountAmountMinor: number;
  amountMinor: number;
  currency: string;
  expiresAt?: string;
  applied: boolean;
  normalizedCode?: string;
};

type CommitmentScreenProps = {
  selection: {
    object: ObjectType;
    sizeCode: string;
    colorLabel: string;
  };
  quote: CommitmentQuote;
  onApplyReferral?: (
    quoteId: string,
    explicitCode?: string,
  ) => Promise<ReferralApplicationQuote>;
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

function mergeReferralQuote(
  current: CommitmentQuote,
  result: ReferralApplicationQuote,
): CommitmentQuote {
  return {
    quoteId: result.quoteId,
    grossAmountMinor: result.grossAmountMinor,
    discountAmountMinor: result.discountAmountMinor,
    amountMinor: result.amountMinor,
    currency: result.currency,
    expiresAt: result.expiresAt ?? current.expiresAt,
    ...(result.normalizedCode ? { normalizedCode: result.normalizedCode } : {}),
  };
}

export function CommitmentScreen({
  selection,
  quote,
  onApplyReferral,
  onCommit,
}: CommitmentScreenProps) {
  const [currentQuote, setCurrentQuote] = useState<CommitmentQuote>(quote);
  const [referralCode, setReferralCode] = useState('');
  const [referralPending, setReferralPending] = useState(Boolean(onApplyReferral));
  const [referralState, setReferralState] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const automaticRequest = useRef<{
    quoteId: string;
    promise: Promise<ReferralApplicationQuote>;
  } | null>(null);
  const lockedSelection = `${selection.object.toUpperCase()} / ${selection.sizeCode.toUpperCase()} / ${selection.colorLabel.toUpperCase()}`;
  const grossAmountMinor = currentQuote.grossAmountMinor ?? currentQuote.amountMinor;
  const discountAmountMinor = currentQuote.discountAmountMinor ?? 0;
  const hasDiscount = discountAmountMinor > 0;

  useEffect(() => {
    if (!onApplyReferral) return;

    let request = automaticRequest.current;
    if (!request || request.quoteId !== quote.quoteId) {
      request = {
        quoteId: quote.quoteId,
        promise: onApplyReferral(quote.quoteId),
      };
      automaticRequest.current = request;
    }

    let active = true;
    void request.promise
      .then((result) => {
        if (!active || !result.applied) return;
        setCurrentQuote((current) => mergeReferralQuote(current, result));
      })
      .catch(() => {
        // Captured-link attribution is optional. Checkout remains available on
        // the original frozen quote when the referral service cannot apply it.
      })
      .finally(() => {
        if (active) setReferralPending(false);
      });

    return () => {
      active = false;
    };
  }, [onApplyReferral, quote.quoteId]);

  async function applyCode() {
    const code = referralCode.trim();
    if (!onApplyReferral || !code || referralPending || submitting) return;

    setReferralPending(true);
    setReferralState(null);
    try {
      const result = await onApplyReferral(currentQuote.quoteId, code);
      if (!result.applied) {
        setReferralState('CODE NOT APPLIED');
        return;
      }
      setCurrentQuote((current) => mergeReferralQuote(current, result));
      setReferralCode('');
      setReferralState(
        result.normalizedCode ? `${result.normalizedCode} APPLIED` : 'CODE APPLIED',
      );
    } catch {
      setReferralState('CODE NOT APPLIED / TRY AGAIN');
    } finally {
      setReferralPending(false);
    }
  }

  async function commit() {
    if (submitting || referralPending) return;

    setSubmitting(true);
    setCheckoutError(null);
    try {
      await onCommit(currentQuote.quoteId);
    } catch {
      setCheckoutError('CHECKOUT NOT OPENED / TRY AGAIN');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="commitment"
      aria-labelledby="commitment-heading"
      data-quote-id={currentQuote.quoteId}
    >
      <p className="commitment__signal">FORM COMPLETE</p>
      <h1 id="commitment-heading">From here, it becomes ours to interpret.</h1>

      <div className="commitment__ledger" aria-label="Locked physical form">
        <span className="commitment__selection">{lockedSelection}</span>
        {hasDiscount ? (
          <span className="commitment__price-stack" aria-label="Price after referral">
            <span className="commitment__price-row">
              <span>FORM</span>
              <span>{formatMoney(grossAmountMinor, currentQuote.currency)}</span>
            </span>
            <span className="commitment__price-row commitment__price-row--discount">
              <span>REFERRAL</span>
              <span>-{formatMoney(discountAmountMinor, currentQuote.currency)}</span>
            </span>
            <span className="commitment__price-row commitment__price-row--final">
              <span>FINAL</span>
              <span>{formatMoney(currentQuote.amountMinor, currentQuote.currency)}</span>
            </span>
          </span>
        ) : (
          <span className="commitment__price">
            {formatMoney(currentQuote.amountMinor, currentQuote.currency)}
          </span>
        )}
      </div>

      {onApplyReferral ? (
        <div className="commitment__referral">
          <label htmlFor="commitment-referral-code">REFERRAL CODE</label>
          <div className="commitment__referral-entry">
            <input
              id="commitment-referral-code"
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              autoComplete="off"
              maxLength={32}
              disabled={referralPending || submitting}
            />
            <button
              type="button"
              className="commitment__referral-apply"
              onClick={applyCode}
              disabled={!referralCode.trim() || referralPending || submitting}
            >
              {referralPending ? 'CHECKING' : 'APPLY CODE'}
            </button>
          </div>
          {referralState ? (
            <p className="commitment__referral-state" role="status">
              {referralState}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="commitment__unknown">Everything else stays unknown until it arrives.</p>

      {checkoutError ? (
        <p className="commitment__checkout-state" role="status">
          {checkoutError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={commit}
        disabled={submitting || referralPending}
      >
        {submitting ? 'OPENING CHECKOUT' : referralPending ? 'CHECKING REFERRAL' : 'ISSUE MINE'}
      </button>
    </section>
  );
}
