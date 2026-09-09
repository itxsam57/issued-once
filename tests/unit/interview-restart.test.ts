import { expect, test } from 'vitest';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
  SessionHashCompareAndSwap,
} from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import { InterviewBootstrapService } from '@/server/questions/InterviewBootstrapService';
import type { AssignedQuestionRecord } from '@/server/questions/QuestionSetRepository';

class MemoryExperiences implements ExperienceRepository {
  records: ExperienceRecord[];
  constructor(record: ExperienceRecord) { this.records = [structuredClone(record)]; }
  async create(record: ExperienceRecord) { this.records.push(structuredClone(record)); }
  async findBySessionHash(hash: string) {
    return structuredClone(this.records.find((record) => record.publicSessionHash === hash) ?? null);
  }
  async rotateSessionHashIfCurrent(input: SessionHashCompareAndSwap) {
    const record = this.records.find((item) => item.id === input.experienceId);
    if (!record || record.publicSessionHash !== input.expectedPublicSessionHash) return false;
    record.publicSessionHash = input.publicSessionHash;
    record.updatedAt = input.updatedAt;
    return true;
  }
  async saveAnswerAndAdvance(_transition: AnswerTransition) { throw new Error('not used'); }
}

const questions: AssignedQuestionRecord[] = [
  ['q1', 'culture'], ['q2', 'place'], ['q3', 'rhythm'], ['q4', 'identity'],
  ['q5', 'music'], ['q6', 'boundary'], ['q7', 'wildcard'],
].map(([slot, family], index) => ({
  slot: slot as AssignedQuestionRecord['slot'], ordinal: index + 1,
  questionId: `question-${slot}`, questionVersion: 1,
  family: family as AssignedQuestionRecord['family'], prompt: `Prompt ${slot}`,
  kind: 'text' as const, optional: slot === 'q7',
}));

function unfinished(token: string): ExperienceRecord {
  return {
    id: 'unfinished-exp', publicSessionHash: hashSessionToken(token), stage: 'QUESTION_4',
    hookId: 'public-entry', createdAt: new Date('2026-09-09T00:00:00Z'),
    updatedAt: new Date('2026-09-09T00:05:00Z'), expiresAt: new Date('2026-10-09T00:00:00Z'),
  };
}

test('START AGAIN retires the old browser token and returns a fresh Question 1 session', async () => {
  const oldToken = 'unfinished-browser-token';
  const repo = new MemoryExperiences(unfinished(oldToken));
  const service = new InterviewBootstrapService(repo, { assign: async () => questions });

  const fresh = await service.restart(oldToken);

  expect(fresh.stage).toBe('QUESTION_1');
  expect(fresh.initialPosition).toBe(1);
  expect(fresh.resumePrompt).toBe(false);
  expect(fresh.token).not.toBe(oldToken);
  expect(await repo.findBySessionHash(hashSessionToken(oldToken))).toBeNull();
  expect(repo.records.find((record) => record.id === 'unfinished-exp')).toBeDefined();
});

test('fresh-session preparation failure leaves the unfinished browser token usable', async () => {
  const oldToken = 'preserve-on-failure-token';
  const repo = new MemoryExperiences(unfinished(oldToken));
  const service = new InterviewBootstrapService(repo, {
    assign: async () => { throw new Error('question storage unavailable'); },
  });

  await expect(service.restart(oldToken)).rejects.toThrow(/question storage unavailable/i);
  expect(await repo.findBySessionHash(hashSessionToken(oldToken))).not.toBeNull();
});

test('START AGAIN refuses to retire a checkout-started purchase session', async () => {
  const token = 'checkout-token';
  const repo = new MemoryExperiences({
    id: 'paid-boundary-exp', publicSessionHash: hashSessionToken(token), stage: 'CHECKOUT_STARTED',
    hookId: 'public-entry', createdAt: new Date('2026-09-09T00:00:00Z'),
    updatedAt: new Date('2026-09-09T00:05:00Z'), expiresAt: new Date('2026-10-09T00:00:00Z'),
  });
  const service = new InterviewBootstrapService(repo, { assign: async () => questions });

  await expect(service.restart(token)).rejects.toThrow(/cannot|restart|checkout/i);
  expect(await repo.findBySessionHash(hashSessionToken(token))).not.toBeNull();
});
