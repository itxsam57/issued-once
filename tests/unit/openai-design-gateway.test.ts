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

describe('OpenAIDesignGateway production artwork model', () => {
  test('defaults to a transparency-compatible image model for print artwork', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const gateway = new OpenAIDesignGateway({ apiKey: 'test-key', fetchImpl });
    await gateway.generateArtwork(brief);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe('gpt-image-1.5');
    expect(body.background).toBe('transparent');
    expect(body.output_format).toBe('png');
  });

  test('fails fast when configured with GPT Image 2 because production artwork requires alpha transparency', () => {
    expect(() => new OpenAIDesignGateway({
      apiKey: 'test-key',
      imageModel: 'gpt-image-2',
      fetchImpl: vi.fn(),
    })).toThrow(/transparent/i);
  });
});
