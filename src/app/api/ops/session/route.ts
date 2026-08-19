import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  InternalOperationsUnauthorizedError,
  requireInternalAuthorization,
} from '@/server/http/internalAuth';
import {
  createOpsSessionValue,
  OPS_SESSION_COOKIE,
  verifyOpsSessionValue,
} from '@/server/ops/opsAuth';
import { createOpsAuditService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({ token: z.string().min(1).max(500) });

async function recordSessionAudit(action: 'OPS_LOGIN' | 'OPS_LOGOUT'): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Owner audit store is not configured');
    return;
  }
  await createOpsAuditService().record({
    actor: 'OWNER',
    action,
    issueId: null,
    targetType: 'owner_session',
    targetId: 'OWNER',
    reason: null,
    safeMetadata: { sessionVersion: 'v1' },
  });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid owner credential' }, { status: 400 });

  try {
    requireInternalAuthorization(new Headers({
      authorization: `Bearer ${parsed.data.token}`,
    }));
    await recordSessionAudit('OPS_LOGIN');
    const store = await cookies();
    store.set(OPS_SESSION_COOKIE, createOpsSessionValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/ops',
      maxAge: 8 * 60 * 60,
    });
    return Response.json({ authenticated: true });
  } catch (error) {
    if (error instanceof InternalOperationsUnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Owner session creation failed', error);
    return Response.json({ error: 'Owner operations are unavailable' }, { status: 503 });
  }
}

export async function DELETE() {
  const store = await cookies();
  const existing = store.get(OPS_SESSION_COOKIE)?.value ?? null;
  const authenticated = verifyOpsSessionValue(existing);

  store.set(OPS_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/ops',
    maxAge: 0,
  });

  if (authenticated) {
    try {
      await recordSessionAudit('OPS_LOGOUT');
    } catch (error) {
      console.error('Owner session logout audit failed', error);
    }
  }
  return Response.json({ authenticated: false });
}
