import type { DesignPolicy, DesignPolicyOverride } from '@/server/design/DesignPolicy';
import { parseDesignPolicy, parseDesignPolicyOverride } from '@/server/design/DesignPolicy';
import type { OpsAuditService } from './OpsAuditService';

export interface OpsDesignPolicyStore {
  getGlobal(): Promise<{ source: 'DEFAULT' | 'ACTIVE'; version: number; policy: DesignPolicy }>;
  getEffective(issueId: string): Promise<{ globalVersion: number; override: DesignPolicyOverride | null; policy: DesignPolicy }>;
  publishGlobal(input: DesignPolicy): Promise<number>;
  setIssueOverride(issueId: string, input: DesignPolicyOverride | null): Promise<void>;
}

function safePolicyMetadata(policy: DesignPolicy) {
  return {
    mode: policy.mode,
    approvalRequired: policy.approvalRequired,
    rejectBehavior: policy.rejectBehavior,
    manualUploadApproval: policy.manualUploadApproval,
    manufacturingHandoff: policy.manufacturingHandoff,
    factoryConfirmation: policy.factoryConfirmation,
  };
}

export class OpsDesignPolicyService {
  constructor(
    private readonly store: OpsDesignPolicyStore,
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  getGlobal() {
    return this.store.getGlobal();
  }

  getEffective(issueId: string) {
    return this.store.getEffective(issueId);
  }

  async publishGlobal(input: DesignPolicy) {
    const policy = parseDesignPolicy(input);
    const version = await this.store.publishGlobal(policy);
    await this.audit.record({
      actor: 'OWNER',
      action: 'DESIGN_POLICY_GLOBAL_PUBLISHED',
      issueId: null,
      targetType: 'design_policy_version',
      targetId: String(version),
      reason: null,
      safeMetadata: { version, ...safePolicyMetadata(policy) },
    });
    return { version, policy };
  }

  async setIssueOverride(issueId: string, input: DesignPolicyOverride | null) {
    const override = input === null ? null : parseDesignPolicyOverride(input);
    await this.store.setIssueOverride(issueId, override);
    const effective = await this.store.getEffective(issueId);
    await this.audit.record({
      actor: 'OWNER',
      action: override === null ? 'DESIGN_POLICY_OVERRIDE_CLEARED' : 'DESIGN_POLICY_OVERRIDE_SET',
      issueId,
      targetType: 'issue_design_policy',
      targetId: issueId,
      reason: null,
      safeMetadata: {
        globalVersion: effective.globalVersion,
        overrideActive: override !== null,
        mode: effective.policy.mode,
        approvalRequired: effective.policy.approvalRequired,
        rejectBehavior: effective.policy.rejectBehavior,
        manualUploadApproval: effective.policy.manualUploadApproval,
        manufacturingHandoff: effective.policy.manufacturingHandoff,
        factoryConfirmation: effective.policy.factoryConfirmation,
      },
    });
    return effective;
  }
}
