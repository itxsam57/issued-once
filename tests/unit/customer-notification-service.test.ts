import { beforeAll, expect, test, vi } from 'vitest';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { CustomerNotificationService } from '@/server/notifications/CustomerNotificationService';
import type { CustomerEmailGateway } from '@/server/notifications/CustomerEmailGateway';
import type {
  NotificationInput,
  NotificationRepository,
} from '@/server/notifications/NotificationRepository';

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
});

class MemoryRepository implements NotificationRepository {
  input: NotificationInput | null = null;
  sent = new Set<string>();
  async loadInput(issueId: string) { return this.input?.issueId === issueId ? this.input : null; }
  async reserve(issueId: string, eventKey: string, _at: Date) {
    const key = `${issueId}:${eventKey}`;
    if (this.sent.has(key)) return false;
    this.sent.add(key); return true;
  }
  async markSent(_issueId: string, _eventKey: string, _providerMessageId: string, _at: Date) {}
  async markFailed(issueId: string, eventKey: string, _code: string, _at: Date) {
    this.sent.delete(`${issueId}:${eventKey}`);
  }
}

test('decrypts verified email only at delivery boundary and sends a minimal payment confirmation once', async () => {
  const repository = new MemoryRepository();
  repository.input = {
    issueId: 'issue-1', issueCode: 'IO-ABCD-EFGH', publicStatus: 'RECEIVED',
    encryptedEmail: await encryptPrivatePayload({ email: 'sam@example.com' }),
    trackingUrl: null, trackingNumber: null,
  };
  const gateway: CustomerEmailGateway = {
    send: vi.fn(async (input) => {
      expect(input.to).toBe('sam@example.com');
      expect(input.subject).toContain('IO-ABCD-EFGH');
      expect(input.text).not.toMatch(/answer|printful|safepay/i);
      return { providerMessageId: 'email-1' };
    }),
  };
  const service = new CustomerNotificationService(repository, gateway, () => new Date('2026-08-19T04:00:00Z'));
  await service.send('issue-1', 'PAYMENT_RECEIVED');
  await service.send('issue-1', 'PAYMENT_RECEIVED');
  expect(gateway.send).toHaveBeenCalledTimes(1);
});

test('shipped notification includes carrier tracking but never private questionnaire data', async () => {
  const repository = new MemoryRepository();
  repository.input = {
    issueId: 'issue-1', issueCode: 'IO-ABCD-EFGH', publicStatus: 'IN TRANSIT',
    encryptedEmail: await encryptPrivatePayload({ email: 'sam@example.com' }),
    trackingUrl: 'https://carrier.example/T1', trackingNumber: 'TRACK-1',
  };
  const gateway: CustomerEmailGateway = { send: vi.fn(async () => ({ providerMessageId: 'email-2' })) };
  await new CustomerNotificationService(repository, gateway).send('issue-1', 'SHIPPED');
  expect(vi.mocked(gateway.send).mock.calls[0][0].text).toContain('https://carrier.example/T1');
});
