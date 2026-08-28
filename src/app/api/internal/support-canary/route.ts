import { z } from 'zod';
import {
  InternalOperationsUnauthorizedError,
  requireInternalAuthorization,
} from '@/server/http/internalAuth';
import { createSupportService } from '@/server/support/runtimeSupport';

export const dynamic = 'force-dynamic';

const schema = z.object({
  releaseId: z.string().regex(/^[0-9a-fA-F]{40}$/),
});

function deployedReleaseId(): string {
  return (
    process.env.ISSUED_ONCE_RELEASE_ID?.trim()
    || process.env.RELEASE_ID?.trim()
    || process.env.GITHUB_SHA?.trim()
    || 'unknown'
  ).toLowerCase();
}

export async function POST(request: Request) {
  try {
    requireInternalAuthorization(request.headers);

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: 'Invalid release' }, { status: 400 });
    }

    const requestedRelease = parsed.data.releaseId.toLowerCase();
    const deployedRelease = deployedReleaseId();
    if (!/^[0-9a-f]{40}$/.test(deployedRelease)) {
      return Response.json({ error: 'Release identity unavailable' }, { status: 503 });
    }
    if (requestedRelease !== deployedRelease) {
      return Response.json({ error: 'Release mismatch' }, { status: 409 });
    }

    const supportInbox = process.env.SUPPORT_INBOX_EMAIL?.trim();
    if (!supportInbox) {
      return Response.json({ error: 'Support delivery unavailable' }, { status: 503 });
    }

    await createSupportService().sendCanary({
      releaseId: deployedRelease,
      replyTo: supportInbox,
    });

    return Response.json(
      { sent: true, releaseId: deployedRelease },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof InternalOperationsUnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Support delivery canary failed', error);
    return Response.json({ error: 'Support delivery unavailable' }, { status: 503 });
  }
}
