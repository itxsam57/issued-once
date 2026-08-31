import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsAuditService } from '@/server/ops/runtimeOwnerOs';

function dateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid audit date');
  return date;
}

export async function GET(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const page = await createOpsAuditService().listRecent({
      cursor: url.searchParams.get('cursor'),
      action: url.searchParams.get('action'),
      issueCode: url.searchParams.get('issueCode'),
      target: url.searchParams.get('target'),
      from: dateParam(url.searchParams.get('from')),
      to: dateParam(url.searchParams.get('to')),
      limit: 50,
    });
    return Response.json({
      items: page.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      nextCursor: page.nextCursor,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && /audit (date|filter|range)/i.test(error.message)) {
      return Response.json({ error: 'Invalid audit filters' }, { status: 400 });
    }
    console.error('Owner audit stream failed');
    return Response.json({ error: 'Audit stream unavailable' }, { status: 503 });
  }
}
