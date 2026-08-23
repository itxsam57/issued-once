import { cookies } from 'next/headers';
import { z } from 'zod';
import type { ExperienceStage } from '@/domain/experience/types';
import {
  createRepeatOrderService,
  RepeatOrderRuntimeUnavailableError,
} from '@/server/experience/runtimeRepeatOrders';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/server/http/sessionCookie';
import { toInterviewQuestions } from '@/server/questions/QuestionSelectionService';

const schema = z.object({
  choice: z.enum(['reuse', 'fresh']),
}).strict();

const POSITION_BY_STAGE: Partial<Record<ExperienceStage, number>> = {
  QUESTION_1: 1,
  QUESTION_2: 2,
  QUESTION_3: 3,
  QUESTION_4: 4,
  QUESTION_5: 5,
  QUESTION_6: 6,
  QUESTION_7: 7,
};

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid repeat-order choice' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    const result = await createRepeatOrderService().choose({
      sessionToken,
      mode: parsed.data.choice,
    });

    cookieStore.set(SESSION_COOKIE_NAME, result.token, sessionCookieOptions);

    if (result.mode === 'reuse') {
      return Response.json({
        entryMode: 'form',
        stage: result.stage,
        initialPosition: 7,
        interviewComplete: true,
        questions: [],
      });
    }

    const initialPosition = POSITION_BY_STAGE[result.stage] ?? 1;
    return Response.json({
      entryMode: 'interview',
      stage: result.stage,
      initialPosition,
      interviewComplete: false,
      questions: toInterviewQuestions(result.questions),
    });
  } catch (error) {
    if (error instanceof RepeatOrderRuntimeUnavailableError) {
      return Response.json({ error: 'Repeat ordering is unavailable' }, { status: 503 });
    }
    if (
      error instanceof Error &&
      /experience not found|repeat order is not unlocked|profile assignment|previous prompt|repeat order has already progressed/i.test(error.message)
    ) {
      return Response.json({ error: 'Repeat-order state conflict' }, { status: 409 });
    }

    console.error('repeat order choice failed', error);
    return Response.json({ error: 'Repeat order could not begin' }, { status: 500 });
  }
}
