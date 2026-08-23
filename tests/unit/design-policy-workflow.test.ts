// @vitest-environment node

import { expect, test, vi } from 'vitest';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { DesignPolicyWorkflowService } from '@/server/design/DesignPolicyWorkflowService';

const issueId = '11111111-1111-4111-8111-111111111111';

function setup(overrides: Partial<typeof DEFAULT_DESIGN_POLICY> = {}) {
  const approve = vi.fn().mockResolvedValue({ state: 'APPROVED' });
  const createDraft = vi.fn().mockResolvedValue({ state: 'DRAFT' });
  const policies = {
    getEffective: vi.fn().mockResolvedValue({
      globalVersion: 4,
      override: null,
      policy: { ...DEFAULT_DESIGN_POLICY, ...overrides },
    }),
  };
  return {
    workflow: new DesignPolicyWorkflowService(policies, { approve, createDraft }),
    approve,
    createDraft,
  };
}

test('generated REVIEW waits when owner approval is required', async () => {
  const { workflow, approve, createDraft } = setup({ approvalRequired: true });

  await expect(workflow.afterGeneratedReview(issueId)).resolves.toEqual({
    approved: false,
    draftCreated: false,
    policyVersion: 4,
  });
  expect(approve).not.toHaveBeenCalled();
  expect(createDraft).not.toHaveBeenCalled();
});

test('generated REVIEW can auto-approve and create only a Printful draft', async () => {
  const { workflow, approve, createDraft } = setup({
    approvalRequired: false,
    manufacturingHandoff: 'AUTO_CREATE_DRAFT_AFTER_APPROVAL',
  });

  await expect(workflow.afterGeneratedReview(issueId)).resolves.toEqual({
    approved: true,
    draftCreated: true,
    policyVersion: 4,
  });
  expect(approve).toHaveBeenCalledWith(issueId);
  expect(createDraft).toHaveBeenCalledWith(issueId);
});

test('owner approval respects WAIT_FOR_OWNER manufacturing handoff', async () => {
  const { workflow, approve, createDraft } = setup({ manufacturingHandoff: 'WAIT_FOR_OWNER' });

  await expect(workflow.afterOwnerApproval(issueId)).resolves.toEqual({
    approved: true,
    draftCreated: false,
    policyVersion: 4,
  });
  expect(approve).toHaveBeenCalledWith(issueId);
  expect(createDraft).not.toHaveBeenCalled();
});

test('owner approval may auto-create a draft but never confirms production', async () => {
  const { workflow, approve, createDraft } = setup({ manufacturingHandoff: 'AUTO_CREATE_DRAFT_AFTER_APPROVAL' });

  await expect(workflow.afterOwnerApproval(issueId)).resolves.toEqual({
    approved: true,
    draftCreated: true,
    policyVersion: 4,
  });
  expect(approve).toHaveBeenCalledTimes(1);
  expect(createDraft).toHaveBeenCalledTimes(1);
});
