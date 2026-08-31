import { beforeEach, expect, test, vi } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';

const {
  createPaymentServiceMock,
  createIssueServiceMock,
  reserveForPaidAttemptMock,
  dispatchPaidIssueDesignMock,
  enqueueIssueNotificationMock,
  createReferralConversionServiceMock,
  referralsAreEnabledMock,
  recordPaidAttemptMock,
  enqueueReferralNotificationMock,
  getExperienceRepositoryMock,
  rotateSessionHashMock,
  rotateSessionHashIfCurrentMock,
} = vi.hoisted(() => ({
  createPaymentServiceMock: vi.fn(),
  createIssueServiceMock: vi.fn(),
  reserveForPaidAttemptMock: vi.fn(),
  dispatchPaidIssueDesignMock: vi.fn(),
  enqueueIssueNotificationMock: vi.fn(),
  createReferralConversionServiceMock: vi.fn(),
  referralsAreEnabledMock: vi.fn(),
  recordPaidAttemptMock: vi.fn(),
  enqueueReferralNotificationMock: vi.fn(),
  getExperienceRepositoryMock: vi.fn(),
  rotateSessionHashMock: vi.fn(),
  rotateSessionHashIfCurrentMock: vi.fn(),
}));

vi.mock('@/server/payments/runtimePayments', () => ({
  createPaymentService: createPaymentServiceMock,
}));
vi.mock('@/server/issues/runtimeIssues', () => ({
  createIssueService: createIssueServiceMock,
}));
vi.mock('@/server/design/designDispatch', () => ({
  dispatchPaidIssueDesign: dispatchPaidIssueDesignMock,
}));
vi.mock('@/server/notifications/notificationQueue', () => ({
  enqueueIssueNotification: enqueueIssueNotificationMock,
}));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  createReferralConversionService: createReferralConversionServiceMock,
  referralsAreEnabled: referralsAreEnabledMock,
}));
vi.mock('@/server/referrals/referralNotificationQueue', () => ({
  enqueueReferralNotification: enqueueReferralNotificationMock,
}));
vi.mock('@/server/experience/runtimeRepository', () => ({
  getExperienceRepository: getExperienceRepositoryMock,
}));

import { GET as paymentReturnGet, POST as paymentReturnPost } from '@/app/payment/return/route';

const currentToken = 'existing-browser-session-token';

beforeEach(() => {
  vi.clearAllMocks();
  reserveForPaidAttemptMock.mockResolvedValue({
    kind: 'reserved',
    issue: {
      id: 'issue-return-1',
      issueCode: 'IO-ABCD-EFGH',
      experienceId: 'exp-return-1',
    },
  });
  createIssueServiceMock.mockReturnValue({ reserveForPaidAttempt: reserveForPaidAttemptMock });
  referralsAreEnabledMock.mockReturnValue(false);
  createReferralConversionServiceMock.mockReturnValue({ recordPaidAttempt: recordPaidAttemptMock });
  recordPaidAttemptMock.mockResolvedValue({ kind: 'not-referred' });
  dispatchPaidIssueDesignMock.mockResolvedValue({ mode: 'HYBRID', queued: true, policyVersion: 1 });
  enqueueIssueNotificationMock.mockResolvedValue({ messageId: 'notify-return-1' });
  enqueueReferralNotificationMock.mockResolvedValue({ messageId: 'referral-return-1' });
  rotateSessionHashMock.mockResolvedValue(true);
  rotateSessionHashIfCurrentMock.mockResolvedValue(true);
  getExperienceRepositoryMock.mockReturnValue({
    rotateSessionHash: rotateSessionHashMock,
    rotateSessionHashIfCurrent: rotateSessionHashIfCurrentMock,
  });
});

test('GET payment return uses Reporter-backed reconciliation before finalizing the paid Issue', async () => {
  const reconcileTracker = vi.fn().mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-return-1' });
  createPaymentServiceMock.mockReturnValue({ reconcileTracker });

  const response = await paymentReturnGet(new Request('https://issuedonce.shop/payment/return?tracker=track_return_1', {
    headers: { cookie: `__Host-io_session=${currentToken}` },
  }));

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('https://issuedonce.shop/issue');
  expect(reconcileTracker).toHaveBeenCalledWith({ providerReference: 'track_return_1' });
  expect(reserveForPaidAttemptMock).toHaveBeenCalledWith('attempt-return-1');
  expect(dispatchPaidIssueDesignMock).toHaveBeenCalledWith('issue-return-1');
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith('issue-return-1', 'PAYMENT_RECEIVED');
});

test('GET paid return compare-and-swaps the current Issue session before restoring the cookie', async () => {
  const reconcileTracker = vi.fn().mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-return-1' });
  createPaymentServiceMock.mockReturnValue({ reconcileTracker });

  const response = await paymentReturnGet(new Request('https://issuedonce.shop/payment/return?tracker=track_return_1', {
    headers: { cookie: `__Host-io_session=${currentToken}` },
  }));

  expect(rotateSessionHashIfCurrentMock).toHaveBeenCalledWith(expect.objectContaining({
    experienceId: 'exp-return-1',
    expectedPublicSessionHash: hashSessionToken(currentToken),
    publicSessionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  }));
  expect(rotateSessionHashMock).not.toHaveBeenCalled();
  const setCookie = response.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain('__Host-io_session=');
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('Secure');
  expect(setCookie).toContain('SameSite=lax');
});

test('paid tracker without the current Issue session finalizes payment but does not mint Issue access', async () => {
  const reconcileTracker = vi.fn().mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-return-1' });
  createPaymentServiceMock.mockReturnValue({ reconcileTracker });

  const response = await paymentReturnGet(new Request('https://issuedonce.shop/payment/return?tracker=track_return_1'));

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('https://issuedonce.shop/payment/pending');
  expect(reserveForPaidAttemptMock).toHaveBeenCalledWith('attempt-return-1');
  expect(dispatchPaidIssueDesignMock).toHaveBeenCalledWith('issue-return-1');
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith('issue-return-1', 'PAYMENT_RECEIVED');
  expect(rotateSessionHashIfCurrentMock).not.toHaveBeenCalled();
  expect(rotateSessionHashMock).not.toHaveBeenCalled();
  expect(response.headers.get('set-cookie')).toBeNull();
});

test('POST payment return reconciles a form tracker instead of discarding it', async () => {
  const reconcileTracker = vi.fn().mockResolvedValue({ kind: 'pending', paymentAttemptId: 'attempt-return-1' });
  createPaymentServiceMock.mockReturnValue({ reconcileTracker });

  const response = await paymentReturnPost(new Request('https://issuedonce.shop/payment/return', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'tracker=track_return_1',
  }));

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('https://issuedonce.shop/payment/pending');
  expect(reconcileTracker).toHaveBeenCalledWith({ providerReference: 'track_return_1' });
  expect(reserveForPaidAttemptMock).not.toHaveBeenCalled();
  expect(rotateSessionHashIfCurrentMock).not.toHaveBeenCalled();
  expect(rotateSessionHashMock).not.toHaveBeenCalled();
  expect(response.headers.get('set-cookie')).toBeNull();
});
