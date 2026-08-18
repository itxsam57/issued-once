import { handleCallback } from '@vercel/queue';
import { z } from 'zod';
import { createDesignService } from '@/server/design/runtimeDesign';

const messageSchema = z.object({
  issueId: z.string().uuid(),
});

export const POST = handleCallback(
  async (message) => {
    const parsed = messageSchema.parse(message);
    await createDesignService().createForIssue(parsed.issueId);
  },
  { visibilityTimeoutSeconds: 600 },
);
