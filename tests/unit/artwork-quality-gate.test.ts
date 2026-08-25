import { expect, test } from 'vitest';
import { ArtworkQualityGate } from '@/server/design/ArtworkQualityGate';

const legacyBlob = {
  issueId: 'issue-1',
  designJobId: 'job-1',
  objectType: 'tee',
  state: 'REVIEW' as const,
  artworkUrl: 'https://abc.private.blob.vercel-storage.com/issues/issue-1/design/job-1.png',
  artworkMimeType: 'image/png',
  artworkBytes: 800_000,
  width: 1024,
  height: 1536,
};

const hostingerPrivate = {
  ...legacyBlob,
  artworkUrl: 'fs://issues/issue-1/design/job-1.png',
};

test('accepts legacy private Blob artwork with enough real production pixels', () => {
  expect(new ArtworkQualityGate().validate(legacyBlob)).toEqual({ ok: true, checks: expect.any(Array) });
});

test('accepts the canonical Hostinger private filesystem artwork locator', () => {
  expect(new ArtworkQualityGate().validate(hostingerPrivate)).toEqual({ ok: true, checks: expect.any(Array) });
});

test.each([
  [{ ...legacyBlob, state: 'QUEUED' }, /review/i],
  [{ ...legacyBlob, artworkUrl: 'http://unsafe.example/art.png' }, /https|private/i],
  [{ ...legacyBlob, artworkUrl: 'https://abc.public.blob.vercel-storage.com/issues/x.png' }, /private/i],
  [{ ...legacyBlob, artworkUrl: 'https://example.com/issues/issue-1/design/job-1.png' }, /private/i],
  [{ ...legacyBlob, artworkMimeType: 'image/jpeg' }, /png/i],
  [{ ...legacyBlob, artworkBytes: 0 }, /empty|bytes/i],
  [{ ...legacyBlob, width: 900, height: 1300 }, /resolution|dimensions/i],
  [{ ...legacyBlob, objectType: 'hat', width: 900, height: 900 }, /resolution|dimensions/i],
])('fails closed for invalid production artwork %#', (candidate, error) => {
  expect(() => new ArtworkQualityGate().validate(candidate as typeof legacyBlob)).toThrow(error);
});
