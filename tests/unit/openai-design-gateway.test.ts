import { deflateSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import { OpenAIDesignGateway } from '@/server/design/OpenAIDesignGateway';

const brief = {
  concept: 'A quiet geometric signal',
  motifs: ['offset arc'],
  paletteRelation: 'Restrained contrast',
  composition: 'Centered with negative space',
  density: 'low',
  typography: 'none',
  avoid: ['logos'],
  rationale: ['Keeps the signal abstract'],
  imagePrompt: 'An isolated premium geometric print asset',
};

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

function rgbaPng(width: number, height: number, alpha = 0): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4 + 1;
  const scanlines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    scanlines[row] = 0;
    for (let x = 0; x < width; x += 1) {
      scanlines[row + 1 + x * 4 + 3] = alpha;
    }
  }
  const idat = deflateSync(scanlines);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const validPrintPng = rgbaPng(1024, 1536);

describe('OpenAIDesignGateway production artwork model', () => {
  test('defaults to a transparency-compatible image model for print artwork', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: validPrintPng.toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });
    const artwork = await gateway.generateArtwork(brief);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe('gpt-image-1.5');
    expect(body.background).toBe('transparent');
    expect(body.output_format).toBe('png');
    expect(artwork.bytes).toEqual(validPrintPng);
    expect(artwork.width).toBe(1024);
    expect(artwork.height).toBe(1536);
  });

  test('uses landscape production artwork for hats so the DTF cap placement is not forced through a portrait canvas', async () => {
    const landscapePng = rgbaPng(1536, 1024);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: landscapePng.toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });
    const artwork = await gateway.generateArtwork(brief, { objectType: 'hat' });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.size).toBe('1536x1024');
    expect(artwork.width).toBe(1536);
    expect(artwork.height).toBe(1024);
  });

  test('rejects provider output that is not actually PNG image data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from('not-an-image').toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });

    await expect(gateway.generateArtwork(brief)).rejects.toThrow(/png|image/i);
  });

  test('rejects a real PNG whose decoded dimensions do not match the printable request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: rgbaPng(1, 1).toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });

    await expect(gateway.generateArtwork(brief)).rejects.toThrow(/dimensions|1024|1536/i);
  });

  test('rejects a valid opaque PNG even when the provider request asked for a transparent background', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: rgbaPng(1024, 1536, 255).toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });

    await expect(gateway.generateArtwork(brief)).rejects.toThrow(/transparent|alpha/i);
  });

  test('keeps owner reinterpret feedback separate from the seven answer records', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify(brief),
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });
    const answers = Array.from({ length: 7 }, (_, index) => ({
      questionId: `q-${index + 1}`,
      questionVersion: 1,
      family: 'signal',
      prompt: `Prompt ${index + 1}`,
      answer: `Answer ${index + 1}`,
    }));

    await gateway.interpret({
      issueCode: 'IO-TEST',
      objectType: 'tee',
      sizeCode: 'M',
      colorCode: 'Black',
      questions: answers,
      ownerFeedback: 'WRONG MOOD — colder and quieter',
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { input: string; instructions: string };
    const providerInput = JSON.parse(body.input) as { answers: unknown[]; ownerRevision: string | null };
    expect(providerInput.answers).toEqual(answers);
    expect(providerInput.ownerRevision).toBe('WRONG MOOD — colder and quieter');
    expect(body.instructions).toMatch(/untrusted design-direction data/i);
  });

  test('adds regeneration feedback as bounded untrusted artwork direction', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: validPrintPng.toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });

    await gateway.generateArtwork(brief, { ownerFeedback: 'TOO BUSY — simplify the center' });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { prompt: string };
    expect(body.prompt).toContain('Owner revision direction: TOO BUSY — simplify the center');
    expect(body.prompt).toMatch(/untrusted design data/i);
  });

  test('fails fast when configured with GPT Image 2 because production artwork requires alpha transparency', () => {
    expect(() => new OpenAIDesignGateway({
      apiKey: 'test-key',
      imageModel: 'gpt-image-2',
      fetchImpl: vi.fn(),
    })).toThrow(/transparent/i);
  });
});
