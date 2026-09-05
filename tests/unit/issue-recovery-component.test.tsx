import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { IssueRecoveryForm } from '@/components/experience/IssueRecoveryForm';

test('Issue recovery asks for Issue Code and email, stays neutral before proof, then restores after OTP', async () => {
  const user = userEvent.setup();
  const requestOtp = vi.fn(async () => ({
    challengeId: 'challenge-1',
    retryAfterSeconds: 60,
    requestTag: 'CHALLENG',
  }));
  const verifyOtp = vi.fn(async () => ({ restored: true as const }));
  const complete = vi.fn();

  render(
    <IssueRecoveryForm
      onRequestOtp={requestOtp}
      onVerifyOtp={verifyOtp}
      onComplete={complete}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Find your Issue.' })).toBeInTheDocument();
  await user.type(screen.getByLabelText('Issue Code'), ' io-abcd-efgh ');
  await user.type(screen.getByLabelText('Email'), ' Buyer@Example.com ');
  await user.click(screen.getByRole('button', { name: 'SEND CODE' }));

  expect(requestOtp).toHaveBeenCalledWith({
    issueCode: 'io-abcd-efgh',
    email: 'Buyer@Example.com',
  });
  expect(screen.getByText('If those details match an Issue, six digits are on the way.')).toBeInTheDocument();
  expect(screen.getByText('CHALLENG').parentElement).toHaveTextContent('Request CHALLENG');
  expect(screen.queryByText(/we found|does not exist|no issue/i)).not.toBeInTheDocument();

  await user.type(screen.getByLabelText('Verification code'), '123456');
  await user.click(screen.getByRole('button', { name: 'RESTORE ISSUE' }));

  expect(verifyOtp).toHaveBeenCalledWith({
    issueCode: 'io-abcd-efgh',
    email: 'Buyer@Example.com',
    challengeId: 'challenge-1',
    code: '123456',
  });
  expect(complete).toHaveBeenCalledTimes(1);
});
