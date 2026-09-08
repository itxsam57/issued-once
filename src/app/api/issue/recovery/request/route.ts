import { z } from 'zod';
import { clientIpRiskKey } from '@/server/http/clientIpRiskKey';
import {
  createIssueRecoveryService,
  IssueRecoveryRuntimeUnavailableError,
} from '@/server/issues/runtimeIssueRecovery';

const schema = z.object({
  issueCode: z.string().trim().min(1).max(32),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Enter your Issue Code and email' }, { status: 400 });
  }

  try {
    return Response.json(await createIssueRecoveryService().requestOtp({
      issueCode: parsed.data.issueCode,
      email: parsed.data.email,
      ipKey: clientIpRiskKey(request.headers),
    }));
  } catch (error) {
    if (error instanceof IssueRecoveryRuntimeUnavailableError) {
      return Response.json({ error: 'Issue recovery is unavailable' }, { status: 503 });
    }
    console.error('issue recovery request failed');
    return Response.json({ error: 'Issue recovery could not be started' }, { status: 500 });
  }
}
