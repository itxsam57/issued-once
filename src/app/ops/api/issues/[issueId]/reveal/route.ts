import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsPrivateRevealService } from '@/server/ops/runtimeOwnerOs';
import { OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';
import type { OpsRevealCategory } from '@/server/ops/OpsPrivateRevealService';

const CATEGORIES = new Set<OpsRevealCategory>(['contact', 'shipping', 'answers', 'design_brief', 'support_message']);

export async function POST(
  request: Request,
  context: { params: Promise<{ issueId: string }> },
) {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { issueId } = await context.params;
    const body = await request.json().catch(() => null) as { category?: string; reason?: string } | null;
    if (!body?.category || !CATEGORIES.has(body.category as OpsRevealCategory)) {
      return Response.json({ error: 'Invalid reveal category' }, { status: 400 });
    }
    const value = await createOpsPrivateRevealService().reveal({
      issueId,
      category: body.category as OpsRevealCategory,
      reason: body.reason ?? '',
    });
    return Response.json({ category: body.category, value }, {
      headers: {
        'Cache-Control': 'no-store, private, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    if (error instanceof OpsRuntimeUnavailableError) {
      return Response.json({ error: 'Private reveal is unavailable' }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Private reveal failed';
    const status = /required|not available|unsupported/i.test(message) ? 400 : 500;
    if (status === 500) console.error('private reveal failed');
    return Response.json({ error: status === 500 ? 'Private reveal failed' : message }, { status });
  }
}
