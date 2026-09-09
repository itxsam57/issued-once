import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  createExperienceResumeService,
  ExperienceResumeRuntimeUnavailableError,
} from '@/server/experience/runtimeResume';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    return Response.json(await createExperienceResumeService().read(token));
  } catch (error) {
    if (error instanceof ExperienceResumeRuntimeUnavailableError) {
      return Response.json({ error: 'Saved Issue continuation is unavailable' }, { status: 503 });
    }
    if (
      error instanceof Error &&
      /not found|not resumable|no longer|saved|checkout quote/i.test(error.message)
    ) {
      return Response.json(
        { error: 'This unfinished Issue can no longer be continued' },
        { status: 409 },
      );
    }
    console.error('public experience resume failed');
    return Response.json({ error: 'Saved Issue continuation failed' }, { status: 500 });
  }
}
