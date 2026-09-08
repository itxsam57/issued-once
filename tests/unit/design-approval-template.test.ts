import { expect, test, vi } from 'vitest';
import type { ArtworkStorageGateway } from '@/server/design/ArtworkStorageGateway';
import type { ArtworkPrintTemplateResolver } from '@/server/design/ArtworkQualityGate';
import type { DesignGateway } from '@/server/design/DesignGateway';
import type { DesignInput, DesignJobRecord, DesignRepository } from '@/server/design/DesignRepository';
import { DesignService } from '@/server/design/DesignService';

const input: DesignInput = {
  issueId: 'issue-1',
  issueCode: 'IO-TEST',
  issueStatus: 'DESIGN_REVIEW',
  objectType: 'tee',
  sizeCode: 'M',
  colorCode: 'Black',
  questions: [],
};

const job: DesignJobRecord = {
  id: 'job-1',
  issueId: 'issue-1',
  state: 'REVIEW',
  encryptedBrief: null,
  artworkUrl: 'artwork://issue-1/job-1',
  artworkMimeType: 'image/png',
  artworkBytes: 800_000,
  width: 1024,
  height: 1536,
  provider: 'OPENAI',
  model: 'gpt-image-1.5',
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
};

function repositoryForApproval() {
  const approve = vi.fn(async (_jobId: string, _checks: readonly string[], approvedAt: Date) => ({
    ...job,
    state: 'APPROVED' as const,
    updatedAt: approvedAt,
  }));
  const repository: DesignRepository = {
    loadInput: vi.fn(async () => input),
    findByIssueId: vi.fn(async () => job),
    begin: vi.fn(async () => { throw new Error('not used'); }),
    claim: vi.fn(async () => false),
    saveGenerated: vi.fn(async () => { throw new Error('not used'); }),
    approve,
    markFailed: vi.fn(async () => undefined),
  };
  return { repository, approve };
}

const gateway = {} as DesignGateway;
const storage = {
  put: vi.fn(async () => { throw new Error('not used'); }),
  get: vi.fn(async () => ({ bytes: Buffer.alloc(800_000, 7), mimeType: 'image/png' as const })),
} as unknown as ArtworkStorageGateway;

test('manufacturing approval reopens durable bytes, resolves the exact physical selection and persists template/DPI audit checks', async () => {
  const { repository, approve } = repositoryForApproval();
  const resolver: ArtworkPrintTemplateResolver = {
    resolve: vi.fn(() => ({
      objectType: 'tee',
      sizeCode: 'M',
      colorCode: 'Black',
      placementWidth: 900,
      placementHeight: 1350,
      targetDpi: 150,
    })),
  };
  const service = new DesignService(repository, gateway, storage, undefined, undefined, undefined, resolver);

  await expect(service.approveForManufacturing('issue-1')).resolves.toMatchObject({ state: 'APPROVED' });
  expect(storage.get).toHaveBeenCalledWith(job.artworkUrl);
  expect(resolver.resolve).toHaveBeenCalledWith({ objectType: 'tee', sizeCode: 'M', colorCode: 'Black' });
  const checks = approve.mock.calls[0]?.[1] ?? [];
  expect(checks).toContain('template:tee:M:Black');
  expect(checks.some((check) => check.startsWith('effective-dpi:'))).toBe(true);
});

test('manufacturing approval fails closed when the resolved template is not the selected physical variant', async () => {
  const { repository, approve } = repositoryForApproval();
  const resolver: ArtworkPrintTemplateResolver = {
    resolve: () => ({
      objectType: 'tote',
      sizeCode: 'OS',
      colorCode: 'Black',
      placementWidth: 900,
      placementHeight: 1350,
      targetDpi: 150,
    }),
  };
  const service = new DesignService(repository, gateway, storage, undefined, undefined, undefined, resolver);

  await expect(service.approveForManufacturing('issue-1')).rejects.toThrow(/template|selection|mapping/i);
  expect(approve).not.toHaveBeenCalled();
});
