import type {
  OpsAuditInput,
  OpsAuditListInput,
  OpsAuditPage,
  OpsAuditRepository,
} from './OpsAuditRepository';

const PRIVATE_KEY_PATTERN = /answer|email|phone|address|ciphertext|secret|token|apikey|supportmessage|briefplaintext/i;

function assertSafeMetadata(metadata: OpsAuditInput['safeMetadata']): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (PRIVATE_KEY_PATTERN.test(key)) throw new Error(`Private metadata key is not allowed: ${key}`);
    if (typeof value === 'string' && value.length > 500) throw new Error(`Audit metadata value is too large: ${key}`);
  }
}
function assertText(value: string, label: string, max: number): void {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`Invalid ${label}`);
}
function optionalText(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error('Invalid audit filter');
  return trimmed;
}

export class OpsAuditService {
  constructor(private readonly repository: OpsAuditRepository) {}

  async record(input: OpsAuditInput): Promise<void> {
    if (input.actor !== 'OWNER') throw new Error('Invalid audit actor');
    assertText(input.action, 'audit action', 120);
    assertText(input.targetType, 'audit target type', 80);
    assertText(input.targetId, 'audit target id', 200);
    if (input.reason !== null && input.reason.length > 500) throw new Error('Invalid audit reason');
    assertSafeMetadata(input.safeMetadata);
    await this.repository.append({
      ...input,
      action: input.action.trim(), targetType: input.targetType.trim(), targetId: input.targetId.trim(), reason: input.reason?.trim() || null,
    });
  }

  async listRecent(input: Omit<OpsAuditListInput, 'limit'> & { limit?: number } = {}): Promise<OpsAuditPage> {
    if (input.from && input.to && input.from.getTime() > input.to.getTime()) throw new Error('Invalid audit date range');
    return this.repository.listRecent({
      cursor: input.cursor ?? null,
      limit: Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100),
      action: optionalText(input.action, 120),
      issueCode: optionalText(input.issueCode, 100),
      target: optionalText(input.target, 200),
      from: input.from ?? null,
      to: input.to ?? null,
    });
  }
}
