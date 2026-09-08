import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/server/http/sessionCookie';
import { IssueRecoveryError } from '@/server/issues/IssueRecoveryService';
import {
  createIssueRecoveryService,
  IssueRecoveryRuntimeUnavailableError,
} from '@/server/issues/runtimeIssueRecovery';

const schema = z.object({
  issueCode: z.string().trim().min(1).max(32),
  email: z.string().trim().email().max(320),
  challengeId: z.string().trim().min(1).max(100),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Enter the Issue Code, email, and six-digit code' }, { status: 400 });
  }

  try {
    const restored = await createIssueRecoveryService().verifyOtp(parsed.data);
    const response = NextResponse.json({ restored: true });
    response.cookies.set(SESSION_COOKIE_NAME, restored.token, sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof IssueRecoveryRuntimeUnavailableError) {
      return Response.json({ error: 'Issue recovery is unavailable' }, { status: 503 });
    }
    if (error instanceof IssueRecoveryError) {
      return Response.json({ error: 'Issue recovery could not be verified' }, { status: 409 });
    }
    console.error('issue recovery verification failed');
    return Response.json({ error: 'Issue recovery could not be verified' }, { status: 500 });
  }
}
