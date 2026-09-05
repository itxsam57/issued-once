import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsSalesRepository } from '@/server/ops/runtimeOwnerOs';

export async function GET(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get('days') ?? 30);
    const days = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 3650) : 30;
    const snapshot = await createOpsSalesRepository().getSnapshot({ days, now: new Date() });
    return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Owner sales analytics failed');
    return Response.json({ error: 'Sales analytics unavailable' }, { status: 503 });
  }
}
