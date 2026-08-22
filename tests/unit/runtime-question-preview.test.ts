import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getPreviewStore } from '@/server/preview/PreviewExperienceRepository';
import {
  getQuestionSelectionService,
  QuestionAssignmentUnavailableError,
} from '@/server/questions/runtimeQuestions';

beforeEach(() => {
  getPreviewStore().questionAssignments.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('visual preview assigns and reuses a deterministic seven-family Question Vault set without Neon', async () => {
  vi.stubEnv('ENABLE_VISUAL_PREVIEW', '1');
  vi.stubEnv('DATABASE_URL', '');

  const service = getQuestionSelectionService();
  const first = await service.assign('preview-experience-1');
  const second = await service.assign('preview-experience-1');

  expect(first).toHaveLength(7);
  expect(second).toEqual(first);
  expect(first.map((item) => item.family)).toEqual([
    'culture', 'place', 'rhythm', 'identity', 'music', 'boundary', 'wildcard',
  ]);
  expect(first[0].prompt).toBe("So tell me. What's a book you actually remember?");
  expect(first[2].choices?.map((choice) => choice.label)).toContain('4 a.m.');
});

test('production question assignment still fails closed without persistent storage', () => {
  vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
  vi.stubEnv('DATABASE_URL', '');
  expect(() => getQuestionSelectionService()).toThrow(QuestionAssignmentUnavailableError);
});
