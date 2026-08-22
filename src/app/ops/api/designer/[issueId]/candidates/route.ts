import { hasOpsSession } from '@/server/ops/opsRequest';
import { createArtworkAccess } from '@/server/design/runtimeArtworkAccess';
import { createOpsDesignCandidateRepository } from '@/server/ops/runtimeOwnerOs';

const TTL = 5 * 60 * 1000;

export async function GET(
  _request: Request,
  context: { params: Promise<{ issueId: string }> },
) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { issueId } = await context.params;
    const [items, access] = await Promise.all([
      createOpsDesignCandidateRepository().listForIssue(issueId, 50),
      Promise.resolve(createArtworkAccess()),
    ]);
    const safe = await Promise.all(items.map(async (item) => ({
      ...item,
      artworkUrl: await access.createReadUrl(item.artworkUrl, TTL),
      createdAt: item.createdAt.toISOString(),
    })));
    return Response.json({ items: safe }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner design candidates failed', error);
    return Response.json({ error: 'Design candidates unavailable' }, { status: 503 });
  }
}
