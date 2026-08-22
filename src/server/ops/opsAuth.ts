import { createHmac, timingSafeEqual } from 'node:crypto';

export const OPS_SESSION_COOKIE = 'io_ops';

function configuredToken(): string {
  const token = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
  if (!token) throw new Error('Internal operations are not configured');
  if (token.length < 24) throw new Error('Internal operations token is not configured safely');
  return token;
}

export function createOpsSessionValue(): string {
  return createHmac('sha256', configuredToken())
    .update('issued-once-owner-session:v1', 'utf8')
    .digest('hex');
}

export function verifyOpsSessionValue(value: string | undefined | null): boolean {
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) return false;
  let expected: string;
  try {
    expected = createOpsSessionValue();
  } catch {
    return false;
  }
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(value, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
