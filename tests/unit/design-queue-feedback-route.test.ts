import { expect, test, vi } from 'vitest';

const {
  createForIssue,
  regenerateArtwork,
  captureCurrentCandidate,
  afterGeneratedReview,
} = vi.hoisted(() => ({
  createForIssue: vi.fn(),
  regenerateArtwork: vi.fn(),
  captureCurrentCandidate: vi.fn(),
  afterGeneratedReview: vi.fn(),
}));

vi.mock('@/server/design/runtimeDesign', () => ({
  createDesignService: () => ({ createForIssue, regenerateArtwork }),
}));

vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsDesignerStore: () => ({ captureCurrentCandidate }),
  createDesignPolicyWorkflowService: () => ({ afterGeneratedReview }),
}));

import { handleDesignJob } from '@/server/jobs/issuedOnceJobHandlers';

const issueId = '11111111-1111-4111-8111-111111111111';

test('design job handler delivers owner feedback to regeneration and preserves candidate workflow', async () => {
  regenerateArtwork.mockResolvedValueOnce({ state: 'REVIEW' });
  captureCurrentCandidate.mockResolvedValueOnce(undefined);
  afterGeneratedReview.mockResolvedValueOnce(undefined);

  await handleDesignJob({
    issueId,
    mode: 'regenerate',
    generationKey: 'gen-2',
    source: 'OWNER_REGENERATE',
    feedback: 'TOO BUSY — simplify the center',
  });

  expect(regenerateArtwork).toHaveBeenCalledWith(issueId, 'TOO BUSY — simplify the center');
  expect(createForIssue).not.toHaveBeenCalled();
  expect(captureCurrentCandidate).toHaveBeenCalledWith(issueId, 'gen-2', 'OWNER_REGENERATE');
  expect(afterGeneratedReview).toHaveBeenCalledWith(issueId);
});
