import { cookies } from 'next/headers';
import {
  getExperienceRepository,
  PersistentExperienceRepositoryUnavailableError,
} from '@/server/experience/runtimeRepository';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/server/http/sessionCookie';
import { InterviewBootstrapService } from '@/server/questions/InterviewBootstrapService';
import {
  getQuestionSelectionService,
  QuestionAssignmentUnavailableError,
} from '@/server/questions/runtimeQuestions';

export async function POST() {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!existingToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    const bootstrap = await new InterviewBootstrapService(
      getExperienceRepository(),
      getQuestionSelectionService(),
    ).restart(existingToken);

    cookieStore.set(SESSION_COOKIE_NAME, bootstrap.token, sessionCookieOptions);
    return Response.json({
      stage: bootstrap.stage,
      initialPosition: bootstrap.initialPosition,
      interviewComplete: bootstrap.interviewComplete,
      entryMode: bootstrap.entryMode,
      resumePrompt: false,
      questions: bootstrap.questions,
    });
  } catch (error) {
    if (
      error instanceof PersistentExperienceRepositoryUnavailableError ||
      error instanceof QuestionAssignmentUnavailableError
    ) {
      return Response.json({ error: 'Interview storage is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /not found|cannot|conflict/i.test(error.message)) {
      return Response.json({ error: 'This unfinished Issue can no longer be restarted' }, { status: 409 });
    }

    console.error('public interview restart failed');
    return Response.json({ error: 'A fresh Issue could not be started' }, { status: 500 });
  }
}
