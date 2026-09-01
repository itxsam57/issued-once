import { expect, test } from 'vitest';
import { ArtworkQualityGate } from '@/server/design/ArtworkQualityGate';

const legacyBlob = {
  issueId: 'issue-1',
  designJobId: 'job-1',
  objectType: 'tee',
  sizeCode: 'M',
  colorCode: 'Black',
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

const matchingTemplate = {
  objectType: 'tee',
  sizeCode: 'M',
  colorCode: 'Black',
  placementWidth: 900,
  placementHeight: 1350,
  targetDpi: 150,
};

type QualityResult = { ok: true; checks: readonly string[] };

function validate(
  candidate: typeof legacyBlob = legacyBlob,
  template: typeof matchingTemplate = matchingTemplate,
): QualityResult {
  return (new ArtworkQualityGate().validate as unknown as (
    candidate: typeof legacyBlob,
    template: typeof matchingTemplate,
  ) => QualityResult)(candidate, template);
}

test('accepts legacy private Blob artwork with enough real production pixels for the exact sampled template', () => {
  expect(validate(legacyBlob)).toEqual({ ok: true, checks: expect.any(Array) });
});

test('accepts the canonical Hostinger private filesystem artwork locator', () => {
  expect(validate(hostingerPrivate)).toEqual({ ok: true, checks: expect.any(Array) });
});

test('records exact template and effective-DPI evidence for an approvable candidate', () => {
  const result = validate(hostingerPrivate);
  expect(result.checks).toContain('template:tee:M:Black');
  expect(result.checks.some((check) => check.startsWith('effective-dpi:'))).toBe(true);
});

test('rejects a sampled print template that belongs to a different physical selection', () => {
  expect(() => validate(legacyBlob, {
    ...matchingTemplate,
    objectType: 'tote',
    sizeCode: 'OS',
  })).toThrow(/template|selection|mapping/i);
});

test('rejects source pixels whose effective DPI is below the sampled template target', () => {
  expect(() => validate(legacyBlob, {
    ...matchingTemplate,
    placementWidth: 1800,
    placementHeight: 2400,
    targetDpi: 150,
  })).toThrow(/dpi|resolution|placement/i);
});

test.each([
  [{ ...legacyBlob, state: 'QUEUED' }, /review/i],
  [{ ...legacyBlob, artworkUrl: 'http://unsafe.example/art.png' }, /https|private/i],
  [{ ...legacyBlob, artworkUrl: 'https://abc.public.blob.vercel-storage.com/issues/x.png' }, /private/i],
  [{ ...legacyBlob, artworkUrl: 'https://example.com/issues/issue-1/design/job-1.png' }, /private/i],
  [{ ...legacyBlob, artworkMimeType: 'image/jpeg' }, /png/i],
  [{ ...legacyBlob, artworkBytes: 0 }, /empty|bytes/i],
  [{ ...legacyBlob, width: 900, height: 1300 }, /resolution|dimensions|dpi/i],
  [{ ...legacyBlob, objectType: 'hat', sizeCode: 'OS', width: 900, height: 900 }, /resolution|dimensions|template|dpi/i],
])('fails closed for invalid production artwork %#', (candidate, error) => {
  expect(() => validate(candidate as typeof legacyBlob)).toThrow(error);
});
