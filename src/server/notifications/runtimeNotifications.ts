import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { CustomerNotificationService } from './CustomerNotificationService';
import { PostgresNotificationRepository } from './PostgresNotificationRepository';
import { ResendCustomerEmailGateway } from './ResendCustomerEmailGateway';

export class NotificationRuntimeUnavailableError extends Error {
  constructor(message = 'Customer notification runtime is not configured') {
    super(message);
    this.name = 'NotificationRuntimeUnavailableError';
  }
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new NotificationRuntimeUnavailableError(`${name} is required`);
  return value;
}

export function createCustomerNotificationService(): CustomerNotificationService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new CustomerNotificationService(
    new PostgresNotificationRepository(sql),
    new ResendCustomerEmailGateway({
      apiKey: env('RESEND_API_KEY'),
      from: env('RESEND_FROM_EMAIL'),
      replyTo: process.env.SUPPORT_REPLY_TO?.trim() || undefined,
    }),
  );
}
