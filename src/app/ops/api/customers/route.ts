import { emailLookupHash } from '@/server/contact/ContactService';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsCustomerRepository } from '@/server/ops/runtimeOwnerOs';

export async function GET(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email')?.trim() || null;
    const cursor = url.searchParams.get('cursor')?.trim() || null;
    const result = await createOpsCustomerRepository().listCustomers({
      limit: 50,
      cursor,
      emailHash: email ? emailLookupHash(email) : null,
    });
    return Response.json({
      items: result.items.map((item) => ({
        contactAlias: item.contactAlias,
        issueCount: item.issueCount,
        paidMinor: item.paidMinor,
        refundedIssues: item.refundedIssues,
        activeDeliveries: item.activeDeliveries,
        supportCount: item.supportCount,
        lastSeenAt: item.lastSeenAt.toISOString(),
      })),
      nextCursor: result.nextCursor,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner customer list failed', error);
    return Response.json({ error: 'Customers unavailable' }, { status: 503 });
  }
}
