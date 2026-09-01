import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';
import {
  ArtworkIntegrityError,
  ArtworkUnavailableError,
  PostgresArtworkStorage,
} from '@/server/design/PostgresArtworkStorage';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  let key: string;
  try {
    const { token } = await context.params;
    const access = new SignedArtworkAccess(
      env('ARTWORK_SIGNING_KEY'),
      env('APP_ORIGIN'),
      () => new Date(Date.now()),
    );
    key = access.verifyToken(token).key;
  } catch {
    return Response.json({ error: 'Artwork access is invalid' }, { status: 401 });
  }

  try {
    const storage = new PostgresArtworkStorage(
      createNeonSqlExecutor(env('DATABASE_URL')),
    );
    const artwork = await storage.get(`artwork://${key}`);
    return new Response(new Uint8Array(artwork.bytes), {
      status: 200,
      headers: {
        'content-type': artwork.mimeType,
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ArtworkUnavailableError || error instanceof ArtworkIntegrityError) {
      return Response.json({ error: 'Artwork is unavailable' }, { status: 404 });
    }
    return Response.json({ error: 'Artwork is temporarily unavailable' }, { status: 503 });
  }
}
