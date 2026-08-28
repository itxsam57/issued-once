import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { ResendCustomerEmailGateway } from '@/server/notifications/ResendCustomerEmailGateway';
import { PostgresReferralLaunchOutreachRepository } from './PostgresReferralLaunchOutreachRepository';
import { ReferralLaunchOutreachService } from './ReferralLaunchOutreachService';

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createReferralLaunchOutreachService() {
  const executor = createNeonSqlExecutor(env('DATABASE_URL'));
  return new ReferralLaunchOutreachService({
    repository: new PostgresReferralLaunchOutreachRepository(executor),
    gateway: new ResendCustomerEmailGateway({
      apiKey: env('RESEND_API_KEY'),
      from: env('RESEND_FROM_EMAIL'),
      ...(process.env.SUPPORT_REPLY_TO?.trim() ? { replyTo: process.env.SUPPORT_REPLY_TO.trim() } : {}),
    }),
    appOrigin: env('APP_ORIGIN'),
  });
}
