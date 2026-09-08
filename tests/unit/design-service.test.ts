import { beforeAll, expect, test, vi } from 'vitest';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { DesignService } from '@/server/design/DesignService';
import type { DesignGateway } from '@/server/design/DesignGateway';
import type {
  DesignInput,
  DesignJobRecord,
  DesignRepository,
} from '@/server/design/DesignRepository';
import type { ArtworkStorageGateway } from '@/server/design/ArtworkStorageGateway';

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
});

class MemoryDesignRepository implements DesignRepository {
  input: DesignInput | null = null;
  job: DesignJobRecord | null = null;
  async loadInput(issueId: string) { return this.input?.issueId === issueId ? structuredClone(this.input) : null; }
  async findByIssueId(issueId: string) { return this.job?.issueId === issueId ? this.job : null; }
  async begin(job: DesignJobRecord) {
    if (this.job) return { created: false, job: this.job };
    this.job = structuredClone(job);
    if (this.input) this.input.issueStatus = 'BEING_INTERPRETED';
    return { created: true, job: this.job };
  }
  async claim(jobId: string, updatedAt: Date) {
    if (!this.job || this.job.id !== jobId || !['QUEUED', 'FAILED'].includes(this.job.state)) return false;
    if (this.input?.issueStatus !== 'BEING_INTERPRETED') return false;
    this.job.state = 'INTERPRETING'; this.job.updatedAt = updatedAt; return true;
  }
  async saveGenerated(input: { jobId: string; encryptedBrief: NonNullable<DesignJobRecord['encryptedBrief']>; artworkUrl: string; artworkMimeType: string; artworkBytes: number; width: number; height: number; provider: string; model: string; updatedAt: Date }) {
    if (!this.job || this.job.id !== input.jobId) throw new Error('missing job');
    if (this.input?.issueStatus !== 'BEING_INTERPRETED') throw new Error('Issue is no longer eligible for design completion');
    Object.assign(this.job, input, { state: 'REVIEW' as const });
    if (this.input) this.input.issueStatus = 'DESIGN_REVIEW';
    return this.job;
  }
  async approve(jobId: string, _checks: readonly string[], approvedAt: Date) {
    if (!this.job || this.job.id !== jobId || this.job.state !== 'REVIEW') throw new Error('not reviewable');
    this.job.state = 'APPROVED'; this.job.updatedAt = approvedAt;
    if (this.input) this.input.issueStatus = 'DESIGN_APPROVED';
    return this.job;
  }
  async markFailed(_jobId: string, _code: string, _updatedAt: Date) {
    if (this.job && this.job.state !== 'APPROVED') this.job.state = 'FAILED';
  }
}

