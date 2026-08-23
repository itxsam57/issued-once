import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresSupportRepository } from './PostgresSupportRepository';
import { ResendSupportEmailGateway } from './ResendSupportEmailGateway';
import { SupportService } from './SupportService';

export class SupportRuntimeUnavailableError extends Error {
  constructor(message = 'Support runtime is not configured') {
    super(message);
    this.name = 'SupportRuntimeUnavailableError';
  }
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new SupportRuntimeUnavailableError(`${name} is required`);
  return value;
}

export function createSupportService(): SupportService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new SupportService(
    new PostgresSupportRepository(sql),
    new ResendSupportEmailGateway({
      apiKey: env('RESEND_API_KEY'),
      from: env('RESEND_FROM_EMAIL'),
      supportInbox: env('SUPPORT_INBOX_EMAIL'),
    }),
  );
}
