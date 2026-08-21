import { beforeAll, expect, test, vi } from 'vitest';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { DesignService } from '@/server/design/DesignService';
import type { ArtworkStorageGateway } from '@/server/design/ArtworkStorageGateway';
import type { DesignGateway, StructuredDesignBrief } from '@/server/design/DesignGateway';
import type { DesignInput, DesignJobRecord, DesignRepository } from '@/server/design/DesignRepository';

const issueId = '11111111-1111-4111-8111-111111111111';
const feedback = 'WRONG MOOD — colder, quieter, and less literal';
const brief: StructuredDesignBrief = {
  concept: 'quiet orbit',
  motifs: ['orbit'],
  paletteRelation: 'light on dark',
  composition: 'asymmetric',
  density: 'sparse',
  typography: 'none',
  avoid: [],
  rationale: ['signal'],
  imagePrompt: 'abstract orbit, no text, transparent background',
};

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
});

async function designInput(status: DesignInput['issueStatus']): Promise<DesignInput> {
  return {
    issueId,
    issueCode: 'IO-TEST-FEEDBACK',
    issueStatus: status,
    objectType: 'tee',
    sizeCode: 'M',
    colorCode: 'Black',
    questions: await Promise.all(Array.from({ length: 7 }, async (_, index) => ({
      slot: `q${index + 1}` as DesignInput['questions'][number]['slot'],
      questionId: `question-${index + 1}`,
      questionVersion: 1,
      family: ['culture','place','rhythm','identity','music','boundary','wildcard'][index],
      prompt: `Prompt ${index + 1}`,
      encryptedAnswer: await encryptPrivatePayload({ answer: `private answer ${index + 1}` }),
    }))),
  };
}

class MemoryRepository implements DesignRepository {
  constructor(public input: DesignInput, public job: DesignJobRecord | null = null) {}

  async loadInput(candidateIssueId: string) {
    return candidateIssueId === issueId ? structuredClone(this.input) : null;
  }
  async findByIssueId(candidateIssueId: string) {
    return candidateIssueId === issueId ? this.job : null;
  }
  async begin(job: DesignJobRecord) {
    if (this.job) return { created: false, job: this.job };
    this.job = structuredClone(job);
    this.input.issueStatus = 'BEING_INTERPRETED';
    return { created: true, job: this.job };
  }
  async claim(jobId: string, updatedAt: Date) {
    if (!this.job || this.job.id !== jobId || !['QUEUED', 'FAILED'].includes(this.job.state)) return false;
    this.job.state = 'INTERPRETING';
    this.job.updatedAt = updatedAt;
    return true;
  }
  async saveGenerated(input: {
    jobId: string;
    encryptedBrief: NonNullable<DesignJobRecord['encryptedBrief']>;
    artworkUrl: string;
    artworkMimeType: string;
    artworkBytes: number;
    width: number;
    height: number;
    provider: string;
    model: string;
    updatedAt: Date;
  }) {
    if (!this.job || this.job.id !== input.jobId) throw new Error('missing job');
    Object.assign(this.job, input, { state: 'REVIEW' as const });
    this.input.issueStatus = 'DESIGN_REVIEW';
    return this.job;
  }
  async approve() { throw new Error('not used'); }
  async markFailed(_jobId: string, _code: string, _updatedAt: Date) {
    if (this.job) this.job.state = 'FAILED';
  }
}

const storage: ArtworkStorageGateway = {
  put: vi.fn(async () => ({ url: 'https://blob.example/design.png', bytes: 900_000 })),
};

test('reinterpret sends owner revision feedback to the private interpreter without changing customer answers', async () => {
  const repository = new MemoryRepository(await designInput('RECEIVED'));
  const gateway: DesignGateway = {
    interpret: vi.fn(async (input) => {
      expect((input as typeof input & { ownerFeedback?: string }).ownerFeedback).toBe(feedback);
      expect(input.questions.map((question) => question.answer)).toEqual(
        Array.from({ length: 7 }, (_, index) => `private answer ${index + 1}`),
      );
      return brief;
    }),
    generateArtwork: vi.fn(async () => ({
      bytes: Buffer.from('png'), mimeType: 'image/png' as const, width: 1024, height: 1536,
      provider: 'OPENAI', model: 'gpt-image-1.5',
    })),
  };
  const service = new DesignService(repository, gateway, storage, () => 'job-feedback');

  await (service.createForIssue as unknown as (id: string, ownerFeedback: string) => Promise<DesignJobRecord>)(issueId, feedback);

  expect(gateway.interpret).toHaveBeenCalledTimes(1);
});

test('regenerate sends owner revision feedback only as artwork revision context and does not reinterpret answers', async () => {
  const input = await designInput('BEING_INTERPRETED');
  const repository = new MemoryRepository(input, {
    id: 'job-feedback', issueId, state: 'QUEUED', encryptedBrief: await encryptPrivatePayload(brief),
    artworkUrl: 'https://blob.example/old.png', artworkMimeType: 'image/png', artworkBytes: 900_000,
    width: 1024, height: 1536, provider: 'OPENAI', model: 'gpt-image-1.5',
    createdAt: new Date(), updatedAt: new Date(),
  });
  const generateArtwork = vi.fn(async (...args: unknown[]) => {
    const receivedBrief = args[0] as StructuredDesignBrief;
    const context = args[1] as { ownerFeedback?: string } | undefined;
    expect(receivedBrief.imagePrompt).toBe(brief.imagePrompt);
    expect(context?.ownerFeedback).toBe(feedback);
    return {
      bytes: Buffer.from('png'), mimeType: 'image/png' as const, width: 1024, height: 1536,
      provider: 'OPENAI', model: 'gpt-image-1.5',
    };
  });
  const gateway: DesignGateway = {
    interpret: vi.fn(async () => { throw new Error('reinterpret should not run'); }),
    generateArtwork: generateArtwork as unknown as DesignGateway['generateArtwork'],
  };
  const service = new DesignService(repository, gateway, storage);

  await (service.regenerateArtwork as unknown as (id: string, ownerFeedback: string) => Promise<DesignJobRecord>)(issueId, feedback);

  expect(gateway.interpret).not.toHaveBeenCalled();
  expect(generateArtwork).toHaveBeenCalledTimes(1);
});
