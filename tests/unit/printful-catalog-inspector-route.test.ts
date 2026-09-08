import { beforeEach, expect, test, vi } from 'vitest';

const { inspectIssuedOnceMock, createInspectorMock } = vi.hoisted(() => ({
  inspectIssuedOnceMock: vi.fn(),
  createInspectorMock: vi.fn(),
}));

vi.mock('@/server/manufacturing/runtimePrintfulCatalogInspector', () => ({
  createPrintfulCatalogInspector: createInspectorMock,
}));

const internalToken = 'printful-catalog-inspector-token-123456';

async function loadGet() {
  const route = await import('@/app/api/internal/printful/catalog/route');
  return route.GET;
}

function request(token?: string) {
  return new Request('https://issuedonce.shop/api/internal/printful/catalog', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTERNAL_OPERATIONS_TOKEN = internalToken;
  createInspectorMock.mockReturnValue({ inspectIssuedOnce: inspectIssuedOnceMock });
  inspectIssuedOnceMock.mockResolvedValue({ products: [{ key: 'tee', product: { id: 71 } }] });
});

test('rejects unauthenticated Printful catalog inspection before provider access', async () => {
  const GET = await loadGet();
  const response = await GET(request());
  expect(response.status).toBe(401);
  expect(inspectIssuedOnceMock).not.toHaveBeenCalled();
});

test('returns non-secret read-only Printful catalog truth to an authenticated internal caller', async () => {
  const GET = await loadGet();
  const response = await GET(request(internalToken));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ products: [{ key: 'tee', product: { id: 71 } }] });
  expect(inspectIssuedOnceMock).toHaveBeenCalledOnce();
});

test('fails closed without leaking provider error details', async () => {
  inspectIssuedOnceMock.mockRejectedValueOnce(new Error('pf-secret-provider-detail'));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const GET = await loadGet();
    const response = await GET(request(internalToken));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Printful catalog inspection unavailable' });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('pf-secret-provider-detail');
  } finally {
    errorSpy.mockRestore();
  }
});
