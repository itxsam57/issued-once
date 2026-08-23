import { beforeEach, describe, expect, it } from 'vitest';
import { PreviewRepeatOrderRepository } from '@/server/preview/PreviewRepeatOrderRepository';
import { getPreviewStore } from '@/server/preview/PreviewExperienceRepository';
import type { AssignedQuestionRecord } from '@/server/questions/QuestionSetRepository';

const sourceId = 'source-exp';
const sourceHash = 'a'.repeat(64);
const childHash = 'b'.repeat(64);

const assignment: AssignedQuestionRecord[] = [
  ['q1', 'culture'], ['q2', 'place'], ['q3', 'rhythm'], ['q4', 'identity'],
  ['q5', 'music'], ['q6', 'boundary'], ['q7', 'wildcard'],
].map(([slot, family], index) => ({
  slot: slot as AssignedQuestionRecord['slot'],
  ordinal: index + 1,
  questionId: `question-${slot}`,
  questionVersion: 1,
  family: family as AssignedQuestionRecord['family'],
  prompt: `Prompt ${slot}`,
  kind: 'text' as const,
  optional: slot === 'q7',
}));

function seedSource() {
  const store = getPreviewStore();
  store.experiences.set(sourceHash, {
    id: sourceId,
    publicSessionHash: sourceHash,
    stage: 'CHECKOUT_STARTED',
    hookId: 'public-entry',
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
    updatedAt: new Date('2026-08-23T00:10:00.000Z'),
    expiresAt: new Date('2026-09-22T00:00:00.000Z'),
  });
  store.questionAssignments.set(sourceId, assignment);
  for (const question of assignment) {
    store.answers.set(`${sourceId}:${question.slot}`, {
      experienceId: sourceId,
      questionId: question.slot,
      encryptedPayload: {
        version: 1,
        keyVersion: 'v1',
        iv: `iv-${question.slot}`,
        ciphertext: `cipher-${question.slot}`,
        tag: `tag-${question.slot}`,
      },
      answeredAt: new Date('2026-08-23T00:05:00.000Z'),
    });
  }
}

function clearStore() {
  const store = getPreviewStore();
  store.experiences.clear();
  store.answers.clear();
  store.physicalSelections.clear();
  store.checkoutQuotes.clear();
  store.questionAssignments.clear();
}

const input = {
  sourceExperienceId: sourceId,
  childExperienceId: 'child-exp',
  childSessionHash: childHash,
  requestedMode: 'reuse' as const,
  createdAt: new Date('2026-08-23T01:00:00.000Z'),
  expiresAt: new Date('2026-09-22T01:00:00.000Z'),
};

describe('PreviewRepeatOrderRepository', () => {
  beforeEach(() => {
    clearStore();
    seedSource();
  });

  it('copies the exact encrypted profile and question assignment for reuse', async () => {
    const repository = new PreviewRepeatOrderRepository();
    const result = await repository.resolve(input);
    const store = getPreviewStore();

    expect(result).toEqual({
      experienceId: 'child-exp', mode: 'reuse', stage: 'PROFILE_COMPLETE', created: true,
    });
    expect(store.questionAssignments.get('child-exp')).toEqual(assignment);
    const copied = [...store.answers.values()].filter((answer) => answer.experienceId === 'child-exp');
    expect(copied).toHaveLength(7);
    expect(copied[0].encryptedPayload.ciphertext).toBe('cipher-q1');
  });

  it('creates a fresh child without copying old answers or assignment', async () => {
    const repository = new PreviewRepeatOrderRepository();
    const result = await repository.resolve({ ...input, requestedMode: 'fresh' });
    const store = getPreviewStore();

    expect(result).toEqual({
      experienceId: 'child-exp', mode: 'fresh', stage: 'QUESTION_1', created: true,
    });
    expect(store.questionAssignments.has('child-exp')).toBe(false);
    expect([...store.answers.values()].some((answer) => answer.experienceId === 'child-exp')).toBe(false);
  });

  it('returns the first persisted mode when a second opposite choice targets the same child hash', async () => {
    const repository = new PreviewRepeatOrderRepository();
    await repository.resolve(input);
    const second = await repository.resolve({
      ...input,
      childExperienceId: 'different-proposal',
      requestedMode: 'fresh',
    });

    expect(second).toEqual({
      experienceId: 'child-exp', mode: 'reuse', stage: 'PROFILE_COMPLETE', created: false,
    });
  });
});
