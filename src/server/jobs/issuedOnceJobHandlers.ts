import { z } from 'zod';
import { createDesignService } from '@/server/design/runtimeDesign';
import { createCustomerNotificationService } from '@/server/notifications/runtimeNotifications';
import { createDesignPolicyWorkflowService, createOpsDesignerStore } from '@/server/ops/runtimeOwnerOs';
import { createReferralNotificationService, referralsAreEnabled } from '@/server/referrals/runtimeReferrals';
import type { JobHandler } from './JobProcessor';
import { PermanentJobError } from './JobProcessor';

const designSchema = z.object({
  issueId: z.string().uuid(),
  mode: z.enum(['reinterpret', 'regenerate']).default('reinterpret'),
  generationKey: z.string().min(1).max(120).default('initial'),
  source: z.enum(['AUTOMATIC', 'OWNER_REGENERATE', 'OWNER_REINTERPRET']).default('AUTOMATIC'),
  feedback: z.string().trim().min(1).max(500).optional(),
});

const issueNotificationSchema = z.object({
  issueId: z.string().uuid(),
  eventKey: z.enum(['PAYMENT_RECEIVED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED']),
});

const referralNotificationSchema = z.object({
  referralConversionId: z.string().uuid(),
  referralEventKey: z.enum(['SALE', 'REVERSAL']),
});

function parseOrPermanent<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new PermanentJobError('Invalid background job payload');
  return parsed.data;
}

export const handleDesignJob: JobHandler = async (payload) => {
  const parsed = parseOrPermanent(designSchema, payload);
  const service = createDesignService();
  const job = parsed.mode === 'regenerate'
    ? await service.regenerateArtwork(parsed.issueId, parsed.feedback)
    : await service.createForIssue(parsed.issueId, parsed.feedback);
  if (job.state === 'REVIEW') {
    await createOpsDesignerStore().captureCurrentCandidate(parsed.issueId, parsed.generationKey, parsed.source);
    await createDesignPolicyWorkflowService().afterGeneratedReview(parsed.issueId);
  }
};

export const handleNotificationJob: JobHandler = async (payload) => {
  const issue = issueNotificationSchema.safeParse(payload);
  if (issue.success) {
    await createCustomerNotificationService().send(issue.data.issueId, issue.data.eventKey);
    return;
  }

  const referral = referralNotificationSchema.safeParse(payload);
  if (referral.success) {
    if (!referralsAreEnabled()) throw new PermanentJobError('Referral notifications are not enabled');
    await createReferralNotificationService().send(
      referral.data.referralConversionId,
      referral.data.referralEventKey,
    );
    return;
  }

  throw new PermanentJobError('Invalid background job payload');
};

export function createIssuedOnceJobHandlers(): ReadonlyMap<string, JobHandler> {
  return new Map<string, JobHandler>([
    ['issued-once-design', handleDesignJob],
    ['issued-once-notifications', handleNotificationJob],
  ]);
}
