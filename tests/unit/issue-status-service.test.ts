import { expect, test } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';
import { IssueStatusService } from '@/server/issues/IssueStatusService';
import type { CustomerIssueStatus, IssueStatusRepository } from '@/server/issues/IssueStatusRepository';

const token = 'customer-session';

class MemoryStatusRepository implements IssueStatusRepository {
  constructor(public status: CustomerIssueStatus | null) {}
  async findBySessionHash(hash: string) {
    return hash === hashSessionToken(token) ? this.status : null;
  }
  async findByIssueCode(issueCode: string) {
    return this.status?.issueCode === issueCode ? this.status : null;
  }
}

test('returns only the safe public projection for the current anonymous customer session', async () => {
  const status: CustomerIssueStatus = {
    issueCode: 'IO-ABCD-EFGH',
    internalStatus: 'IN_TRANSIT',
    objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
    trackingUrl: 'https://carrier.example/T1', trackingNumber: 'TRACK-1',
    updatedAt: new Date('2026-08-19T04:00:00Z'),
  };
  const result = await new IssueStatusService(new MemoryStatusRepository(status)).forSession(token);
  expect(result).toEqual({
    found: true,
    issueCode: 'IO-ABCD-EFGH',
    status: 'IN TRANSIT',
    objectType: 'TEE', sizeCode: 'M', colorCode: 'BLACK',
    trackingUrl: 'https://carrier.example/T1', trackingNumber: 'TRACK-1',
    updatedAt: '2026-08-19T04:00:00.000Z',
  });
  expect(JSON.stringify(result)).not.toMatch(/email|address|answer|payment|printful|safepay/i);
});

test('returns a neutral pending projection while the signed payment webhook has not minted an Issue yet', async () => {
  expect(await new IssueStatusService(new MemoryStatusRepository(null)).forSession(token)).toEqual({ found: false });
});
