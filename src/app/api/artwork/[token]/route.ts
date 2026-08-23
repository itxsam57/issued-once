import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function resolvePrivateArtwork(rootValue: string, key: string): string {
  const root = resolve(rootValue);
  const target = resolve(root, ...key.split('/'));
  const rel = relative(root, target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== target) {
    throw new Error('Artwork path is invalid');
  }
  return target;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const access = new SignedArtworkAccess(
      env('ARTWORK_SIGNING_KEY'),
      env('APP_ORIGIN'),
      () => new Date(Date.now()),
    );
    const verified = access.verifyToken(token);
    const file = resolvePrivateArtwork(env('ARTWORK_STORAGE_DIR'), verified.key);
    const bytes = await readFile(file);
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT') {
      return Response.json({ error: 'Artwork is unavailable' }, { status: 404 });
    }
    return Response.json({ error: 'Artwork access is invalid' }, { status: 401 });
  }
}
