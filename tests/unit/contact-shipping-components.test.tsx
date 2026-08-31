import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ContactVerification } from '@/components/experience/ContactVerification';
import { ShippingAddressForm } from '@/components/experience/ShippingAddressForm';

test('contact step asks once, sends OTP, and cannot continue until verification succeeds', async () => {
  const user = userEvent.setup();
  const requestOtp = vi.fn(async () => ({ challengeId: 'challenge-1', retryAfterSeconds: 60 }));
  const verifyOtp = vi.fn(async () => ({ verified: true as const }));
  const complete = vi.fn();
  render(<ContactVerification onRequestOtp={requestOtp} onVerifyOtp={verifyOtp} onComplete={complete} />);

  expect(screen.getByRole('heading', { name: 'Where do we find you?' })).toBeInTheDocument();
  await user.type(screen.getByLabelText('Email'), 'sam@example.com');
  await user.click(screen.getByRole('button', { name: 'SEND CODE' }));
  expect(requestOtp).toHaveBeenCalledWith('sam@example.com');
  expect(screen.getByText(/six digits/i)).toBeInTheDocument();

  await user.type(screen.getByLabelText('Verification code'), '123456');
  await user.click(screen.getByRole('button', { name: 'VERIFY' }));
  expect(verifyOtp).toHaveBeenCalledWith('challenge-1', '123456');
  expect(complete).toHaveBeenCalledTimes(1);
});

test('shipping step applies country-specific region requirements and keeps courier phone optional', async () => {
  const user = userEvent.setup();
  const submit = vi.fn(async () => undefined);
  render(<ShippingAddressForm onSubmit={submit} />);

  const region = screen.getByLabelText('Province / state / region');
  const phone = screen.getByLabelText('Phone');
  expect(region).not.toBeRequired();
  expect(phone).not.toBeRequired();

  await user.selectOptions(screen.getByLabelText('Country'), 'US');
  expect(region).toBeRequired();

  await user.selectOptions(screen.getByLabelText('Country'), 'GB');
  expect(region).not.toBeRequired();
});

test('shipping step submits a valid international address without region or phone', async () => {
  const user = userEvent.setup();
  const submit = vi.fn(async () => undefined);
  render(<ShippingAddressForm onSubmit={submit} />);

  expect(screen.getByRole('heading', { name: 'Where does it go?' })).toBeInTheDocument();
  await user.type(screen.getByLabelText('Name'), 'Sam Example');
  await user.type(screen.getByLabelText('Address'), '1 Quiet Street');
  await user.type(screen.getByLabelText('City'), 'London');
  await user.type(screen.getByLabelText('Postal code'), 'SW1A 1AA');
  await user.selectOptions(screen.getByLabelText('Country'), 'GB');
  await user.click(screen.getByRole('button', { name: 'USE THIS ADDRESS' }));

  expect(submit).toHaveBeenCalledWith(expect.objectContaining({
    recipientName: 'Sam Example',
    line1: '1 Quiet Street',
    city: 'London',
    region: '',
    postalCode: 'SW1A 1AA',
    countryCode: 'GB',
    phone: '',
  }));
  expect(screen.queryByText(/issue id|contact id/i)).not.toBeInTheDocument();
});
