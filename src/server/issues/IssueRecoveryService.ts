import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  emailLookupHash,
  normalizeEmail,
  otpRequestTag,
  type ContactService,
} from '@/server/contact/ContactService';
import type { ExperienceAccessService } from '@/server/experience/ExperienceAccessService';
import type { IssueRecoveryTarget, IssueStatusRepository } from './IssueStatusRepository';

type RecoveryContacts = Pick<
  ContactService,
  'requestOtpForExperience' | 'verifyOtpForExperience'
>;

type RecoveryAccess = Pick<ExperienceAccessService, 'restore'>;

type OtpRequestResult = {
  challengeId: string;
  retryAfterSeconds: number;
  requestTag: string;
};

const RECOVERY_RETRY_SECONDS = 60;

function normalizeIssueCode(value: string): string {
  return value.trim().toUpperCase();
}

function looksLikeEmail(value: string): boolean {
  return Boolean(value && value.includes('@') && value.length <= 320);
}

function safeHashEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export class IssueRecoveryError extends Error {
  constructor(message = 'Issue recovery could not be verified') {
    super(message);
    this.name = 'IssueRecoveryError';
  }
}

export class IssueRecoveryService {
  constructor(
    private readonly issues: IssueStatusRepository,
    private readonly contacts: RecoveryContacts,
    private readonly access: RecoveryAccess,
    private readonly createDecoyChallengeId: () => string = randomUUID,
  ) {}

  private decoy(): OtpRequestResult {
    const challengeId = this.createDecoyChallengeId();
    return {
      challengeId,
      retryAfterSeconds: RECOVERY_RETRY_SECONDS,
      requestTag: otpRequestTag(challengeId),
    };
  }

  private async resolveTarget(issueCode: string, email: string): Promise<{
    target: IssueRecoveryTarget;
    email: string;
  } | null> {
    const lookup = this.issues.findRecoveryTargetByIssueCode;
    if (!lookup) return null;

    const normalizedIssueCode = normalizeIssueCode(issueCode);
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedIssueCode || !looksLikeEmail(normalizedEmail)) return null;

    const target = await lookup.call(this.issues, normalizedIssueCode);
    if (!target) return null;

    const candidateHash = emailLookupHash(normalizedEmail);
    if (!safeHashEqual(candidateHash, target.emailHash)) return null;
    return { target, email: normalizedEmail };
  }

  async requestOtp(input: {
    issueCode: string;
    email: string;
    ipKey: string;
  }): Promise<OtpRequestResult> {
    const resolved = await this.resolveTarget(input.issueCode, input.email);
    if (!resolved) return this.decoy();

    try {
      return await this.contacts.requestOtpForExperience({
        experienceId: resolved.target.experienceId,
        email: resolved.email,
        ipKey: input.ipKey,
      });
    } catch {
      // Keep delivery/rate-limit state indistinguishable from an unknown pair.
      return this.decoy();
    }
  }

  async verifyOtp(input: {
    issueCode: string;
    email: string;
    challengeId: string;
    code: string;
  }): Promise<{ token: string }> {
    const resolved = await this.resolveTarget(input.issueCode, input.email);
    if (!resolved) throw new IssueRecoveryError();

    try {
      await this.contacts.verifyOtpForExperience({
        experienceId: resolved.target.experienceId,
        challengeId: input.challengeId,
        code: input.code,
      });
      return await this.access.restore(resolved.target.experienceId);
    } catch {
      throw new IssueRecoveryError();
    }
  }
}
