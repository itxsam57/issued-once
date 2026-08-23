import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_QUESTION_FAMILIES, type QuestionFamily } from '@/domain/questions/QuestionVault';
import type { VerifiedContactRecord } from '@/server/contact/ContactRepository';
import type { ExperienceRecord } from '@/server/experience/ExperienceRepository';
import type { RepeatOrderRepository } from '@/server/experience/RepeatOrderRepository';
import { RepeatOrderService } from '@/server/experience/RepeatOrderService';
import { deriveNextOrderSessionToken, hashSessionToken } from '@/server/http/sessionToken';
import type { AssignedQuestionRecord } from '@/server/questions/QuestionSetRepository';

const sourceToken = 'source-session-token';
const sourceExperience: ExperienceRecord = {
  id: 'source-exp',
  publicSessionHash: hashSessionToken(sourceToken),
  stage: 'CHECKOUT_STARTED',
  hookId: 'public-entry',
  createdAt: new Date('2026-08-23T02:00:00.000Z'),
  updatedAt: new Date('2026-08-23T02:10:00.000Z'),
  expiresAt: new Date('2026-09-22T02:00:00.000Z'),
};

const sourceContact: VerifiedContactRecord = {
  id: 'source-contact',
  experienceId: sourceExperience.id,
  emailHash: 'a'.repeat(64),
  encryptedEmail: { version: 1, keyVersion: 'v1', iv: 'iv', tag: 'tag', ciphertext: 'ciphertext' },
  verifiedAt: new Date('2026-08-23T02:05:00.000Z'),
};

function assignment(prefix: string): AssignedQuestionRecord[] {
  return REQUIRED_QUESTION_FAMILIES.map((family, index) => ({
    slot: `q${index + 1}` as AssignedQuestionRecord['slot'],
    ordinal: index + 1,
    questionId: `${prefix}.${family}`,
    questionVersion: 1,
    family,
    prompt: `${prefix} ${family}`,
    kind: 'text' as const,
    optional: family === 'wildcard',
  }));
}

function createHarness(input?: {
  source?: ExperienceRecord;
  resolvedMode?: 'reuse' | 'fresh';
  resolvedStage?: ExperienceRecord['stage'];
  contact?: VerifiedContactRecord | null;
}) {
  const previous = assignment('previous');
  const fresh = assignment('fresh');
  const resolvedMode = input?.resolvedMode ?? 'reuse';
  const resolvedStage = input?.resolvedStage ?? (resolvedMode === 'reuse' ? 'PROFILE_COMPLETE' : 'QUESTION_1');
  const experiences = { findBySessionHash: vi.fn().mockResolvedValue(input?.source ?? sourceExperience) };
  const repeats: RepeatOrderRepository = {
    resolve: vi.fn().mockResolvedValue({ experienceId: 'child-exp', mode: resolvedMode, stage: resolvedStage, created: true }),
  };
  const questions = {
    findByExperienceId: vi.fn().mockImplementation(async (experienceId: string) => {
      if (experienceId === sourceExperience.id) return previous;
      return resolvedMode === 'reuse' ? previous : fresh;
    }),
    assignExcluding: vi.fn().mockResolvedValue(fresh),
  };
  const contacts = {
    findVerifiedByExperienceId: vi.fn().mockResolvedValue(input && 'contact' in input ? input.contact : sourceContact),
  };

  return {
    previous, fresh, experiences, repeats, questions, contacts,
    service: new RepeatOrderService({
      experiences, repeats, questions, contacts,
      now: () => new Date('2026-08-23T03:00:00.000Z'),
    }),
  };
}

describe('RepeatOrderService', () => {
  it('creates a reuse child from CHECKOUT_STARTED without mutating the source experience', async () => {
    const harness = createHarness();
    const result = await harness.service.choose({ sessionToken: sourceToken, mode: 'reuse' });
    expect(result.mode).toBe('reuse');
    expect(result.stage).toBe('PROFILE_COMPLETE');
    expect(result.token).toBe(deriveNextOrderSessionToken(sourceToken));
    expect(sourceExperience.stage).toBe('CHECKOUT_STARTED');
    expect(harness.questions.assignExcluding).not.toHaveBeenCalled();
    expect(result.questions.map((question) => question.questionId)).toEqual(harness.previous.map((question) => question.questionId));
  });

  it('creates a fresh child at QUESTION_1 and excludes all seven immediately previous question ids', async () => {
    const harness = createHarness({ resolvedMode: 'fresh', resolvedStage: 'QUESTION_1' });
    const result = await harness.service.choose({ sessionToken: sourceToken, mode: 'fresh' });
    expect(result.mode).toBe('fresh');
    expect(result.stage).toBe('QUESTION_1');
    const expectedExclusions = Object.fromEntries(harness.previous.map((question) => [question.family, question.questionId])) as Record<QuestionFamily, string>;
    expect(harness.questions.assignExcluding).toHaveBeenCalledWith('child-exp', expectedExclusions);
    expect(result.questions.map((question) => question.questionId)).toEqual(harness.fresh.map((question) => question.questionId));
  });

  it.each([
    ['reuse', 'PROFILE_COMPLETE'],
    ['fresh', 'QUESTION_1'],
  ] as const)('returns source verified-contact continuity for a %s repeat child', async (mode, stage) => {
    const harness = createHarness({ resolvedMode: mode, resolvedStage: stage });
    const result = await harness.service.choose({ sessionToken: sourceToken, mode });
    expect(harness.contacts.findVerifiedByExperienceId).toHaveBeenCalledWith(sourceExperience.id);
    expect(result.contactContinuity).toEqual({ sourceContactId: sourceContact.id, emailHash: sourceContact.emailHash });
  });

  it('does not claim contact continuity when the source order has no verified contact', async () => {
    const harness = createHarness({ contact: null });
    const result = await harness.service.choose({ sessionToken: sourceToken, mode: 'reuse' });
    expect(result.contactContinuity).toBeUndefined();
  });

  it('returns the persisted winning reuse mode when an opposite fresh choice loses the child race', async () => {
    const harness = createHarness({ resolvedMode: 'reuse', resolvedStage: 'PROFILE_COMPLETE' });
    const result = await harness.service.choose({ sessionToken: sourceToken, mode: 'fresh' });
    expect(result.mode).toBe('reuse');
    expect(harness.questions.assignExcluding).not.toHaveBeenCalled();
  });

  it('returns the persisted winning fresh mode when an opposite reuse choice loses the child race', async () => {
    const harness = createHarness({ resolvedMode: 'fresh', resolvedStage: 'QUESTION_1' });
    const result = await harness.service.choose({ sessionToken: sourceToken, mode: 'reuse' });
    expect(result.mode).toBe('fresh');
    expect(harness.questions.assignExcluding).toHaveBeenCalledOnce();
  });

  it('rejects repeat-order choice unless the source experience is terminal checkout', async () => {
    const harness = createHarness({ source: { ...sourceExperience, stage: 'COMMITMENT_READY' } });
    await expect(harness.service.choose({ sessionToken: sourceToken, mode: 'reuse' })).rejects.toThrow('Repeat order is not unlocked');
    expect(harness.repeats.resolve).not.toHaveBeenCalled();
  });

  it('fails closed when the terminal source has no stored seven-question assignment', async () => {
    const harness = createHarness();
    harness.questions.findByExperienceId.mockResolvedValueOnce(null);
    await expect(harness.service.choose({ sessionToken: sourceToken, mode: 'fresh' })).rejects.toThrow('Source profile assignment is incomplete');
    expect(harness.repeats.resolve).not.toHaveBeenCalled();
  });
});
