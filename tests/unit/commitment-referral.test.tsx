import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { CommitmentScreen } from '@/components/experience/CommitmentScreen';

const initialQuote = {
  quoteId: 'quote-gross',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: '2026-08-21T12:00:00.000Z',
};

const selection = { object: 'tee' as const, sizeCode: 'M', colorLabel: 'Black' };

test('captured link attribution is applied once at commitment and checkout uses the newest discounted quote', async () => {
  const onApplyReferral = vi.fn().mockResolvedValue({
    quoteId: 'quote-link',
    grossAmountMinor: 5400,
    discountAmountMinor: 540,
    amountMinor: 4860,
    currency: 'USD',
    expiresAt: initialQuote.expiresAt,
    applied: true,
    normalizedCode: 'CREATOR-ONE',
  });
  const onCommit = vi.fn();

  render(
    <CommitmentScreen
      selection={selection}
      quote={initialQuote}
      onApplyReferral={onApplyReferral}
      onCommit={onCommit}
    />,
  );

  await waitFor(() => expect(onApplyReferral).toHaveBeenCalledTimes(1));
  expect(onApplyReferral).toHaveBeenCalledWith('quote-gross');
  expect(screen.getByText('$54.00')).toBeInTheDocument();
  expect(screen.getByText('-$5.40')).toBeInTheDocument();
  expect(screen.getByText('$48.60')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /issue mine/i }));
  expect(onCommit).toHaveBeenCalledWith('quote-link');
});

test('manual code replaces an earlier link attribution without stacking and updates the checkout quote id', async () => {
  const onApplyReferral = vi.fn()
    .mockResolvedValueOnce({
      quoteId: 'quote-link', grossAmountMinor: 5400, discountAmountMinor: 540, amountMinor: 4860,
      currency: 'USD', expiresAt: initialQuote.expiresAt, applied: true, normalizedCode: 'CREATOR-ONE',
    })
    .mockResolvedValueOnce({
      quoteId: 'quote-code', grossAmountMinor: 5400, discountAmountMinor: 1080, amountMinor: 4320,
      currency: 'USD', expiresAt: initialQuote.expiresAt, applied: true, normalizedCode: 'NEWCODE',
    });
  const onCommit = vi.fn();

  render(
    <CommitmentScreen
      selection={selection}
      quote={initialQuote}
      onApplyReferral={onApplyReferral}
      onCommit={onCommit}
    />,
  );
  await waitFor(() => expect(onApplyReferral).toHaveBeenCalledTimes(1));

  const input = screen.getByRole('textbox', { name: /referral code/i });
  await userEvent.type(input, '  newcode  ');
  await userEvent.click(screen.getByRole('button', { name: /apply code/i }));

  await waitFor(() => expect(onApplyReferral).toHaveBeenCalledTimes(2));
  expect(onApplyReferral).toHaveBeenLastCalledWith('quote-link', 'newcode');
  expect(screen.getByText('-$10.80')).toBeInTheDocument();
  expect(screen.getByText('$43.20')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /issue mine/i }));
  expect(onCommit).toHaveBeenCalledWith('quote-code');
});

test('invalid manual code leaves the current quote intact and tells the customer it was not applied', async () => {
  const onApplyReferral = vi.fn()
    .mockResolvedValueOnce({
      quoteId: 'quote-link', grossAmountMinor: 5400, discountAmountMinor: 540, amountMinor: 4860,
      currency: 'USD', expiresAt: initialQuote.expiresAt, applied: true, normalizedCode: 'CREATOR-ONE',
    })
    .mockResolvedValueOnce({
      quoteId: 'quote-link', grossAmountMinor: 5400, discountAmountMinor: 540, amountMinor: 4860,
      currency: 'USD', expiresAt: initialQuote.expiresAt, applied: false,
    });
  const onCommit = vi.fn();

  render(
    <CommitmentScreen
      selection={selection}
      quote={initialQuote}
      onApplyReferral={onApplyReferral}
      onCommit={onCommit}
    />,
  );
  await waitFor(() => expect(onApplyReferral).toHaveBeenCalledTimes(1));
  await userEvent.type(screen.getByRole('textbox', { name: /referral code/i }), 'badcode');
  await userEvent.click(screen.getByRole('button', { name: /apply code/i }));

  expect(await screen.findByText(/code not applied/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /issue mine/i }));
  expect(onCommit).toHaveBeenCalledWith('quote-link');
});
