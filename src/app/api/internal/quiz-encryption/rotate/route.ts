import { z } from 'zod';
import { createQuizEncryptionRotationService } from '@/server/crypto/runtimeQuizEncryptionRotation';
import { verifyQuizRotationAuthorization } from '@/server/http/quizRotationAuth';

const requestSchema = z
  .object({
    limit: z.number().int().min(1).max(250).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const authorization = verifyQuizRotationAuthorization(request.headers.get('authorization'));
  if (authorization === 'UNCONFIGURED') {
    return Response.json({ error: 'Quiz encryption rotation is unavailable' }, { status: 503 });
  }
  if (authorization !== 'AUTHORIZED') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const text = await request.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: 'Invalid rotation request' }, { status: 400 });
    }
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid rotation request' }, { status: 400 });
  }

  try {
    const service = createQuizEncryptionRotationService();
    const result = await service.migrateBatch(parsed.data.limit ?? 100);
    return Response.json(result);
  } catch {
    return Response.json({ error: 'Quiz encryption rotation failed' }, { status: 503 });
  }
}
