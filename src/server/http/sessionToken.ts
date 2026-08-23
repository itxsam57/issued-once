import { createHash, randomBytes } from 'node:crypto';

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function deriveNextOrderSessionToken(currentToken: string): string {
  return createHash('sha256')
    .update('issued-once:repeat-order:v1\0', 'utf8')
    .update(currentToken, 'utf8')
    .digest('base64url');
}
