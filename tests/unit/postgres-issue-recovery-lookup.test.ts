import { describe, expect, test, vi } from 'vitest';
import { PostgresIssueStatusRepository } from '@/server/issues/PostgresIssueStatusRepository';

describe('Postgres Issue recovery lookup', () => {
  test('resolves Issue Code to the private experience id and keyed verified-email hash', async () => {
    const emailHash = 'a'.repeat(64);
    const query = vi.fn().mockResolvedValue([{
      experience_id: 'exp-recover-1',
      email_hash: emailHash,
    }]);
    const repository = new PostgresIssueStatusRepository({ query });

    expect(typeof repository.findRecoveryTargetByIssueCode).toBe('function');
    const result = await repository.findRecoveryTargetByIssueCode('IO-ABCD-EFGH');

    expect(result).toEqual({
      experienceId: 'exp-recover-1',
      emailHash,
    });
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('FROM issues');
    expect(sql).toContain('verified_contacts');
    expect(sql).toContain('experience_id');
    expect(sql).toContain('email_hash');
    expect(sql).toContain('issue_code');
    expect(params).toEqual(['IO-ABCD-EFGH']);
  });

  test('returns null without exposing whether the Issue or verified contact was missing', async () => {
    const repository = new PostgresIssueStatusRepository({
      query: vi.fn().mockResolvedValue([]),
    });

    expect(typeof repository.findRecoveryTargetByIssueCode).toBe('function');
    await expect(repository.findRecoveryTargetByIssueCode('IO-MISS-ING1')).resolves.toBeNull();
  });
});
