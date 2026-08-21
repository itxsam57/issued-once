import { handleCallback } from '@vercel/queue';
import { z } from 'zod';
import { createDesignService } from '@/server/design/runtimeDesign';
import { createDesignPolicyWorkflowService, createOpsDesignerStore } from '@/server/ops/runtimeOwnerOs';

const messageSchema = z.object({
  issueId: z.string().uuid(),
  mode: z.enum(['reinterpret', 'regenerate']).default('reinterpret'),
  generationKey: z.string().min(1).max(120).default('initial'),
  source: z.enum(['AUTOMATIC', 'OWNER_REGENERATE', 'OWNER_REINTERPRET']).default('AUTOMATIC'),
});

export const POST = handleCallback(
  async (message) => {
    const parsed = messageSchema.parse(message);
    const service = createDesignService();
    const job = parsed.mode === 'regenerate'
      ? await service.regenerateArtwork(parsed.issueId)
      : await service.createForIssue(parsed.issueId);
    if (job.state === 'REVIEW') {
      await createOpsDesignerStore().captureCurrentCandidate(parsed.issueId, parsed.generationKey, parsed.source);
      await createDesignPolicyWorkflowService().afterGeneratedReview(parsed.issueId);
    }
  },
  { visibilityTimeoutSeconds: 600 },
);
