import { hasOpsSession } from '@/server/ops/opsRequest';
import { createArtworkAccess } from '@/server/design/runtimeArtworkAccess';
import { createOpsDesignerService } from '@/server/ops/runtimeOwnerOs';

const TTL = 5 * 60 * 1000;

export async function GET() {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [items, access] = await Promise.all([
      createOpsDesignerService().listQueue(100),
      Promise.resolve(createArtworkAccess()),
    ]);
    const safe = await Promise.all(items.map(async (item) => ({
      ...item,
      artworkUrl: item.artworkUrl ? await access.createReadUrl(item.artworkUrl, TTL) : null,
      updatedAt: item.updatedAt.toISOString(),
    })));
    return Response.json({ items: safe }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Owner Designer queue failed');
    return Response.json({ error: 'Designer queue unavailable' }, { status: 503 });
  }
}
