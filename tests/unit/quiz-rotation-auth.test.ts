import { afterEach, describe, expect, test } from 'vitest';
import { verifyQuizRotationAuthorization } from '@/server/http/quizRotationAuth';

const TOKEN = 'quiz-rotation-token-that-is-at-least-32-characters';

afterEach(() => {
  delete process.env.QUIZ_KEY_ROTATION_TOKEN;
});

describe('verifyQuizRotationAuthorization', () => {
  test('fails closed when the dedicated rotation token is missing or too short', () => {
    expect(verifyQuizRotationAuthorization(`Bearer ${TOKEN}`)).toBe('UNCONFIGURED');

    process.env.QUIZ_KEY_ROTATION_TOKEN = 'too-short';
    expect(verifyQuizRotationAuthorization('Bearer too-short')).toBe('UNCONFIGURED');
  });

  test('rejects missing, malformed, and incorrect bearer credentials', () => {
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;

    expect(verifyQuizRotationAuthorization(null)).toBe('UNAUTHORIZED');
    expect(verifyQuizRotationAuthorization(TOKEN)).toBe('UNAUTHORIZED');
    expect(verifyQuizRotationAuthorization('Bearer wrong-token-that-is-at-least-32-characters')).toBe(
      'UNAUTHORIZED',
    );
  });

  test('authorizes only the exact dedicated bearer token', () => {
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;

    expect(verifyQuizRotationAuthorization(`Bearer ${TOKEN}`)).toBe('AUTHORIZED');
  });
});
