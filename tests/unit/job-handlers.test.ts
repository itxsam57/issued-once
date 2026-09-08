import { afterEach, expect, test, vi } from 'vitest';

const {
  createForIssue,
  regenerateArtwork,
  captureCurrentCandidate,
  afterGeneratedReview,
  sendCustomer,
  sendReferral,
  referralsAreEnabled,
} = vi.hoisted(() => ({
  createForIssue: vi.fn(),
  regenerateArtwork: vi.fn(),
  captureCurrentCandidate: vi.fn(),
  afterGeneratedReview: vi.fn(),
  sendCustomer: vi.fn(),
  sendReferral: vi.fn(),
  referralsAreEnabled: vi.fn(() => false),
}));

vi.mock('@/server/design/runtimeDesign', () => ({
  createDesignService: () => ({ createForIssue, regenerateArtwork }),
}));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsDesignerStore: () => ({ captureCurrentCandidate }),
  createDesignPolicyWorkflowService: () => ({ afterGeneratedReview }),
}));
vi.mock('@/server/notifications/runtimeNotifications', () => ({
  createCustomerNotificationService: () => ({ send: sendCustomer }),
}));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  referralsAreEnabled,
  createReferralNotificationService: () => ({ send: sendReferral }),
}));

import { PermanentJobError } from '@/server/jobs/JobProcessor';
import { handleNotificationJob } from '@/server/jobs/issuedOnceJobHandlers';

afterEach(() => {
  vi.clearAllMocks();
  referralsAreEnabled.mockReturnValue(false);
});

test('notification job handler preserves ordinary issue notification delivery', async () => {
  sendCustomer.mockResolvedValueOnce(undefined);
  await handleNotificationJob({
    issueId: '11111111-1111-4111-8111-111111111111',
    eventKey: 'SHIPPED',
  });
  expect(sendCustomer).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'SHIPPED');
  expect(sendReferral).not.toHaveBeenCalled();
});

test('referral jobs remain rollout-gated and preserve delivery when enabled', async () => {
  const payload = {
    referralConversionId: '22222222-2222-4222-8222-222222222222',
    referralEventKey: 'SALE' as const,
  };

  await expect(handleNotificationJob(payload)).rejects.toBeInstanceOf(PermanentJobError);
  expect(sendReferral).not.toHaveBeenCalled();

  referralsAreEnabled.mockReturnValue(true);
  sendReferral.mockResolvedValueOnce(undefined);
  await handleNotificationJob(payload);
  expect(sendReferral).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', 'SALE');
});

test('invalid notification payload is a permanent job failure', async () => {
  await expect(handleNotificationJob({ issueId: 'not-a-uuid', eventKey: 'SHIPPED' }))
    .rejects.toBeInstanceOf(PermanentJobError);
});
