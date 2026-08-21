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

const POLICY_KEYS = new Set<keyof DesignPolicy>([
  'mode',
  'approvalRequired',
  'rejectBehavior',
  'manualUploadApproval',
  'answerRevealDefault',
  'manufacturingHandoff',
  'factoryConfirmation',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validField(key: keyof DesignPolicy, value: unknown): boolean {
  switch (key) {
    case 'mode': return VALUES.mode.has(value as DesignMode);
    case 'approvalRequired': return typeof value === 'boolean';
    case 'rejectBehavior': return VALUES.rejectBehavior.has(value as DesignRejectBehavior);
    case 'manualUploadApproval': return VALUES.manualUploadApproval.has(value as ManualUploadApproval);
    case 'answerRevealDefault': return VALUES.answerRevealDefault.has(value as AnswerRevealDefault);
    case 'manufacturingHandoff': return VALUES.manufacturingHandoff.has(value as ManufacturingHandoff);
    case 'factoryConfirmation': return VALUES.factoryConfirmation.has(value as FactoryConfirmationPolicy);
  }
}

export function parseDesignPolicy(value: unknown): DesignPolicy {
  if (!isRecord(value)) throw new Error('Design policy is invalid');
  if (
    !validField('mode', value.mode) ||
    !validField('approvalRequired', value.approvalRequired) ||
    !validField('rejectBehavior', value.rejectBehavior) ||
    !validField('manualUploadApproval', value.manualUploadApproval) ||
    !validField('answerRevealDefault', value.answerRevealDefault) ||
    !validField('manufacturingHandoff', value.manufacturingHandoff) ||
    !validField('factoryConfirmation', value.factoryConfirmation)
  ) {
    throw new Error('Design policy is invalid');
  }
  return {
    mode: value.mode as DesignMode,
    approvalRequired: value.approvalRequired as boolean,
    rejectBehavior: value.rejectBehavior as DesignRejectBehavior,
    manualUploadApproval: value.manualUploadApproval as ManualUploadApproval,
    answerRevealDefault: value.answerRevealDefault as AnswerRevealDefault,
    manufacturingHandoff: value.manufacturingHandoff as ManufacturingHandoff,
    factoryConfirmation: value.factoryConfirmation as FactoryConfirmationPolicy,
  };
}

export function parseDesignPolicyOverride(value: unknown): DesignPolicyOverride {
  if (!isRecord(value)) throw new Error('Design policy override is invalid');
  const override: DesignPolicyOverride = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (!POLICY_KEYS.has(rawKey as keyof DesignPolicy)) throw new Error('Design policy override is invalid');
    const key = rawKey as keyof DesignPolicy;
    if (!validField(key, rawValue)) throw new Error('Design policy override is invalid');
    Object.assign(override, { [key]: rawValue });
  }
  return override;
}

export function mergeDesignPolicy(globalPolicy: DesignPolicy, override: DesignPolicyOverride | null | undefined): DesignPolicy {
  return parseDesignPolicy({ ...globalPolicy, ...(override ?? {}) });
}
