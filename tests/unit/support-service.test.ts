import { beforeAll, expect, test, vi } from 'vitest';
import { decryptPrivatePayload, encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { hashSessionToken } from '@/server/http/sessionToken';
import { SupportService } from '@/server/support/SupportService';
import type { SupportContext, SupportRepository, SupportRequestRecord } from '@/server/support/SupportRepository';
import type { SupportEmailGateway } from '@/server/support/SupportEmailGateway';

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
});

class MemoryRepository implements SupportRepository {
  request: SupportRequestRecord | null = null;
  constructor(private readonly context: SupportContext | null) {}
  async findContextBySessionHash(hash: string) { return hash === hashSessionToken('session') ? this.context : null; }
  async create(record: SupportRequestRecord) { this.request = record; }
}

test('stores support message encrypted and sends support only issue code plus verified reply address', async () => {
  const repository = new MemoryRepository({
    issueId: 'issue-1', issueCode: 'IO-ABCD-EFGH', contactId: 'contact-1',
    encryptedEmail: await encryptPrivatePayload({ email: 'sam@example.com' }),
  });
  const email: SupportEmailGateway = {
    send: vi.fn(async (input) => {
      expect(input.issueCode).toBe('IO-ABCD-EFGH');
      expect(input.replyTo).toBe('sam@example.com');
      expect(input.message).toBe('The package arrived damaged.');
      return { providerMessageId: 'support-mail-1' };
    }),
  };
  const service = new SupportService(repository, email, () => 'request-1', () => new Date('2026-08-19T05:00:00Z'));
  await service.create({ sessionToken: 'session', message: 'The package arrived damaged.' });

  expect(JSON.stringify(repository.request)).not.toContain('package arrived damaged');
  expect(await decryptPrivatePayload(repository.request!.encryptedMessage)).toEqual({ message: 'The package arrived damaged.' });
});

test('cannot create support request without an Issue linked to the current session', async () => {
  const service = new SupportService(new MemoryRepository(null), { send: vi.fn() } as unknown as SupportEmailGateway);
  await expect(service.create({ sessionToken: 'session', message: 'help' })).rejects.toThrow(/issue/i);
});
