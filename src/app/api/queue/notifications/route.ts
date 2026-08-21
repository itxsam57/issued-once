import { handleCallback } from '@vercel/queue';
import { z } from 'zod';
import { createCustomerNotificationService } from '@/server/notifications/runtimeNotifications';
import { createReferralNotificationService } from '@/server/referrals/runtimeReferrals';

const issueSchema = z.object({
  issueId: z.string().uuid(),
  eventKey: z.enum(['PAYMENT_RECEIVED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED']),
});

const referralSchema = z.object({
  referralConversionId: z.string().uuid(),
  referralEventKey: z.enum(['SALE', 'REVERSAL']),
});

const schema = z.union([issueSchema, referralSchema]);

export const POST = handleCallback(
  async (message) => {
    const parsed = schema.parse(message);
    if ('referralConversionId' in parsed) {
      await createReferralNotificationService().send(
        parsed.referralConversionId,
        parsed.referralEventKey,
      );
      return;
    }
    await createCustomerNotificationService().send(parsed.issueId, parsed.eventKey);
  },
  { visibilityTimeoutSeconds: 120 },
);
