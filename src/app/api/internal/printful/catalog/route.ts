import {
  InternalOperationsUnauthorizedError,
  requireInternalAuthorization,
} from '@/server/http/internalAuth';
import { createPrintfulCatalogInspector } from '@/server/manufacturing/runtimePrintfulCatalogInspector';

export async function GET(request: Request) {
  try {
    requireInternalAuthorization(request.headers);
  } catch (error) {
    if (error instanceof InternalOperationsUnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.json({ error: 'Internal operation unavailable' }, { status: 503 });
  }

  try {
    const result = await createPrintfulCatalogInspector().inspectIssuedOnce();
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch {
    console.error('printful catalog inspection failed');
    return Response.json({ error: 'Printful catalog inspection unavailable' }, { status: 503 });
  }
}
