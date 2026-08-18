import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  InternalOperationsUnauthorizedError,
  requireInternalAuthorization,
} from '@/server/http/internalAuth';
import { createOpsSessionValue, OPS_SESSION_COOKIE } from '@/server/ops/opsAuth';

const schema = z.object({ token: z.string().min(1).max(500) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid owner credential' }, { status: 400 });

  try {
    requireInternalAuthorization(new Headers({
      authorization: `Bearer ${parsed.data.token}`,
    }));
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
    return Response.json({ error: 'Owner operations are unavailable' }, { status: 503 });
  }
}

export async function DELETE() {
  const store = await cookies();
  store.set(OPS_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/ops',
    maxAge: 0,
  });
  return Response.json({ authenticated: false });
}
