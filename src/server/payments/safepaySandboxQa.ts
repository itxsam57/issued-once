import { createHmac, timingSafeEqual } from 'node:crypto';
import { createOpsSessionValue } from '@/server/ops/opsAuth';
import { readSafepayRuntimeConfig } from './safepayRuntimeConfig';

export const SAFEPAY_SANDBOX_QA_COOKIE = 'io_safepay_qa';
const QA_SCOPE = 'issued-once-safepay-sandbox-qa:v1';

export function isSafepaySandboxQaAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ENABLE_SAFEPAY_SANDBOX_QA !== '1') return false;
  try {
    return readSafepayRuntimeConfig(env, { requireExplicitEnvironment: true }).environment === 'sandbox';
  } catch {
    return false;
  }
}

export function createSafepaySandboxQaSessionValue(): string {
  return createHmac('sha256', createOpsSessionValue()).update(QA_SCOPE, 'utf8').digest('hex');
}

export function verifySafepaySandboxQaSessionValue(value: string | undefined | null): boolean {
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) return false;
  let expected: string;
  try { expected = createSafepaySandboxQaSessionValue(); } catch { return false; }
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(value, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
