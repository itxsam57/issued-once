import { cookies } from 'next/headers';
import { getExperienceRepository, PersistentExperienceRepositoryUnavailableError } from '@/server/experience/runtimeRepository';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/server/http/sessionCookie';
import { InterviewBootstrapService } from '@/server/questions/InterviewBootstrapService';
import {
  getQuestionSelectionService,
  QuestionAssignmentUnavailableError,
} from '@/server/questions/runtimeQuestions';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const existingToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
    const bootstrap = await new InterviewBootstrapService(
      getExperienceRepository(),
      getQuestionSelectionService(),
    ).bootstrap(existingToken);

    if (bootstrap.token !== existingToken) {
      cookieStore.set(SESSION_COOKIE_NAME, bootstrap.token, sessionCookieOptions);
    }

    return Response.json({
      stage: bootstrap.stage,
      initialPosition: bootstrap.initialPosition,
      interviewComplete: bootstrap.interviewComplete,
      entryMode: bootstrap.entryMode,
      questions: bootstrap.questions,
    });
  } catch (error) {
    if (
      error instanceof PersistentExperienceRepositoryUnavailableError ||
      error instanceof QuestionAssignmentUnavailableError
    ) {
      return Response.json({ error: 'Interview storage is unavailable' }, { status: 503 });
    }

    console.error('public interview bootstrap failed', error);
    return Response.json({ error: 'Interview could not begin' }, { status: 500 });
  }
}
