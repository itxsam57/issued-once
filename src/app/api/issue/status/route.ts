import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  createIssueStatusService,
  IssueStatusRuntimeUnavailableError,
} from '@/server/issues/runtimeIssueStatus';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ found: false });

  try {
    return Response.json(await createIssueStatusService().forSession(token));
  } catch (error) {
    if (error instanceof IssueStatusRuntimeUnavailableError) {
      return Response.json({ error: 'Issue status is unavailable' }, { status: 503 });
    }
    console.error('issue status lookup failed');
    return Response.json({ error: 'Issue status failed' }, { status: 500 });
  }
}
