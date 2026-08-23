import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';
import { GET } from '@/app/api/artwork/[token]/route';

const signingKey = 'artwork-signing-key-that-is-long-enough';
let root = '';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'issued-once-artwork-route-'));
  process.env.ARTWORK_STORAGE_DIR = root;
  process.env.ARTWORK_SIGNING_KEY = signingKey;
  process.env.APP_ORIGIN = 'https://issuedonce.shop';
});

afterEach(async () => {
  delete process.env.ARTWORK_STORAGE_DIR;
  delete process.env.ARTWORK_SIGNING_KEY;
  delete process.env.APP_ORIGIN;
  if (root) await rm(root, { recursive: true, force: true });
});

async function call(token: string) {
  return GET(
    new Request(`https://issuedonce.shop/api/artwork/${encodeURIComponent(token)}`),
    { params: Promise.resolve({ token }) },
  );
}

test('streams signed private PNG bytes with no-store headers', async () => {
  const key = 'issues/issue-1/design/job-1.png';
  const file = join(root, ...key.split('/'));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from('private-png'));

  const access = new SignedArtworkAccess(
    signingKey,
    'https://issuedonce.shop',
    () => new Date('2026-08-23T12:00:00.000Z'),
  );
  const url = await access.createReadUrl(`fs://${key}`, 60 * 60 * 1000);
  const token = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');

  // Verify against a clock still inside the token window.
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-08-23T12:30:00.000Z');
  try {
    const response = await call(token);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(Buffer.from(await response.arrayBuffer()).toString('utf8')).toBe('private-png');
  } finally {
    Date.now = originalNow;
  }
});

test('rejects tampered tokens and does not leak missing filesystem details', async () => {
  const response = await call('tampered-token');
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: 'Artwork access is invalid' });
});
