import { expect, test } from 'vitest';
import {
  DEFAULT_DESIGN_POLICY,
  mergeDesignPolicy,
  parseDesignPolicy,
  type DesignPolicyOverride,
} from '@/server/design/DesignPolicy';

test('safe defaults keep quality control and manufacturing handoff owner-controlled', () => {
  expect(DEFAULT_DESIGN_POLICY).toEqual({
    mode: 'HYBRID',
    approvalRequired: true,
    rejectBehavior: 'WAIT_FOR_OWNER',
    manualUploadApproval: 'REQUIRE_APPROVAL',
    answerRevealDefault: 'HIDDEN_UNTIL_REVEALED',
    manufacturingHandoff: 'WAIT_FOR_OWNER',
    factoryConfirmation: 'WAIT_FOR_OWNER',
  });
});

test('parses a complete configurable policy without hardcoded economics or provider secrets', () => {
  expect(parseDesignPolicy({
    mode: 'AUTO',
    approvalRequired: false,
    rejectBehavior: 'AUTO_REGENERATE',
    manualUploadApproval: 'AUTO_APPROVE',
    answerRevealDefault: 'VISIBLE',
    manufacturingHandoff: 'AUTO_CREATE_DRAFT_AFTER_APPROVAL',
    factoryConfirmation: 'ALLOW_AUTOMATION_WHEN_ARMED',
  })).toEqual({
    mode: 'AUTO',
    approvalRequired: false,
    rejectBehavior: 'AUTO_REGENERATE',
    manualUploadApproval: 'AUTO_APPROVE',
    answerRevealDefault: 'VISIBLE',
    manufacturingHandoff: 'AUTO_CREATE_DRAFT_AFTER_APPROVAL',
    factoryConfirmation: 'ALLOW_AUTOMATION_WHEN_ARMED',
  });
});

test('per-Issue override wins while unspecified fields inherit global policy', () => {
  const override: DesignPolicyOverride = { mode: 'MANUAL', approvalRequired: true };
  expect(mergeDesignPolicy({ ...DEFAULT_DESIGN_POLICY, rejectBehavior: 'AUTO_REGENERATE' }, override)).toEqual({
    ...DEFAULT_DESIGN_POLICY,
    mode: 'MANUAL',
    approvalRequired: true,
    rejectBehavior: 'AUTO_REGENERATE',
  });
});

test('invalid policy values fail closed', () => {
  expect(() => parseDesignPolicy({ ...DEFAULT_DESIGN_POLICY, mode: 'MAGIC' })).toThrow(/design policy/i);
  expect(() => parseDesignPolicy({ ...DEFAULT_DESIGN_POLICY, approvalRequired: 'yes' })).toThrow(/design policy/i);
});
