import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { cleanupOtpRateLimits } from '@/server/contact/runtimeContact';
import { createIssuedOnceJobProcessor } from '@/server/jobs/runtimeJobs';

const JOB_TOPICS = ['issued-once-design', 'issued-once-notifications'] as const;
const JOB_BATCH_LIMIT = 8;

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function authorize(request: Request): 'ok' | 'unauthorized' {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured || configured.length < 24) return 'unauthorized';
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  if (!authorization.startsWith('Bearer ')) return 'unauthorized';
  const candidate = authorization.slice('Bearer '.length).trim();
  if (!candidate || !timingSafeEqual(digest(candidate), digest(configured))) return 'unauthorized';
  return 'ok';
}

export async function POST(request: Request) {
  const authorization = authorize(request);
  if (authorization === 'unauthorized') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await createIssuedOnceJobProcessor().drain({
      topics: [...JOB_TOPICS],
      workerId: `hostinger-cron-${process.pid}-${randomUUID()}`,
      limit: JOB_BATCH_LIMIT,
    });
    const otpRateLimitsPruned = await cleanupOtpRateLimits();
    return Response.json({ ...result, otpRateLimitsPruned });
  } catch {
    console.error('Background job drain failed');
    return Response.json({ error: 'Background job drain failed' }, { status: 500 });
  }
}
