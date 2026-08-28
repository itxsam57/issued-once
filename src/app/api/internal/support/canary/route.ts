import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireInternalAuthorization } from '@/server/http/internalAuth';
import { ResendSupportEmailGateway } from '@/server/support/ResendSupportEmailGateway';

const schema = z.object({ confirmation: z.literal('SEND_SUPPORT_CANARY') }).strict();

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertRealSupportInbox(value: string) {
  const normalized = value.toLowerCase();
  if (
    normalized.endsWith('@example.com') ||
    normalized.endsWith('@example.org') ||
    normalized.endsWith('@example.net') ||
    normalized.endsWith('@localhost') ||
    normalized.endsWith('.invalid')
  ) {
    throw new Error('SUPPORT_INBOX_EMAIL must be a real inbox');
  }
}

export async function POST(request: Request) {
  try {
    requireInternalAuthorization(request.headers);
  } catch {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid support canary confirmation.' }, { status: 400 });
  }

  try {
    const supportInbox = env('SUPPORT_INBOX_EMAIL');
    assertRealSupportInbox(supportInbox);

    const gateway = new ResendSupportEmailGateway({
      apiKey: env('RESEND_API_KEY'),
      from: env('RESEND_FROM_EMAIL'),
      supportInbox,
    });

    await gateway.send({
      issueCode: 'SUPPORT-CANARY',
      replyTo: supportInbox,
      message: 'ISSUED ONCE live support delivery canary',
      idempotencyKey: `issued-once/support-canary/${randomUUID()}`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('support canary dispatch failed', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'Support canary dispatch failed.' }, { status: 503 });
  }
}
