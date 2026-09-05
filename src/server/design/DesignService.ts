import { randomUUID } from 'node:crypto';
import { decryptPrivatePayload, encryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { ArtworkStorageGateway } from './ArtworkStorageGateway';
import { ArtworkQualityGate } from './ArtworkQualityGate';
import type { ArtworkPrintTemplateResolver } from './ArtworkQualityGate';
import type { DesignGateway, StructuredDesignBrief } from './DesignGateway';
import type { DesignJobRecord, DesignRepository } from './DesignRepository';

function normalizeOwnerFeedback(value?: string): string | undefined {
  const feedback = value?.trim();
  if (!feedback) return undefined;
  if (feedback.length > 500) throw new Error('Owner design feedback is too long');
  return feedback;
}

export class DesignService {
  constructor(
    private readonly repository: DesignRepository,
    private readonly gateway: DesignGateway,
    private readonly storage: ArtworkStorageGateway,
    private readonly idGenerator: () => string = () => randomUUID(),
    private readonly now: () => Date = () => new Date(),
    private readonly qualityGate: ArtworkQualityGate = new ArtworkQualityGate(),
    private readonly printTemplateResolver?: ArtworkPrintTemplateResolver,
  ) {}

  async createForIssue(issueId: string, ownerFeedback?: string): Promise<DesignJobRecord> {
    const feedback = normalizeOwnerFeedback(ownerFeedback);
    let job = await this.repository.findByIssueId(issueId);
    let input = await this.repository.loadInput(issueId);
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
      input = (await this.repository.loadInput(issueId)) ?? input;
    }

    if (job.state === 'REVIEW' || job.state === 'APPROVED') return job;
    if (job.state === 'INTERPRETING' || job.state === 'GENERATING') return job;
    if (job.state !== 'QUEUED' && job.state !== 'FAILED') throw new Error('Design job is not claimable');
    if (input.issueStatus !== 'BEING_INTERPRETED') {
      throw new Error('Issue is no longer eligible for design work');
    }

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
        ...(feedback ? { ownerFeedback: feedback } : {}),
      });
      const artwork = await this.gateway.generateArtwork(brief, { objectType: input.objectType });
      const completionInput = await this.repository.loadInput(issueId);
      if (!completionInput || completionInput.issueStatus !== 'BEING_INTERPRETED') {
        throw new Error('Issue is no longer eligible for design completion');
      }
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

  async regenerateArtwork(issueId: string, ownerFeedback?: string): Promise<DesignJobRecord> {
    const feedback = normalizeOwnerFeedback(ownerFeedback);
    const [input, initialJob] = await Promise.all([
      this.repository.loadInput(issueId),
      this.repository.findByIssueId(issueId),
    ]);
    if (!input || !initialJob) throw new Error('Design regeneration is unavailable');
    if (initialJob.state === 'REVIEW' || initialJob.state === 'APPROVED') return initialJob;
    if (initialJob.state === 'INTERPRETING' || initialJob.state === 'GENERATING') return initialJob;
    if (!initialJob.encryptedBrief) throw new Error('Existing private design brief is required for regeneration');
    if (!['QUEUED', 'FAILED'].includes(initialJob.state) || input.issueStatus !== 'BEING_INTERPRETED') {
      throw new Error('Issue is not eligible for artwork regeneration');
    }

    const claimed = await this.repository.claim(initialJob.id, this.now());
    if (!claimed) return (await this.repository.findByIssueId(issueId)) ?? initialJob;

    try {
      const brief = await decryptPrivatePayload<StructuredDesignBrief>(initialJob.encryptedBrief);
      const artwork = await this.gateway.generateArtwork(brief, {
        objectType: input.objectType,
        ...(feedback ? { ownerFeedback: feedback } : {}),
      });
      const completionInput = await this.repository.loadInput(issueId);
      if (!completionInput || completionInput.issueStatus !== 'BEING_INTERPRETED') {
        throw new Error('Issue is no longer eligible for design completion');
      }
      const stored = await this.storage.put({
        issueId,
        designJobId: initialJob.id,
        bytes: artwork.bytes,
        mimeType: artwork.mimeType,
      });
      return await this.repository.saveGenerated({
        jobId: initialJob.id,
        encryptedBrief: initialJob.encryptedBrief,
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
      await this.repository.markFailed(initialJob.id, error instanceof Error ? error.name : 'DESIGN_REGENERATION_FAILURE', this.now());
      throw error;
    }
  }

  async approveForManufacturing(issueId: string): Promise<DesignJobRecord> {
    const [input, job] = await Promise.all([
      this.repository.loadInput(issueId),
      this.repository.findByIssueId(issueId),
    ]);
    if (!input || !job) throw new Error('Design review is unavailable');
    if (job.state === 'APPROVED') return job;
    if (input.issueStatus !== 'DESIGN_REVIEW') throw new Error('Issue is not waiting for design approval');
    if (!this.printTemplateResolver) throw new Error('Print template resolver is unavailable for design approval');
    if (!job.artworkUrl) throw new Error('Artwork is unavailable');

    const stored = await this.storage.get(job.artworkUrl);
    if (
      stored.mimeType !== job.artworkMimeType
      || !job.artworkBytes
      || stored.bytes.length !== job.artworkBytes
    ) {
      throw new Error('Artwork integrity metadata does not match the durable object');
    }

    const template = this.printTemplateResolver.resolve({
      objectType: input.objectType,
      sizeCode: input.sizeCode,
      colorCode: input.colorCode,
    });
    const quality = this.qualityGate.validate({
      issueId,
      designJobId: job.id,
      objectType: input.objectType,
      sizeCode: input.sizeCode,
      colorCode: input.colorCode,
      state: job.state,
      artworkUrl: job.artworkUrl,
      artworkMimeType: job.artworkMimeType,
      artworkBytes: job.artworkBytes,
      width: job.width,
      height: job.height,
    }, template);
    return this.repository.approve(job.id, quality.checks, this.now());
  }
}
