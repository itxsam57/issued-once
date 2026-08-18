import { beforeAll, expect, test, vi } from 'vitest';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { ManufacturerGateway } from '@/server/manufacturing/ManufacturerGateway';
import type {
  ManufacturingInput,
  ManufacturingJobRecord,
  ManufacturingRepository,
} from '@/server/manufacturing/ManufacturingRepository';
import { ManufacturingService } from '@/server/manufacturing/ManufacturingService';
import { PrintfulVariantMap } from '@/server/manufacturing/PrintfulVariantMap';

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
});

class MemoryRepository implements ManufacturingRepository {
  input: ManufacturingInput | null = null;
  job: ManufacturingJobRecord | null = null;
  async loadInput(issueId: string) { return this.input?.issueId === issueId ? this.input : null; }
  async findByIssueId(issueId: string) { return this.job?.issueId === issueId ? this.job : null; }
  async reserve(job: ManufacturingJobRecord) {
    if (this.job) return { created: false, job: this.job };
    this.job = structuredClone(job); return { created: true, job: this.job };
  }
  async attachDraft(input: { jobId: string; providerOrderId: string; providerStatus: string; printfulVariantId: number; updatedAt: Date }) {
    if (!this.job || this.job.id !== input.jobId) throw new Error('missing');
    Object.assign(this.job, input, { state: 'DRAFT' as const }); return this.job;
  }
  async markConfirmed(input: { jobId: string; confirmedAt: Date }) {
    if (!this.job || this.job.id !== input.jobId) throw new Error('missing');
    this.job.state = 'IN_PRODUCTION'; this.job.confirmedAt = input.confirmedAt; this.job.updatedAt = input.confirmedAt;
    return this.job;
  }
  async markFailed(_jobId: string, _code: string, _updatedAt: Date) {}
}

async function validInput(): Promise<ManufacturingInput> {
  return {
    issueId: 'issue-1', issueCode: 'IO-ABCD-EFGH', issueStatus: 'DESIGN_APPROVED',
    designJobId: 'design-1', designState: 'APPROVED', artworkUrl: 'https://blob.example/issue.png',
    objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
    encryptedEmail: await encryptPrivatePayload({ email: 'sam@example.com' }),
    encryptedAddress: await encryptPrivatePayload({
      recipientName: 'Sam Example', line1: '1 Quiet Street', line2: '', city: 'London', region: 'London',
      postalCode: 'SW1A 1AA', countryCode: 'GB', phone: '+44 7000 000000',
    }),
  };
}

function mapping() {
  return new PrintfulVariantMap(JSON.stringify({
    'tee:M:Black': { variantId: 4012, fileType: 'front' },
  }));
}

test('creates one Printful draft with the exact approved variant, artwork and decrypted recipient only at the factory boundary', async () => {
  const repository = new MemoryRepository(); repository.input = await validInput();
  const gateway: ManufacturerGateway = {
    createDraft: vi.fn(async (input) => {
      expect(input).toMatchObject({
        externalId: 'IO-ABCD-EFGH', variantId: 4012, artworkUrl: 'https://blob.example/issue.png', fileType: 'front',
        recipient: { name: 'Sam Example', email: 'sam@example.com', address1: '1 Quiet Street', city: 'London', countryCode: 'GB' },
      });
      expect(JSON.stringify(input)).not.toContain('private answer');
      return { providerOrderId: '987654', status: 'draft' };
    }),
    confirmDraft: vi.fn(),
  };
  const service = new ManufacturingService(repository, gateway, mapping(), () => 'mfg-1', () => new Date('2026-08-19T02:00:00Z'));

  const result = await service.createDraft('issue-1');
  expect(result).toMatchObject({ id: 'mfg-1', state: 'DRAFT', providerOrderId: '987654', printfulVariantId: 4012 });
  expect(gateway.createDraft).toHaveBeenCalledTimes(1);
  expect((await service.createDraft('issue-1')).id).toBe('mfg-1');
  expect(gateway.createDraft).toHaveBeenCalledTimes(1);
});

test('refuses manufacturing without design approval or without an exact Printful variant mapping', async () => {
  const repository = new MemoryRepository();
  repository.input = { ...(await validInput()), designState: 'REVIEW', issueStatus: 'DESIGN_REVIEW' };
  const gateway = { createDraft: vi.fn(), confirmDraft: vi.fn() } as ManufacturerGateway;
  await expect(new ManufacturingService(repository, gateway, mapping()).createDraft('issue-1')).rejects.toThrow(/approved/i);

  repository.input = { ...(await validInput()), sizeCode: 'XL' };
  await expect(new ManufacturingService(repository, gateway, mapping()).createDraft('issue-1')).rejects.toThrow(/mapping/i);
  expect(gateway.createDraft).not.toHaveBeenCalled();
});

test('confirming manufacturing is a separate explicit action and reuses the existing draft', async () => {
  const repository = new MemoryRepository(); repository.input = await validInput();
  repository.job = {
    id: 'mfg-1', issueId: 'issue-1', designJobId: 'design-1', state: 'DRAFT', provider: 'PRINTFUL',
    providerOrderId: '987654', providerStatus: 'draft', printfulVariantId: 4012,
    artworkUrl: 'https://blob.example/issue.png', createdAt: new Date(), updatedAt: new Date(), confirmedAt: null,
  };
  const gateway: ManufacturerGateway = { createDraft: vi.fn(), confirmDraft: vi.fn(async () => undefined) };
  const result = await new ManufacturingService(repository, gateway, mapping(), undefined, () => new Date('2026-08-19T02:05:00Z')).confirmDraft('issue-1');
  expect(gateway.confirmDraft).toHaveBeenCalledWith('987654');
  expect(result.state).toBe('IN_PRODUCTION');
});
