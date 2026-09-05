import { describe, expect, test, vi } from 'vitest';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';

describe('experience session rotation repository contract', () => {
  test('atomically replaces the public session hash for an existing experience even after interview expiry', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'exp-access-1' }]);
    const repository = new PostgresExperienceRepository({ query });
    const updatedAt = new Date('2026-08-31T16:00:00.000Z');

    const rotated = await repository.rotateSessionHash({
      experienceId: 'exp-access-1',
      publicSessionHash: 'new-session-hash',
      updatedAt,
    });

    expect(rotated).toBe(true);
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('UPDATE experiences');
    expect(sql).toContain('public_session_hash');
    expect(sql).not.toContain('expires_at > NOW()');
    expect(sql).toContain('RETURNING id');
    expect(params).toEqual(['exp-access-1', 'new-session-hash', updatedAt]);
  });

  test('returns false when the experience no longer exists', async () => {
    const repository = new PostgresExperienceRepository({ query: vi.fn().mockResolvedValue([]) });

    await expect(repository.rotateSessionHash({
      experienceId: 'missing-experience',
      publicSessionHash: 'new-session-hash',
      updatedAt: new Date('2026-08-31T16:00:00.000Z'),
    })).resolves.toBe(false);
  });

  test('compare-and-swap rotation requires the expected current public session hash', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'exp-access-1' }]);
    const repository = new PostgresExperienceRepository({ query });
    const updatedAt = new Date('2026-08-31T16:00:00.000Z');

    const rotated = await repository.rotateSessionHashIfCurrent({
      experienceId: 'exp-access-1',
      expectedPublicSessionHash: 'expected-old-session-hash',
      publicSessionHash: 'new-session-hash',
      updatedAt,
    });

    expect(rotated).toBe(true);
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('UPDATE experiences');
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\$1\s+AND\s+public_session_hash\s*=\s*\$2/i);
    expect(sql).toContain('RETURNING id');
    expect(params).toEqual([
      'exp-access-1',
      'expected-old-session-hash',
      'new-session-hash',
      updatedAt,
    ]);
  });
});
