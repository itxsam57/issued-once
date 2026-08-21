export type DesignMode = 'AUTO' | 'MANUAL' | 'HYBRID';
export type DesignRejectBehavior = 'AUTO_REGENERATE' | 'WAIT_FOR_OWNER';
export type ManualUploadApproval = 'REQUIRE_APPROVAL' | 'AUTO_APPROVE';
export type AnswerRevealDefault = 'HIDDEN_UNTIL_REVEALED' | 'VISIBLE';
export type ManufacturingHandoff = 'WAIT_FOR_OWNER' | 'AUTO_CREATE_DRAFT_AFTER_APPROVAL';
export type FactoryConfirmationPolicy = 'WAIT_FOR_OWNER' | 'ALLOW_AUTOMATION_WHEN_ARMED';

export type DesignPolicy = {
  mode: DesignMode;
  approvalRequired: boolean;
  rejectBehavior: DesignRejectBehavior;
  manualUploadApproval: ManualUploadApproval;
  answerRevealDefault: AnswerRevealDefault;
  manufacturingHandoff: ManufacturingHandoff;
  factoryConfirmation: FactoryConfirmationPolicy;
};

export type DesignPolicyOverride = Partial<DesignPolicy>;

export const DEFAULT_DESIGN_POLICY: DesignPolicy = Object.freeze({
  mode: 'HYBRID',
  approvalRequired: true,
  rejectBehavior: 'WAIT_FOR_OWNER',
  manualUploadApproval: 'REQUIRE_APPROVAL',
  answerRevealDefault: 'HIDDEN_UNTIL_REVEALED',
  manufacturingHandoff: 'WAIT_FOR_OWNER',
  factoryConfirmation: 'WAIT_FOR_OWNER',
});

const VALUES = {
  mode: new Set<DesignMode>(['AUTO', 'MANUAL', 'HYBRID']),
  rejectBehavior: new Set<DesignRejectBehavior>(['AUTO_REGENERATE', 'WAIT_FOR_OWNER']),
  manualUploadApproval: new Set<ManualUploadApproval>(['REQUIRE_APPROVAL', 'AUTO_APPROVE']),
  answerRevealDefault: new Set<AnswerRevealDefault>(['HIDDEN_UNTIL_REVEALED', 'VISIBLE']),
  manufacturingHandoff: new Set<ManufacturingHandoff>(['WAIT_FOR_OWNER', 'AUTO_CREATE_DRAFT_AFTER_APPROVAL']),
  factoryConfirmation: new Set<FactoryConfirmationPolicy>(['WAIT_FOR_OWNER', 'ALLOW_AUTOMATION_WHEN_ARMED']),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseDesignPolicy(value: unknown): DesignPolicy {
  if (!isRecord(value)) throw new Error('Design policy is invalid');
  if (
    !VALUES.mode.has(value.mode as DesignMode) ||
    typeof value.approvalRequired !== 'boolean' ||
    !VALUES.rejectBehavior.has(value.rejectBehavior as DesignRejectBehavior) ||
    !VALUES.manualUploadApproval.has(value.manualUploadApproval as ManualUploadApproval) ||
    !VALUES.answerRevealDefault.has(value.answerRevealDefault as AnswerRevealDefault) ||
    !VALUES.manufacturingHandoff.has(value.manufacturingHandoff as ManufacturingHandoff) ||
    !VALUES.factoryConfirmation.has(value.factoryConfirmation as FactoryConfirmationPolicy)
  ) {
    throw new Error('Design policy is invalid');
  }
  return {
    mode: value.mode as DesignMode,
    approvalRequired: value.approvalRequired,
    rejectBehavior: value.rejectBehavior as DesignRejectBehavior,
    manualUploadApproval: value.manualUploadApproval as ManualUploadApproval,
    answerRevealDefault: value.answerRevealDefault as AnswerRevealDefault,
    manufacturingHandoff: value.manufacturingHandoff as ManufacturingHandoff,
    factoryConfirmation: value.factoryConfirmation as FactoryConfirmationPolicy,
  };
}

export function mergeDesignPolicy(globalPolicy: DesignPolicy, override: DesignPolicyOverride | null | undefined): DesignPolicy {
  return parseDesignPolicy({ ...globalPolicy, ...(override ?? {}) });
}
