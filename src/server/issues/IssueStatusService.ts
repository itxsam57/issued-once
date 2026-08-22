import { hashSessionToken } from '@/server/http/sessionToken';
import type { IssueStatus } from './IssueRepository';
import type { IssueStatusRepository } from './IssueStatusRepository';

function publicStatus(status: IssueStatus): string {
  switch (status) {
    case 'RECEIVED': return 'RECEIVED';
    case 'BEING_INTERPRETED':
    case 'DESIGN_REVIEW':
    case 'DESIGN_APPROVED':
    case 'MANUFACTURING_DRAFT': return 'BEING INTERPRETED';
    case 'IN_PRODUCTION': return 'IN PRODUCTION';
    case 'IN_TRANSIT': return 'IN TRANSIT';
    case 'DELIVERED': return 'DELIVERED';
    case 'EXCEPTION': return 'CHECKING SOMETHING';
    case 'CANCELED': return 'CANCELED';
  }
}

export class IssueStatusService {
  constructor(private readonly repository: IssueStatusRepository) {}

  async forSession(sessionToken: string) {
    const record = await this.repository.findBySessionHash(hashSessionToken(sessionToken));
    if (!record) return { found: false as const };
    return {
      found: true as const,
      issueCode: record.issueCode,
      status: publicStatus(record.internalStatus),
      objectType: record.objectType.toUpperCase(),
      sizeCode: record.sizeCode,
      colorCode: record.colorCode.toUpperCase(),
      trackingUrl: record.trackingUrl,
      trackingNumber: record.trackingNumber,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
