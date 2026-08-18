import { cookies } from 'next/headers';
import { z } from 'zod';
import type { QuestionId } from '@/domain/experience/types';
import { ExperienceService } from '@/server/experience/ExperienceService';
import {
  getExperienceRepository,
  PersistentExperienceRepositoryUnavailableError,
} from '@/server/experience/runtimeRepository';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/server/http/sessionCookie';

const answerSchema = z.object({
  questionId: z.enum(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']),
  answer: z.string().max(4000),
});

export async function POST(request: Request) {
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid answer payload' }, { status: 400 });
  }

  try {
    const repository = getExperienceRepository();
    const service = new ExperienceService(repository);
    const cookieStore = await cookies();
    let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      if (parsed.data.questionId !== 'q1') {
        return Response.json({ error: 'Interview session is required' }, { status: 409 });
      }

      const started = await service.start({ hookId: 'public-entry' });
      token = started.token;
      cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
    }

    const result = await service.answer({
      token,
      questionId: parsed.data.questionId as QuestionId,
      answer: parsed.data.answer,
    });

    return Response.json({ stage: result.stage });
  } catch (error) {
    if (error instanceof PersistentExperienceRepositoryUnavailableError) {
      return Response.json({ error: 'Interview storage is unavailable' }, { status: 503 });
    }

    if (error instanceof Error && /stage|question|answer|required|not found/i.test(error.message)) {
      return Response.json({ error: 'Interview state conflict' }, { status: 409 });
    }

    console.error('public interview answer failed', error);
    return Response.json({ error: 'Interview answer failed' }, { status: 500 });
  }
}
