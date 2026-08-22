import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsWebsiteService } from '@/server/ops/runtimeOwnerOs';

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    const version = await createOpsWebsiteService().publishProductPrice(body);
    return Response.json({ ok: true, version });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Quick price publish failed';
    return Response.json(
      { error: message },
      { status: /mapping|currency|product|catalog|variant|sellable/i.test(message) ? 409 : 400 },
    );
  }
}
