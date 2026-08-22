import { expect, test } from 'vitest';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import { PostgresPaymentRepository } from '@/server/payments/PostgresPaymentRepository';

function postgresLikeExecutor(): SqlExecutor {
  return {
    async query<Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) {
      for (let index = 0; index < params.length; index += 1) {
        const placeholder = `$${index + 1}`;
        if (!text.includes(placeholder)) {
          throw new Error(`could not determine data type of parameter ${placeholder}`);
        }
      }
      return [{ outcome: 'paid' }] as unknown as Row[];
    },
  };
}

test('markPaid uses contiguous PostgreSQL parameters so the paid transition can execute', async () => {
  const repository = new PostgresPaymentRepository(postgresLikeExecutor());

  await expect(repository.markPaid({
    attemptId: '11111111-1111-4111-8111-111111111111',
    providerEventId: 'reporter:track_example',
    amountMinor: 3200,
    currency: 'USD',
    paidAt: new Date('2026-08-22T18:55:27.020Z'),
  })).resolves.toBe('paid');
});
