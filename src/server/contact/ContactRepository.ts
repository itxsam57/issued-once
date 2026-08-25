import type { EncryptedPayload } from '@/server/crypto/privatePayload';

export type OtpChallengeRecord = {
  id: string;
  experienceId: string;
  emailHash: string;
  encryptedEmail: EncryptedPayload;
  ipHash: string;
  codeHash: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  attemptsRemaining: number;
  consumedAt: Date | null;
  createdAt: Date;
};

export type VerifiedContactRecord = {
  id: string;
  experienceId: string;
  emailHash: string;
  encryptedEmail: EncryptedPayload;
  verifiedAt: Date;
};

export type OtpRateLimitSubject = 'email' | 'experience' | 'ip';

export type OtpRateLimitReservation = {
  subjectKind: OtpRateLimitSubject;
  subjectHash: string;
  now: Date;
  shortWindowCutoff: Date;
  longWindowCutoff: Date;
  shortLimit: number;
  longLimit: number;
};

export type OtpIpChallengeCounts = {
  shortWindow: number;
  longWindow: number;
};

export interface ContactRepository {
  findRecentChallenge(
    experienceId: string,
    emailHash: string,
  ): Promise<OtpChallengeRecord | null>;
  reserveOtpRateLimit?(input: OtpRateLimitReservation): Promise<boolean>;
  getRecentIpChallengeCounts?(): Promise<OtpIpChallengeCounts>;
  createChallenge(record: OtpChallengeRecord): Promise<void>;
  findChallenge(challengeId: string): Promise<OtpChallengeRecord | null>;
  recordFailedAttempt(challengeId: string, attemptsRemaining: number): Promise<void>;
  verifyContact(input: {
    challengeId: string;
    contact: VerifiedContactRecord;
  }): Promise<boolean>;
  findVerifiedByExperienceId(experienceId: string): Promise<VerifiedContactRecord | null>;
  copyVerifiedContact(input: {
    sourceContactId: string;
    targetExperienceId: string;
    expectedEmailHash: string;
    newContactId: string;
    now: Date;
  }): Promise<boolean>;
}
