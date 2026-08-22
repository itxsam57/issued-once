import type { DesignPolicy } from './DesignPolicy';

type EffectivePolicyReader = {
  getEffective(issueId: string): Promise<{
    globalVersion: number;
    override: Partial<DesignPolicy> | null;
    policy: DesignPolicy;
  }>;
};

type WorkflowActions = {
  approve(issueId: string): Promise<unknown>;
  createDraft(issueId: string): Promise<unknown>;
};

export type DesignPolicyWorkflowResult = {
  approved: boolean;
  draftCreated: boolean;
  policyVersion: number;
};

export class DesignPolicyWorkflowService {
  constructor(
    private readonly policies: EffectivePolicyReader,
    private readonly actions: WorkflowActions,
  ) {}

  async afterGeneratedReview(issueId: string): Promise<DesignPolicyWorkflowResult> {
    const effective = await this.policies.getEffective(issueId);
    if (effective.policy.approvalRequired) {
      return { approved: false, draftCreated: false, policyVersion: effective.globalVersion };
    }
    return this.approveWithHandoff(issueId, effective.policy, effective.globalVersion);
  }

  async afterOwnerApproval(issueId: string): Promise<DesignPolicyWorkflowResult> {
    const effective = await this.policies.getEffective(issueId);
    return this.approveWithHandoff(issueId, effective.policy, effective.globalVersion);
  }

  private async approveWithHandoff(
    issueId: string,
    policy: DesignPolicy,
    policyVersion: number,
  ): Promise<DesignPolicyWorkflowResult> {
    await this.actions.approve(issueId);
    const draftCreated = policy.manufacturingHandoff === 'AUTO_CREATE_DRAFT_AFTER_APPROVAL';
    if (draftCreated) await this.actions.createDraft(issueId);
    return { approved: true, draftCreated, policyVersion };
  }
}
