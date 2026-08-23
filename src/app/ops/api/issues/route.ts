import {
  ArtworkAccessRuntimeUnavailableError,
  createArtworkAccess,
} from '@/server/design/runtimeArtworkAccess';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsIssueDetailRepository } from '@/server/ops/runtimeOwnerOs';
import { createOpsRepository, OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';

const OPS_ARTWORK_READ_TTL_MS = 5 * 60 * 1000;

function optional(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalBoolean(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function optionalDate(value: string | null, endOfDay = false): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid Issue date filter');
  return parsed;
}

export async function GET(request: Request) {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get('view') === 'ledger') {
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const page = await createOpsIssueDetailRepository().listIssues({
        cursor: optional(url.searchParams.get('cursor')),
        limit: Number.isFinite(limit) ? limit : 50,
        search: optional(url.searchParams.get('search')),
        filters: {
          issueStatus: optional(url.searchParams.get('issueStatus')),
          paymentStatus: optional(url.searchParams.get('paymentStatus')),
          designState: optional(url.searchParams.get('designState')),
          manufacturingState: optional(url.searchParams.get('manufacturingState')),
          objectType: optional(url.searchParams.get('objectType')),
          supportOpen: optionalBoolean(url.searchParams.get('supportOpen')),
          paymentException: optionalBoolean(url.searchParams.get('paymentException')),
          countryCode: optional(url.searchParams.get('country')),
          updatedFrom: optionalDate(url.searchParams.get('from')),
          updatedTo: optionalDate(url.searchParams.get('to'), true),
        },
      });
      return Response.json({
        items: page.items.map((issue) => ({ ...issue, updatedAt: issue.updatedAt.toISOString() })),
        nextCursor: page.nextCursor,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Compatibility path for the existing production-review room until the
    // Owner OS Manufacturing panel fully replaces it.
    const issues = await createOpsRepository().listRecent(50);
    const artworkAccess = createArtworkAccess();
    const safeIssues = await Promise.all(issues.map(async (issue) => ({
      ...issue,
      artworkUrl: issue.artworkUrl
        ? await artworkAccess.createReadUrl(issue.artworkUrl, OPS_ARTWORK_READ_TTL_MS)
        : null,
      updatedAt: issue.updatedAt.toISOString(),
    })));
    return Response.json({ issues: safeIssues }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && /Issue date|date range/i.test(error.message)) {
      return Response.json({ error: 'Invalid Issue filters' }, { status: 400 });
    }
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
