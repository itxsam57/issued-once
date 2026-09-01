import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';
import { GET } from '@/app/api/artwork/[token]/route';

const database = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@/server/experience/NeonSqlExecutor', () => ({
  createNeonSqlExecutor: () => ({ query: database.query }),
}));

const signingKey = 'artwork-signing-key-that-is-long-enough';

beforeEach(() => {
  database.query.mockReset();
  process.env.DATABASE_URL = 'postgresql://user:pass@example.com/db';
  process.env.ARTWORK_SIGNING_KEY = signingKey;
  process.env.APP_ORIGIN = 'https://issuedonce.shop';
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.ARTWORK_SIGNING_KEY;
  delete process.env.APP_ORIGIN;
});

async function call(token: string) {
  return GET(
    new Request(`https://issuedonce.shop/api/artwork/${encodeURIComponent(token)}`),
    { params: Promise.resolve({ token }) },
  );
}

test('streams signed durable private PNG bytes with no-store headers after runtime replacement', async () => {
  const locator = 'artwork://issue-1/job-1';
  const bytes = Buffer.from('private-png');
  database.query.mockResolvedValue([{
    locator,
    issue_id: 'issue-1',
    design_job_id: 'job-1',
    mime_type: 'image/png',
    bytes,
    byte_count: bytes.length,
    content_sha256: createHash('sha256').update(bytes).digest('hex'),
  }]);

  const access = new SignedArtworkAccess(
    signingKey,
    'https://issuedonce.shop',
    () => new Date('2026-08-23T12:00:00.000Z'),
  );
  const url = await access.createReadUrl(locator, 60 * 60 * 1000);
  const token = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');

  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-08-23T12:30:00.000Z');
  try {
    const response = await call(token);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(Buffer.from(await response.arrayBuffer()).toString('utf8')).toBe('private-png');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM artwork_objects'),
      [locator],
    );
  } finally {
    Date.now = originalNow;
  }
});

test('rejects tampered tokens and does not leak durable storage details', async () => {
  const response = await call('tampered-token');
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: 'Artwork access is invalid' });
  expect(database.query).not.toHaveBeenCalled();
});

test('returns an opaque 404 when a signed durable artwork object is missing', async () => {
  database.query.mockResolvedValue([]);
  const access = new SignedArtworkAccess(
    signingKey,
    'https://issuedonce.shop',
    () => new Date('2026-08-23T12:00:00.000Z'),
  );
  const url = await access.createReadUrl('artwork://issue-missing/job-missing', 60 * 60 * 1000);
  const token = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');

  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-08-23T12:30:00.000Z');
  try {
    const response = await call(token);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Artwork is unavailable' });
  } finally {
    Date.now = originalNow;
  }
});
