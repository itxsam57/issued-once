import { cookies } from 'next/headers';
import { hasOpsSession } from '@/server/ops/opsRequest';
import {
  createSafepaySandboxQaSessionValue,
  isSafepaySandboxQaAvailable,
  SAFEPAY_SANDBOX_QA_COOKIE,
} from '@/server/payments/safepaySandboxQa';

export async function POST() {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSafepaySandboxQaAvailable()) {
    return Response.json({ error: 'Safepay sandbox QA is unavailable' }, { status: 503 });
  }

  const store = await cookies();
  store.set(SAFEPAY_SANDBOX_QA_COOKIE, createSafepaySandboxQaSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60,
  });
  return Response.json({ active: true, url: '/begin?qa=safepay' });
}
