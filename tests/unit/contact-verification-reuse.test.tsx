import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContactVerification } from '@/components/experience/ContactVerification';

function renderContact(options?: {
  alreadyVerified?: boolean;
  verifyError?: Error & { code?: string; attemptsRemaining?: number };
}) {
  const onCheckEmail = vi.fn(async () => ({ alreadyVerified: options?.alreadyVerified ?? false }));
  const onReuseVerified = vi.fn(async () => ({ verified: true as const }));
  const onRequestOtp = vi.fn(async () => ({
    challengeId: '6c6ba8d3-1111-2222-3333-444444444444',
    retryAfterSeconds: 60,
    requestTag: '6C6BA8D3',
  }));
  const onVerifyOtp = options?.verifyError
    ? vi.fn(async () => { throw options.verifyError; })
    : vi.fn(async () => ({ verified: true as const }));
  const onComplete = vi.fn();

  render(
    <ContactVerification
      onCheckEmail={onCheckEmail}
      onReuseVerified={onReuseVerified}
      onRequestOtp={onRequestOtp}
      onVerifyOtp={onVerifyOtp}
      onComplete={onComplete}
    />,
  );

  return { onCheckEmail, onReuseVerified, onRequestOtp, onVerifyOtp, onComplete };
}

async function enterEmail(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'sam@example.com');
  await user.click(screen.getByRole('button', { name: /continue|send code/i }));
}

describe('repeat contact verification UI', () => {
  it('requires explicit confirmation before reusing a securely matched prior email', async () => {
    const user = userEvent.setup();
    const calls = renderContact({ alreadyVerified: true });
    await enterEmail(user);

    expect(calls.onCheckEmail).toHaveBeenCalledWith('sam@example.com');
    expect(calls.onRequestOtp).not.toHaveBeenCalled();
    expect(screen.getByText('THIS EMAIL IS ALREADY VERIFIED.')).toBeInTheDocument();
    expect(calls.onComplete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'USE THIS EMAIL' }));
    expect(calls.onReuseVerified).toHaveBeenCalledWith('sam@example.com');
    expect(calls.onComplete).toHaveBeenCalledTimes(1);
  });

  it('CHANGE EMAIL returns to editable entry without silently verifying anything', async () => {
    const user = userEvent.setup();
    const calls = renderContact({ alreadyVerified: true });
    await enterEmail(user);

    await user.click(screen.getByRole('button', { name: 'CHANGE EMAIL' }));
    expect(screen.getByLabelText('Email')).toHaveValue('sam@example.com');
    expect(calls.onReuseVerified).not.toHaveBeenCalled();
    expect(calls.onComplete).not.toHaveBeenCalled();
  });

  it('nonmatching email requests OTP and displays the active request tag', async () => {
    const user = userEvent.setup();
    const calls = renderContact();
    await enterEmail(user);

    expect(calls.onCheckEmail).toHaveBeenCalledWith('sam@example.com');
    expect(calls.onRequestOtp).toHaveBeenCalledWith('sam@example.com');
    expect(screen.getByText((_, node) => node?.textContent === 'Request 6C6BA8D3')).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });

  it('shows remaining attempts on a wrong code', async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error('That code did not match.'), {
      code: 'WRONG_CODE',
      attemptsRemaining: 4,
    });
    renderContact({ verifyError: error });
    await enterEmail(user);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'VERIFY' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/4 attempts/i);
  });

  it('exposes SEND NEW CODE after the active challenge is locked or expired', async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error('Too many incorrect codes.'), {
      code: 'ATTEMPT_LIMIT',
      attemptsRemaining: 0,
    });
    const calls = renderContact({ verifyError: error });
    await enterEmail(user);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'VERIFY' }));

    expect(screen.getByRole('button', { name: 'SEND NEW CODE' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'SEND NEW CODE' }));
    expect(calls.onRequestOtp).toHaveBeenCalledTimes(2);
  });
});