async function paidInput(): Promise<DesignInput> {
  return {
    issueId: 'issue-1', issueCode: 'IO-ABCD-EFGH', issueStatus: 'RECEIVED',
    objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
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

test('decrypts answers only at design boundary, gives image generation only the structured brief, and stops at review', async () => {
  const repository = new MemoryDesignRepository();
  repository.input = await paidInput();
  const gateway: DesignGateway = {
    interpret: vi.fn(async (input: Parameters<DesignGateway['interpret']>[0]) => {
      expect(input.questions.map((q) => q.answer)).toContain('private answer 1');
      return {
        concept: 'quiet orbit under pressure', motifs: ['broken orbit', 'weather line'], paletteRelation: 'light mark on black',
        composition: 'asymmetric vertical field', density: 'sparse', typography: 'none',
        avoid: ['literal book cover', 'portrait'], rationale: ['culture informs geometry', 'place informs atmosphere'],
        imagePrompt: 'abstract broken orbit and weather-line composition, no text, transparent background',
      };
    }),
    generateArtwork: vi.fn(async (brief: Parameters<DesignGateway['generateArtwork']>[0]) => {
      expect(JSON.stringify(brief)).not.toContain('private answer');
      return { bytes: Buffer.from('png-bytes'), mimeType: 'image/png' as const, width: 1024, height: 1536, provider: 'OPENAI', model: 'gpt-image-2' };
    }),
  };
  const storage: ArtworkStorageGateway = {
    put: vi.fn(async () => ({ url: 'https://blob.example/issues/issue-1/design.png', bytes: 900_000 })),
    get: vi.fn(async () => { throw new Error('not used'); }),
  };
  const service = new DesignService(repository, gateway, storage, () => 'job-1', () => new Date('2026-08-19T01:10:00Z'));

  const result = await service.createForIssue('issue-1');
  expect(result.state).toBe('REVIEW');
  expect(result.artworkUrl).toBe('https://blob.example/issues/issue-1/design.png');
  expect(gateway.interpret).toHaveBeenCalledTimes(1);
  expect(gateway.generateArtwork).toHaveBeenCalledTimes(1);
});

test('refuses unpaid/unreceived issue state and reuses a finished design job', async () => {
  const repository = new MemoryDesignRepository();
  repository.input = { ...(await paidInput()), issueStatus: 'CANCELED' };
  const gateway = { interpret: vi.fn(), generateArtwork: vi.fn() } as unknown as DesignGateway;
  const storage = { put: vi.fn() } as unknown as ArtworkStorageGateway;
  await expect(new DesignService(repository, gateway, storage).createForIssue('issue-1')).rejects.toThrow(/eligible|paid|received/i);

  repository.input = await paidInput();
  repository.job = {
    id: 'job-existing', issueId: 'issue-1', state: 'REVIEW', encryptedBrief: null,
    artworkUrl: 'https://blob.example/existing.png', artworkMimeType: 'image/png', artworkBytes: 1,
    width: 1024, height: 1536, provider: 'OPENAI', model: 'gpt-image-2', createdAt: new Date(), updatedAt: new Date(),
  };
  expect((await new DesignService(repository, gateway, storage).createForIssue('issue-1')).id).toBe('job-existing');
  expect(gateway.interpret).not.toHaveBeenCalled();
});

test('does not run a second model call when another worker already claimed the queued job', async () => {
  const repository = new MemoryDesignRepository();
  repository.input = await paidInput();
  repository.input.issueStatus = 'BEING_INTERPRETED';
  repository.job = {
    id: 'job-busy', issueId: 'issue-1', state: 'INTERPRETING', encryptedBrief: null,
    artworkUrl: null, artworkMimeType: null, artworkBytes: null, width: null, height: null,
    provider: null, model: null, createdAt: new Date(), updatedAt: new Date(),
  };
  const gateway = { interpret: vi.fn(), generateArtwork: vi.fn() } as unknown as DesignGateway;
  const storage = { put: vi.fn() } as unknown as ArtworkStorageGateway;
  const result = await new DesignService(repository, gateway, storage).createForIssue('issue-1');
  expect(result.id).toBe('job-busy');
  expect(gateway.interpret).not.toHaveBeenCalled();
});

test('late design worker cannot resurrect an Issue that becomes an exception during generation', async () => {
  const repository = new MemoryDesignRepository();
  repository.input = await paidInput();
  const brief = {
    concept: 'quiet orbit', motifs: ['orbit'], paletteRelation: 'light on dark',
    composition: 'asymmetric', density: 'sparse', typography: 'none', avoid: [], rationale: ['signal'],
    imagePrompt: 'abstract orbit, no text, transparent background',
  };
  const gateway: DesignGateway = {
    interpret: vi.fn(async () => brief),
    generateArtwork: vi.fn(async (_brief: Parameters<DesignGateway['generateArtwork']>[0]) => {
      if (repository.input) repository.input.issueStatus = 'EXCEPTION';
      return { bytes: Buffer.from('png-bytes'), mimeType: 'image/png' as const, width: 1024, height: 1536, provider: 'OPENAI', model: 'gpt-image-2' };
    }),
  };
  const storage: ArtworkStorageGateway = {
    put: vi.fn(async () => ({ url: 'https://blob.example/issues/issue-1/design.png', bytes: 900_000 })),
    get: vi.fn(async () => { throw new Error('not used'); }),
  };

  await expect(new DesignService(repository, gateway, storage, () => 'job-1').createForIssue('issue-1'))
    .rejects.toThrow(/no longer eligible|design completion/i);
  expect(repository.input.issueStatus).toBe('EXCEPTION');
  expect(repository.job?.state).toBe('FAILED');
});

test('regenerates artwork from the existing encrypted brief without reinterpreting answers', async () => {
  const repository = new MemoryDesignRepository();
  repository.input = await paidInput();
  repository.input.issueStatus = 'BEING_INTERPRETED';
  const brief = {
    concept: 'quiet orbit', motifs: ['orbit'], paletteRelation: 'light on dark',
    composition: 'asymmetric', density: 'sparse', typography: 'none', avoid: [], rationale: ['signal'],
    imagePrompt: 'abstract orbit, no text, transparent background',
  };
  repository.job = {
    id: 'job-regen', issueId: 'issue-1', state: 'QUEUED', encryptedBrief: await encryptPrivatePayload(brief),
    artworkUrl: 'https://blob.example/old.png', artworkMimeType: 'image/png', artworkBytes: 900_000,
    width: 1024, height: 1536, provider: 'OPENAI', model: 'gpt-image-2', createdAt: new Date(), updatedAt: new Date(),
  };
  const gateway: DesignGateway = {
    interpret: vi.fn(),
    generateArtwork: vi.fn(async (received: Parameters<DesignGateway['generateArtwork']>[0]) => {
      expect(received.concept).toBe('quiet orbit');
      return { bytes: Buffer.from('new-png'), mimeType: 'image/png' as const, width: 1024, height: 1536, provider: 'OPENAI', model: 'gpt-image-2' };
    }),
  };
  const storage: ArtworkStorageGateway = {
    put: vi.fn(async () => ({ url: 'https://blob.example/new.png', bytes: 910_000 })),
    get: vi.fn(async () => { throw new Error('not used'); }),
  };

  const result = await new DesignService(repository, gateway, storage).regenerateArtwork('issue-1');
  expect(result.state).toBe('REVIEW');
  expect(result.artworkUrl).toBe('https://blob.example/new.png');
  expect(gateway.interpret).not.toHaveBeenCalled();
  expect(gateway.generateArtwork).toHaveBeenCalledTimes(1);
});
