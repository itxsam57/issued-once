import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsAttentionRepository } from '@/server/ops/runtimeOwnerOs';

export async function GET() {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const items = await createOpsAttentionRepository().list(100, new Date());
    return Response.json({ items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner attention queue failed', error);
    return Response.json({ error: 'Attention queue unavailable' }, { status: 503 });
  }
}
