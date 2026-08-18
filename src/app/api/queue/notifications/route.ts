import { handleCallback } from '@vercel/queue';
import { z } from 'zod';
import { createCustomerNotificationService } from '@/server/notifications/runtimeNotifications';

const schema = z.object({
  issueId: z.string().uuid(),
  eventKey: z.enum(['PAYMENT_RECEIVED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED']),
});

export const POST = handleCallback(
  async (message) => {
    const parsed = schema.parse(message);
    await createCustomerNotificationService().send(parsed.issueId, parsed.eventKey);
  },
  { visibilityTimeoutSeconds: 120 },
);
