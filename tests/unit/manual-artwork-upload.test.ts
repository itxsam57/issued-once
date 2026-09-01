import { deflateSync } from 'node:zlib';
import { expect, test } from 'vitest';

import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { ManualArtworkUploadService } from '@/server/ops/ManualArtworkUploadService';

function crc32(input: Buffer): number {
  let crc = 0xffff_ffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb8_8320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function png(width: number, height: number, ancillaryTextBytes = 0): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  const ancillary = ancillaryTextBytes > 0
    ? [pngChunk('tEXt', Buffer.concat([Buffer.from('qa\0', 'latin1'), Buffer.alloc(ancillaryTextBytes, 0x78)]))]
    : [];
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    ...ancillary,
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function corruptHeaderOnlyPng(width: number, height: number, bytes = 12_000): Buffer {
  const out = Buffer.alloc(bytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(out, 0);
  out.writeUInt32BE(13, 8);
  out.write('IHDR', 12, 'ascii');
  out.writeUInt32BE(width, 16);
  out.writeUInt32BE(height, 20);
  return out;
}

test('stores a valid owner PNG as an audited OWNER_UPLOAD candidate and leaves approval pending by default', async () => {
  const calls: unknown[] = [];
  const service = new ManualArtworkUploadService(
    { getEffective: async () => ({ globalVersion: 1, override: null, policy: DEFAULT_DESIGN_POLICY }) },
    {
      prepareManualUpload: async () => ({ designJobId: '22222222-2222-4222-8222-222222222222', objectType: 'tee' }),
      saveManualCandidate: async (input) => { calls.push(input); return { candidateId: '33333333-3333-4333-8333-333333333333' }; },
    },
    { put: async (input) => { calls.push({ stored: input.bytes.length, mimeType: input.mimeType }); return { url: 'https://manual.private.blob.vercel-storage.com/art.png', bytes: input.bytes.length }; } },
    { approve: async () => { throw new Error('default manual upload must not auto-approve'); } },
    { record: async (event: unknown) => { calls.push(event); } } as never,
    () => 'upload-key-1',
  );

  const result = await service.upload({
    issueId: '11111111-1111-4111-8111-111111111111',
    fileName: 'art.png',
    mimeType: 'image/png',
    bytes: png(1800, 2400),
    reason: 'hand-finished composition',
  });

  expect(result).toEqual({ candidateId: '33333333-3333-4333-8333-333333333333', width: 1800, height: 2400, approved: false });
  expect(JSON.stringify(calls)).toContain('OWNER_UPLOAD');
  expect(JSON.stringify(calls)).toContain('DESIGN_MANUAL_UPLOAD');
  expect(JSON.stringify(calls)).not.toContain('89504e47');
});

test('rejects an undersized PNG before storing it', async () => {
  let stored = false;
  const service = new ManualArtworkUploadService(
    { getEffective: async () => ({ globalVersion: 1, override: null, policy: DEFAULT_DESIGN_POLICY }) },
    {
      prepareManualUpload: async () => ({ designJobId: '22222222-2222-4222-8222-222222222222', objectType: 'tee' }),
      saveManualCandidate: async () => { throw new Error('must not save'); },
    },
    { put: async () => { stored = true; throw new Error('must not store'); } },
    { approve: async () => undefined },
    { record: async () => undefined } as never,
  );

  await expect(service.upload({
    issueId: '11111111-1111-4111-8111-111111111111',
    fileName: 'small.png',
    mimeType: 'image/png',
    bytes: png(500, 500, 12_000),
    reason: 'manual alternative',
  })).rejects.toThrow(/dimensions/i);
  expect(stored).toBe(false);
});

test('rejects a corrupt header-only PNG before storing it', async () => {
  let stored = false;
  const service = new ManualArtworkUploadService(
    { getEffective: async () => ({ globalVersion: 1, override: null, policy: DEFAULT_DESIGN_POLICY }) },
    {
      prepareManualUpload: async () => ({ designJobId: '22222222-2222-4222-8222-222222222222', objectType: 'tee' }),
      saveManualCandidate: async () => { throw new Error('must not save'); },
    },
    { put: async () => { stored = true; return { url: 'fs://should-not-store.png', bytes: 12_000 }; } },
    { approve: async () => undefined },
    { record: async () => undefined } as never,
  );

  await expect(service.upload({
    issueId: '11111111-1111-4111-8111-111111111111',
    fileName: 'corrupt.png',
    mimeType: 'image/png',
    bytes: corruptHeaderOnlyPng(1800, 2400),
    reason: 'invalid binary should be blocked',
  })).rejects.toThrow(/png|image|corrupt|invalid/i);
  expect(stored).toBe(false);
});
