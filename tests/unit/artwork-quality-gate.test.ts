import { expect, test } from 'vitest';
import { ArtworkQualityGate } from '@/server/design/ArtworkQualityGate';

const valid = {
  issueId: 'issue-1',
  designJobId: 'job-1',
  objectType: 'tee',
  state: 'REVIEW' as const,
  artworkUrl: 'https://abc.public.blob.vercel-storage.com/issues/issue-1/design/job-1.png',
  artworkMimeType: 'image/png',
  artworkBytes: 800_000,
  width: 1024,
  height: 1536,
};

test('accepts only review-state PNG artwork with enough real production pixels', () => {
  expect(new ArtworkQualityGate().validate(valid)).toEqual({ ok: true, checks: expect.any(Array) });
});

test.each([
  [{ ...valid, state: 'QUEUED' }, /review/i],
  [{ ...valid, artworkUrl: 'http://unsafe.example/art.png' }, /https/i],
  [{ ...valid, artworkMimeType: 'image/jpeg' }, /png/i],
  [{ ...valid, artworkBytes: 0 }, /empty|bytes/i],
  [{ ...valid, width: 300, height: 400 }, /resolution|dimensions/i],
  [{ ...valid, objectType: 'hat', width: 400, height: 400 }, /resolution|dimensions/i],
])('fails closed for invalid production artwork %#', (candidate, error) => {
  expect(() => new ArtworkQualityGate().validate(candidate as typeof valid)).toThrow(error);
});
