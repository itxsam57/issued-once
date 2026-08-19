import { beforeAll, expect, test, vi } from 'vitest';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { DesignService } from '@/server/design/DesignService';
import type { ArtworkStorageGateway } from '@/server/design/ArtworkStorageGateway';
import type { DesignGateway } from '@/server/design/DesignGateway';
import type { DesignInput, DesignJobRecord, DesignRepository } from '@/server/design/DesignRepository';

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString('base64');
});

async function refundedInput(): Promise<DesignInput> {
  return {
    issueId: 'issue-1', issueCode: 'IO-ABCD-EFGH', issueStatus: 'EXCEPTION',
    objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
    questions: await Promise.all(Array.from({ length: 7 }, async (_, index) => ({
      slot: `q${index + 1}` as DesignInput['questions'][number]['slot'],
      questionId: `q-${index + 1}`, questionVersion: 1, family: 'test', prompt: `Prompt ${index + 1}`,
      encryptedAnswer: await encryptPrivatePayload({ answer: `answer ${index + 1}` }),
    }))),
  };
}

class RefundedDesignRepository implements DesignRepository {
  job: DesignJobRecord = {
    id: 'job-1', issueId: 'issue-1', state: 'QUEUED', encryptedBrief: null,
    artworkUrl: null, artworkMimeType: null, artworkBytes: null, width: null, height: null,
    provider: null, model: null, createdAt: new Date(), updatedAt: new Date(),
  };
  input!: DesignInput;
  async loadInput() { return this.input; }
  async findByIssueId() { return this.job; }
  async begin(record: DesignJobRecord) { return { created: false, job: record }; }
  async claim() { this.job.state = 'INTERPRETING'; return true; }
  saveGenerated: DesignRepository['saveGenerated'] = async () => { throw new Error('must never save'); };
  approve: DesignRepository['approve'] = async () => { throw new Error('must never approve'); };
  async markFailed() { this.job.state = 'FAILED'; }
}

test('queued design job is not claimed after payment quarantine changed the Issue to EXCEPTION', async () => {
  const repository = new RefundedDesignRepository();
  repository.input = await refundedInput();
  const gateway: DesignGateway = { interpret: vi.fn(), generateArtwork: vi.fn() } as never;
  const storage: ArtworkStorageGateway = { put: vi.fn() } as never;

  await expect(new DesignService(repository, gateway, storage).createForIssue('issue-1'))
    .rejects.toThrow(/eligible|exception|issue state/i);
  expect(gateway.interpret).not.toHaveBeenCalled();
  expect(gateway.generateArtwork).not.toHaveBeenCalled();
});
