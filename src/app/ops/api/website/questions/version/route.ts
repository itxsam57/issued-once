import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsWebsiteService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({
  questionId: z.string().trim().min(1).max(200),
  family: z.enum(['culture','place','rhythm','identity','music','boundary','wildcard']),
  prompt: z.string().trim().min(1).max(1000),
  kind: z.enum(['text','choice']),
  optional: z.boolean(),
  choices: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid question version' }, { status: 400 });
  try {
    const version = await createOpsWebsiteService().createQuestionVersion(parsed.data);
    return Response.json({ ok: true, version });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Question version failed' }, { status: 409 });
  }
}
