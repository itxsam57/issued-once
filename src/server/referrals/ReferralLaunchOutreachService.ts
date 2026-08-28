import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { CustomerEmailGateway } from '@/server/notifications/CustomerEmailGateway';

type CreatorOutreachCandidate = {
  creatorId: string;
  displayName: string;
  normalizedCode: string;
  encryptedEmail: EncryptedPayload;
};

type OutreachRepository = {
  listActiveCreatorsForOutreach(campaign: string, limit: number): Promise<CreatorOutreachCandidate[]>;
  reserveOutreach(input: { id: string; creatorId: string; campaign: string; now: Date }): Promise<boolean>;
  markOutreachSent(creatorId: string, campaign: string, providerMessageId: string, at: Date): Promise<void>;
  markOutreachFailed(creatorId: string, campaign: string, errorCode: string, at: Date): Promise<void>;
};

type Dependencies = {
  repository: OutreachRepository;
  gateway: CustomerEmailGateway;
  appOrigin: string;
  decrypt: (payload: EncryptedPayload) => Promise<{ email: string }>;
  now?: () => Date;
  createDeliveryId?: () => string;
};

export class ReferralLaunchOutreachService {
  constructor(private readonly dependencies: Dependencies) {}

  async sendBatch(_input: { campaign: string; limit: number }): Promise<{
    considered: number;
    sent: number;
    skipped: number;
    failed: number;
  }> {
    void this.dependencies;
    throw new Error('Referral launch outreach is not implemented');
  }
}
