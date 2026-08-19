import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MysteryExperience } from '@/components/experience/MysteryExperience';

const quote = {
  quoteId: 'quote-final',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: '2026-08-19T06:00:00.000Z',
};

test('requires verified contact and shipping before commitment, then opens the payment callback', async () => {
  const user = userEvent.setup();
  const onRequestOtp = vi.fn().mockResolvedValue({ challengeId: 'challenge-1', retryAfterSeconds: 60 });
  const onVerifyOtp = vi.fn().mockResolvedValue({ verified: true as const });
  const onShippingSubmitted = vi.fn().mockResolvedValue(undefined);
  const onCheckoutRequested = vi.fn().mockResolvedValue(undefined);

  render(
    <MysteryExperience
      interviewInitiallyComplete
      onAnswer={vi.fn()}
      onObjectSelected={vi.fn().mockResolvedValue([{ code: 'M', label: 'Medium' }])}
      onSizeConfirmed={vi.fn().mockResolvedValue([{ code: 'Black', label: 'Black', swatch: '#171713' }])}
      onBaseColorConfirmed={vi.fn().mockResolvedValue(quote)}
      onRequestOtp={onRequestOtp}
      onVerifyOtp={onVerifyOtp}
      onShippingSubmitted={onShippingSubmitted}
      onCheckoutRequested={onCheckoutRequested}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'UNLOCK FORM' }));
  await user.click(screen.getByRole('radio', { name: 'TEE' }));
  await user.click(screen.getByRole('button', { name: 'LOCK FORM' }));
  await user.click(screen.getByRole('radio', { name: /M/ }));
  await user.click(screen.getByRole('button', { name: 'CONFIRM SIZE' }));
  await user.click(screen.getByRole('radio', { name: 'Black' }));
  await user.click(screen.getByRole('button', { name: 'LOCK BASE' }));

  expect(screen.getByRole('heading', { name: 'Where do we find you?' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'From here, it becomes ours to interpret.' })).not.toBeInTheDocument();

  await user.type(screen.getByLabelText('Email'), 'sam@example.com');
  await user.click(screen.getByRole('button', { name: 'SEND CODE' }));
  expect(onRequestOtp).toHaveBeenCalledWith('sam@example.com');

  await user.type(screen.getByLabelText('Verification code'), '123456');
  await user.click(screen.getByRole('button', { name: 'VERIFY' }));
  expect(onVerifyOtp).toHaveBeenCalledWith('challenge-1', '123456');

  expect(screen.getByRole('heading', { name: 'Where does it go?' })).toBeInTheDocument();

  await user.type(screen.getByLabelText('Name'), 'Sam Example');
  await user.type(screen.getByLabelText('Address'), '1 Quiet Street');
  await user.type(screen.getByLabelText('City'), 'Peshawar');
  await user.type(screen.getByLabelText('Postal code'), '25000');
  await user.selectOptions(screen.getByLabelText('Country'), 'PK');
  await user.click(screen.getByRole('button', { name: 'USE THIS ADDRESS' }));

  expect(onShippingSubmitted).toHaveBeenCalledWith(expect.objectContaining({
    recipientName: 'Sam Example',
    line1: '1 Quiet Street',
    city: 'Peshawar',
    postalCode: '25000',
    countryCode: 'PK',
  }));

  expect(screen.getByRole('heading', { name: 'From here, it becomes ours to interpret.' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'ISSUE MINE' }));
  expect(onCheckoutRequested).toHaveBeenCalledWith('quote-final');
});
