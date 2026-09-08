import { createHash, timingSafeEqual } from 'node:crypto';

export type QuizRotationAuthorization = 'AUTHORIZED' | 'UNAUTHORIZED' | 'UNCONFIGURED';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function verifyQuizRotationAuthorization(
  authorization: string | null,
): QuizRotationAuthorization {
  const configured = process.env.QUIZ_KEY_ROTATION_TOKEN?.trim();
  if (!configured || configured.length < 32) {
    return 'UNCONFIGURED';
  }

  const header = authorization?.trim() ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) {
    return 'UNAUTHORIZED';
  }

  const candidate = header.slice(prefix.length).trim();
  if (!candidate) {
    return 'UNAUTHORIZED';
  }

  return timingSafeEqual(digest(candidate), digest(configured)) ? 'AUTHORIZED' : 'UNAUTHORIZED';
}
