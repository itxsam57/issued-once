import {
  ArtworkAccessRuntimeUnavailableError,
  createArtworkAccess,
} from '@/server/design/runtimeArtworkAccess';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsRepository, OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';

const OPS_ARTWORK_READ_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const issues = await createOpsRepository().listRecent(50);
    const artworkAccess = createArtworkAccess();
    const safeIssues = await Promise.all(issues.map(async (issue) => ({
      ...issue,
      artworkUrl: issue.artworkUrl
        ? await artworkAccess.createReadUrl(issue.artworkUrl, OPS_ARTWORK_READ_TTL_MS)
        : null,
      updatedAt: issue.updatedAt.toISOString(),
    })));
    return Response.json({ issues: safeIssues });
  } catch (error) {
    if (
      error instanceof OpsRuntimeUnavailableError ||
      error instanceof ArtworkAccessRuntimeUnavailableError
    ) {
      return Response.json({ error: 'Owner operations are unavailable' }, { status: 503 });
    }
    console.error('owner issue list failed', error);
    return Response.json({ error: 'Owner issue list failed' }, { status: 500 });
  }
}
