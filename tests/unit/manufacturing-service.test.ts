import { beforeAll, expect, test, vi } from 'vitest';
import type { ArtworkAccessGateway } from '@/server/design/VercelBlobArtworkAccess';
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

const canonicalArtwork = 'https://store.private.blob.vercel-storage.com/issues/issue-1/design/design-1.png';
const signedArtwork = `${canonicalArtwork}?signed=factory`;
const artworkAccess: ArtworkAccessGateway = {
  createReadUrl: vi.fn(async (url, ttlMs) => {
    expect(url).toBe(canonicalArtwork);
    expect(ttlMs).toBe(6 * 24 * 60 * 60 * 1000);
    return signedArtwork;
  }),
};

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
  async markFailed(jobId: string, _code: string, updatedAt: Date) {
    if (this.job?.id === jobId) { this.job.state = 'FAILED'; this.job.updatedAt = updatedAt; }
  }
}

async function validInput(): Promise<ManufacturingInput> {
  return {
    issueId: 'issue-1', issueCode: 'IO-ABCD-EFGH', issueStatus: 'DESIGN_APPROVED',
    designJobId: 'design-1', designState: 'APPROVED', artworkUrl: canonicalArtwork,
    artworkWidth: 1024, artworkHeight: 1536,
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
    'tee:M:Black': {
      variantId: 4012,
      fileType: 'front',
      printArea: { width: 1800, height: 2400, dpi: 150 },
      position: { width: 900, height: 1350, top: 300, left: 450 },
    },
  }));
}

test('creates one Printful draft with temporary artwork access, sampled placement, and decrypted recipient only at factory boundary', async () => {
  const repository = new MemoryRepository(); repository.input = await validInput();
  const gateway: ManufacturerGateway = {
    createDraft: vi.fn(async (input) => {
      expect(input).toMatchObject({
        externalId: 'IO-ABCD-EFGH', variantId: 4012, artworkUrl: signedArtwork, fileType: 'front',
        placement: { areaWidth: 1800, areaHeight: 2400, width: 900, height: 1350, top: 300, left: 450 },
        recipient: { name: 'Sam Example', email: 'sam@example.com', address1: '1 Quiet Street', city: 'London', countryCode: 'GB' },
      });
      expect(JSON.stringify(input)).not.toContain('private answer');
      return { providerOrderId: '987654', status: 'draft' };
    }),
    confirmDraft: vi.fn(),
  };
  const service = new ManufacturingService(repository, gateway, mapping(), artworkAccess, () => 'mfg-1', () => new Date('2026-08-19T02:00:00Z'));

  const result = await service.createDraft('issue-1');
  expect(result).toMatchObject({ id: 'mfg-1', state: 'DRAFT', providerOrderId: '987654', printfulVariantId: 4012 });
  expect(gateway.createDraft).toHaveBeenCalledTimes(1);
  expect((await service.createDraft('issue-1')).id).toBe('mfg-1');
  expect(gateway.createDraft).toHaveBeenCalledTimes(1);
});

test('refuses manufacturing without design approval, exact mapping, or enough source pixels for the sampled placement', async () => {
  const repository = new MemoryRepository();
  repository.input = { ...(await validInput()), designState: 'REVIEW', issueStatus: 'DESIGN_REVIEW' };
  const gateway = { createDraft: vi.fn(), confirmDraft: vi.fn() } as ManufacturerGateway;
  await expect(new ManufacturingService(repository, gateway, mapping(), artworkAccess).createDraft('issue-1')).rejects.toThrow(/approved/i);

  repository.input = { ...(await validInput()), sizeCode: 'XL' };
  await expect(new ManufacturingService(repository, gateway, mapping(), artworkAccess).createDraft('issue-1')).rejects.toThrow(/mapping/i);

  repository.input = { ...(await validInput()), artworkWidth: 800 };
  await expect(new ManufacturingService(repository, gateway, mapping(), artworkAccess).createDraft('issue-1')).rejects.toThrow(/source pixels/i);
  expect(gateway.createDraft).not.toHaveBeenCalled();
});

test('retries a failed draft against the same manufacturing identity and refreshes temporary artwork access', async () => {
  const repository = new MemoryRepository(); repository.input = await validInput();
  repository.job = {
    id: 'mfg-stable', issueId: 'issue-1', designJobId: 'design-1', state: 'FAILED', provider: 'PRINTFUL',
    providerOrderId: null, providerStatus: null, printfulVariantId: null,
    artworkUrl: canonicalArtwork, createdAt: new Date(), updatedAt: new Date(), confirmedAt: null,
  };
  const gateway: ManufacturerGateway = {
    createDraft: vi.fn(async () => ({ providerOrderId: '987654', status: 'draft' })),
    confirmDraft: vi.fn(),
  };
  const result = await new ManufacturingService(repository, gateway, mapping(), artworkAccess).createDraft('issue-1');
  expect(result.id).toBe('mfg-stable');
  expect(result.state).toBe('DRAFT');
  expect(gateway.createDraft).toHaveBeenCalledTimes(1);
});

test('confirming manufacturing is a separate explicit action and reuses the existing draft', async () => {
  const repository = new MemoryRepository(); repository.input = await validInput();
  repository.job = {
    id: 'mfg-1', issueId: 'issue-1', designJobId: 'design-1', state: 'DRAFT', provider: 'PRINTFUL',
    providerOrderId: '987654', providerStatus: 'draft', printfulVariantId: 4012,
    artworkUrl: canonicalArtwork, createdAt: new Date(), updatedAt: new Date(), confirmedAt: null,
  };
  const gateway: ManufacturerGateway = { createDraft: vi.fn(), confirmDraft: vi.fn(async () => undefined) };
  const result = await new ManufacturingService(repository, gateway, mapping(), artworkAccess, undefined, () => new Date('2026-08-19T02:05:00Z')).confirmDraft('issue-1');
  expect(gateway.confirmDraft).toHaveBeenCalledWith('987654');
  expect(result.state).toBe('IN_PRODUCTION');
});
