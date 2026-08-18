import { randomUUID } from 'node:crypto';
import { decryptPrivatePayload, encryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { ArtworkStorageGateway } from './ArtworkStorageGateway';
import type { DesignGateway } from './DesignGateway';
import type { DesignJobRecord, DesignRepository } from './DesignRepository';

export class DesignService {
  constructor(
    private readonly repository: DesignRepository,
    private readonly gateway: DesignGateway,
    private readonly storage: ArtworkStorageGateway,
    private readonly idGenerator: () => string = () => randomUUID(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createForIssue(issueId: string): Promise<DesignJobRecord> {
    let job = await this.repository.findByIssueId(issueId);
    const input = await this.repository.loadInput(issueId);
    if (!input) throw new Error('Design input is unavailable');

    if (!job) {
      if (input.issueStatus !== 'RECEIVED') throw new Error('Issue is not eligible for design');
      if (input.questions.length !== 7) throw new Error('Design input requires seven answered questions');
      const now = this.now();
      const reservation = await this.repository.begin({
        id: this.idGenerator(), issueId, state: 'QUEUED', encryptedBrief: null,
        artworkUrl: null, artworkMimeType: null, artworkBytes: null,
        width: null, height: null, provider: null, model: null, createdAt: now, updatedAt: now,
      });
      job = reservation.job;
    }

    if (job.state === 'REVIEW' || job.state === 'APPROVED') return job;
    if (job.state === 'INTERPRETING' || job.state === 'GENERATING') return job;
    if (job.state !== 'QUEUED' && job.state !== 'FAILED') throw new Error('Design job is not claimable');

    const claimed = await this.repository.claim(job.id, this.now());
    if (!claimed) return (await this.repository.findByIssueId(issueId)) ?? job;

    try {
      if (input.questions.length !== 7) throw new Error('Design input requires seven answered questions');
      const questions = await Promise.all(input.questions.map(async (question) => {
        const payload = await decryptPrivatePayload<{ answer: string }>(question.encryptedAnswer);
        return {
          questionId: question.questionId,
          questionVersion: question.questionVersion,
          family: question.family,
          prompt: question.prompt,
          answer: payload.answer,
        };
      }));
      const brief = await this.gateway.interpret({
        issueCode: input.issueCode,
        objectType: input.objectType,
        sizeCode: input.sizeCode,
        colorCode: input.colorCode,
        questions,
      });
      const artwork = await this.gateway.generateArtwork(brief);
      const stored = await this.storage.put({
        issueId,
        designJobId: job.id,
        bytes: artwork.bytes,
        mimeType: artwork.mimeType,
      });
      return await this.repository.saveGenerated({
        jobId: job.id,
        encryptedBrief: await encryptPrivatePayload(brief),
        artworkUrl: stored.url,
        artworkMimeType: artwork.mimeType,
        artworkBytes: stored.bytes,
        width: artwork.width,
        height: artwork.height,
        provider: artwork.provider,
        model: artwork.model,
        updatedAt: this.now(),
      });
    } catch (error) {
      await this.repository.markFailed(job.id, error instanceof Error ? error.name : 'DESIGN_FAILURE', this.now());
      throw error;
    }
  }
}
