import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsIssueDetailRepository } from '@/server/ops/runtimeOwnerOs';
import { OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';

export async function GET(
  _request: Request,
  context: { params: Promise<{ issueId: string }> },
) {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { issueId } = await context.params;
    const issue = await createOpsIssueDetailRepository().getIssueDetail(issueId);
    if (!issue) return Response.json({ error: 'Issue not found' }, { status: 404 });

    return Response.json({
      issue: {
        ...issue,
        reservedAt: issue.reservedAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        timeline: issue.timeline.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
        notifications: issue.notifications.map((notification) => ({ ...notification, updatedAt: notification.updatedAt.toISOString() })),
        support: issue.support.map((request) => ({
          ...request,
          createdAt: request.createdAt.toISOString(),
          updatedAt: request.updatedAt.toISOString(),
        })),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof OpsRuntimeUnavailableError) {
      return Response.json({ error: 'Owner operations are unavailable' }, { status: 503 });
    }
    console.error('owner Issue detail failed', error);
    return Response.json({ error: 'Owner Issue detail failed' }, { status: 500 });
  }
}
