import { beforeAll, describe, expect, test, vi } from 'vitest';
import { emailLookupHash } from '@/server/contact/ContactService';
import { IssueRecoveryService } from '@/server/issues/IssueRecoveryService';
import type {
  IssueRecoveryTarget,
  IssueStatusRepository,
} from '@/server/issues/IssueStatusRepository';

beforeAll(() => {
  process.env.IDENTITY_HMAC_KEY = Buffer.alloc(32, 7).toString('base64');
});

function repository(target: IssueRecoveryTarget | null): IssueStatusRepository {
  return {
    async findBySessionHash() { return null; },
    async findByIssueCode() { return null; },
    async findRecoveryTargetByIssueCode(issueCode: string) {
      return issueCode === 'IO-ABCD-EFGH' ? target : null;
    },
  };
}

function harness(target: IssueRecoveryTarget | null = {
  experienceId: 'exp-paid-1',
  emailHash: emailLookupHash('buyer@example.com'),
}) {
  const requestOtpForExperience = vi.fn(async () => ({
    challengeId: 'real-challenge',
    retryAfterSeconds: 60,
    requestTag: 'REALTAG1',
  }));
  const verifyOtpForExperience = vi.fn(async () => ({ verified: true as const }));
  const restore = vi.fn(async () => ({ token: 'rotated-session-token' }));

  const service = new IssueRecoveryService(
    repository(target),
    { requestOtpForExperience, verifyOtpForExperience },
    { restore },
    () => 'decoy-challenge',
  );

  return { service, requestOtpForExperience, verifyOtpForExperience, restore };
}

describe('IssueRecoveryService', () => {
  test('sends OTP only when Issue Code and normalized email match the existing verified contact', async () => {
    const { service, requestOtpForExperience } = harness();

    await expect(service.requestOtp({
      issueCode: ' io-abcd-efgh ',
      email: ' Buyer@Example.com ',
      ipKey: 'browser-a',
    })).resolves.toEqual({
      challengeId: 'real-challenge',
      retryAfterSeconds: 60,
      requestTag: 'REALTAG1',
    });

    expect(requestOtpForExperience).toHaveBeenCalledWith({
      experienceId: 'exp-paid-1',
      email: 'buyer@example.com',
      ipKey: 'browser-a',
    });
  });

  test('returns the same public response shape for unknown Issue Codes and mismatched emails without sending mail', async () => {
    const unknown = harness(null);
    const mismatch = harness();

    const unknownResult = await unknown.service.requestOtp({
      issueCode: 'IO-MISS-ING1',
      email: 'buyer@example.com',
      ipKey: 'browser-a',
    });
    const mismatchResult = await mismatch.service.requestOtp({
      issueCode: 'IO-ABCD-EFGH',
      email: 'other@example.com',
      ipKey: 'browser-a',
    });

    expect(unknownResult).toEqual({
      challengeId: 'decoy-challenge',
      retryAfterSeconds: 60,
      requestTag: 'DECOYCHA',
    });
    expect(mismatchResult).toEqual(unknownResult);
    expect(unknown.requestOtpForExperience).not.toHaveBeenCalled();
    expect(mismatch.requestOtpForExperience).not.toHaveBeenCalled();
  });

  test('does not restore access when the OTP is wrong, stale, or belongs to another Issue experience', async () => {
    const { service, verifyOtpForExperience, restore } = harness();
    verifyOtpForExperience.mockRejectedValueOnce(new Error('OTP challenge not found'));

    await expect(service.verifyOtp({
      issueCode: 'IO-ABCD-EFGH',
      email: 'buyer@example.com',
      challengeId: 'other-issue-challenge',
      code: '123456',
    })).rejects.toThrow('Issue recovery could not be verified');

    expect(restore).not.toHaveBeenCalled();
  });

  test('rotates the existing Issue session only after successful ownership proof', async () => {
    const { service, verifyOtpForExperience, restore } = harness();

    await expect(service.verifyOtp({
      issueCode: 'io-abcd-efgh',
      email: 'BUYER@example.com',
      challengeId: 'real-challenge',
      code: '123456',
    })).resolves.toEqual({ token: 'rotated-session-token' });

    expect(verifyOtpForExperience).toHaveBeenCalledWith({
      experienceId: 'exp-paid-1',
      challengeId: 'real-challenge',
      code: '123456',
    });
    expect(restore).toHaveBeenCalledWith('exp-paid-1');
  });
});
