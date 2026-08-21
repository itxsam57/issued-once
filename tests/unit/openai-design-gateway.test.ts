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
      data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }],
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
