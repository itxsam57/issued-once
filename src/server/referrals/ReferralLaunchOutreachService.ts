import { randomUUID } from 'node:crypto';
import { decryptPrivatePayload, type EncryptedPayload } from '@/server/crypto/privatePayload';
import type { CustomerEmailGateway } from '@/server/notifications/CustomerEmailGateway';

export type CreatorOutreachCandidate = {
  creatorId: string;
  displayName: string;
  normalizedCode: string;
  encryptedEmail: EncryptedPayload;
};

export type ReferralLaunchOutreachRepository = {
  listActiveCreatorsForOutreach(campaign: string, limit: number): Promise<CreatorOutreachCandidate[]>;
  reserveOutreach(input: { id: string; creatorId: string; campaign: string; now: Date }): Promise<boolean>;
  markOutreachSent(creatorId: string, campaign: string, providerMessageId: string, at: Date): Promise<void>;
  markOutreachFailed(creatorId: string, campaign: string, errorCode: string, at: Date): Promise<void>;
};

type Dependencies = {
  repository: ReferralLaunchOutreachRepository;
  gateway: CustomerEmailGateway;
  appOrigin: string;
  decrypt?: (payload: EncryptedPayload) => Promise<{ email: string }>;
  now?: () => Date;
  createDeliveryId?: () => string;
};

function campaignSlug(input: string): string {
  const value = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(value)) {
    throw new Error('Referral outreach campaign is invalid');
  }
  return value;
}

function batchLimit(input: number): number {
  if (!Number.isSafeInteger(input) || input < 1 || input > 100) {
    throw new Error('Referral outreach batch limit must be between 1 and 100');
  }
  return input;
}

function origin(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Referral outreach app origin is invalid');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('Referral outreach app origin must use HTTPS');
  }
  parsed.pathname = '/';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function creatorEmail(input: string): string {
  const value = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 320) {
    throw new Error('Creator email is unavailable');
  }
  return value;
}

function creatorName(input: string): string {
  const value = input.trim();
  if (!value || value.length > 120) return 'Creator';
  return value;
}

function referralUrl(appOrigin: string, code: string): string {
  return new URL(`/r/${encodeURIComponent(code)}`, `${appOrigin}/`).toString();
}

function message(candidate: CreatorOutreachCandidate, appOrigin: string) {
  const link = referralUrl(appOrigin, candidate.normalizedCode);
  return {
    subject: 'ISSUED ONCE is live — your referral link',
    text: `ISSUED ONCE\n\nHi ${creatorName(candidate.displayName)},\n\nWe are live. Your referral link is ready:\n${link}\n\nYour code: ${candidate.normalizedCode}\n\nShare the link or code with your audience. Customer discounts and your creator reward follow the referral terms already configured for your account.\n\nIf you no longer want to participate, reply to this email and we will deactivate your referral code.`,
  };
}

export class ReferralLaunchOutreachService {
  private readonly decrypt: (payload: EncryptedPayload) => Promise<{ email: string }>;
  private readonly now: () => Date;
  private readonly createDeliveryId: () => string;
  private readonly appOrigin: string;

  constructor(private readonly dependencies: Dependencies) {
    this.decrypt = dependencies.decrypt ?? decryptPrivatePayload;
    this.now = dependencies.now ?? (() => new Date());
    this.createDeliveryId = dependencies.createDeliveryId ?? (() => randomUUID());
    this.appOrigin = origin(dependencies.appOrigin);
  }

  async sendBatch(input: { campaign: string; limit: number }): Promise<{
    considered: number;
    sent: number;
    skipped: number;
    failed: number;
  }> {
    const campaign = campaignSlug(input.campaign);
    const limit = batchLimit(input.limit);
    const candidates = await this.dependencies.repository.listActiveCreatorsForOutreach(campaign, limit);
    const result = { considered: candidates.length, sent: 0, skipped: 0, failed: 0 };

    for (const candidate of candidates) {
      const reserved = await this.dependencies.repository.reserveOutreach({
        id: this.createDeliveryId(),
        creatorId: candidate.creatorId,
        campaign,
        now: this.now(),
      });
      if (!reserved) {
        result.skipped += 1;
        continue;
      }

      try {
        const privateContact = await this.decrypt(candidate.encryptedEmail);
        const email = creatorEmail(privateContact.email);
        const emailContent = message(candidate, this.appOrigin);
        const delivered = await this.dependencies.gateway.send({
          to: email,
          subject: emailContent.subject,
          text: emailContent.text,
          idempotencyKey: `issued-once/referral-outreach/${campaign}/${candidate.creatorId}`,
        });
        await this.dependencies.repository.markOutreachSent(
          candidate.creatorId,
          campaign,
          delivered.providerMessageId,
          this.now(),
        );
        result.sent += 1;
      } catch (error) {
        await this.dependencies.repository.markOutreachFailed(
          candidate.creatorId,
          campaign,
          error instanceof Error ? error.name : 'REFERRAL_OUTREACH_FAILURE',
          this.now(),
        );
        result.failed += 1;
      }
    }

    return result;
  }
}
