import { describe, expect, test, vi } from 'vitest';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';

describe('experience session rotation repository contract', () => {
  test('atomically replaces the public session hash only for a live experience', async () => {
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
    expect(sql).toContain('expires_at > NOW()');
    expect(sql).toContain('RETURNING id');
    expect(params).toEqual(['exp-access-1', 'new-session-hash', updatedAt]);
  });

  test('returns false when the experience is missing or expired', async () => {
    const repository = new PostgresExperienceRepository({ query: vi.fn().mockResolvedValue([]) });

    await expect(repository.rotateSessionHash({
      experienceId: 'expired-experience',
      publicSessionHash: 'new-session-hash',
      updatedAt: new Date('2026-08-31T16:00:00.000Z'),
    })).resolves.toBe(false);
  });
});
