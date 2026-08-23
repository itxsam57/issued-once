import { describe, expect, test, vi } from 'vitest';
import { PostgresCheckoutStateRepository } from '@/server/checkout/PostgresCheckoutStateRepository';

describe('PostgresCheckoutStateRepository', () => {
  test('advances COMMITMENT_READY to CHECKOUT_STARTED with one guarded durable update', async () => {
    const sql = { query: vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]) };
    const repository = new PostgresCheckoutStateRepository(sql);
    const updatedAt = new Date('2026-08-18T06:25:00.000Z');

    await repository.advance({
      experienceId: 'exp-1',
      expectedStage: 'COMMITMENT_READY',
      nextStage: 'CHECKOUT_STARTED',
      updatedAt,
    });

    const [statement, params] = sql.query.mock.calls[0] ?? [];
    expect(String(statement)).toContain('UPDATE experiences');
    expect(String(statement)).toContain('stage = $3');
    expect(String(statement)).toContain('expires_at');
    expect(params).toEqual([
      'exp-1',
      'COMMITMENT_READY',
      'CHECKOUT_STARTED',
      updatedAt,
    ]);
  });

  test('rejects stale, repeated or expired checkout transitions', async () => {
    const repository = new PostgresCheckoutStateRepository({
      query: vi.fn().mockResolvedValue([]),
    });

    await expect(repository.advance({
      experienceId: 'exp-1',
      expectedStage: 'COMMITMENT_READY',
      nextStage: 'CHECKOUT_STARTED',
      updatedAt: new Date(),
    })).rejects.toThrow('Checkout state conflict');
  });
});
