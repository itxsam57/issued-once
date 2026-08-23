import { expect, test } from 'vitest';
import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';

const signingKey = 'artwork-signing-key-that-is-long-enough';
const now = () => new Date('2026-08-23T12:00:00.000Z');

test('creates a bounded same-app signed read URL without exposing a filesystem path', async () => {
  const access = new SignedArtworkAccess(signingKey, 'https://issuedonce.shop', now);
  const url = await access.createReadUrl(
    'fs://issues/issue-1/design/job-1.png',
    60 * 60 * 1000,
  );
  expect(url).toMatch(/^https:\/\/issuedonce\.shop\/api\/artwork\//);
  expect(url).not.toContain('/home/');
  expect(url).not.toContain('ARTWORK_STORAGE_DIR');

  const token = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  expect(access.verifyToken(token)).toEqual({
    key: 'issues/issue-1/design/job-1.png',
    expiresAt: new Date('2026-08-23T13:00:00.000Z'),
  });
});

test('rejects expired, tampered, non-private, traversal and overlong read windows', async () => {
  const access = new SignedArtworkAccess(signingKey, 'https://issuedonce.shop', now);
  const url = await access.createReadUrl('fs://issues/a/design/b.png', 60_000);
  const token = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');

  expect(() => access.verifyToken(`${token}x`)).toThrow(/signature|token/i);
  expect(() => new SignedArtworkAccess(
    signingKey,
    'https://issuedonce.shop',
    () => new Date('2026-08-23T12:02:00.000Z'),
  ).verifyToken(token)).toThrow(/expired/i);

  await expect(access.createReadUrl('https://public.example/design.png', 60_000)).rejects.toThrow(/private|locator/i);
  await expect(access.createReadUrl('fs://../escape.png', 60_000)).rejects.toThrow(/path|locator/i);
  await expect(access.createReadUrl(
    'fs://issues/a/design/b.png',
    7 * 24 * 60 * 60 * 1000,
  )).rejects.toThrow(/read window/i);
});
