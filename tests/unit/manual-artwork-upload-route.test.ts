import { expect, test, vi } from 'vitest';

const { hasOpsSessionMock, createManualArtworkUploadServiceMock } = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createManualArtworkUploadServiceMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({ createManualArtworkUploadService: createManualArtworkUploadServiceMock }));
vi.mock('@/server/ops/runtimeOps', () => ({
  OpsRuntimeUnavailableError: class OpsRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/ops/api/designer/[issueId]/upload/route';

const issueId = '11111111-1111-4111-8111-111111111111';

function request(file: File, reason = 'manual art direction') {
  const form = new FormData();
  form.set('file', file);
  form.set('reason', reason);
  return new Request(`https://issuedonce.shop/ops/api/designer/${issueId}/upload`, { method: 'POST', body: form });
}

test('diagnoses the multipart File boundary used by the route', async () => {
  const file = new File([new Uint8Array(12000)], 'owner-art.png', { type: 'image/png' });
  const parsedForm = await request(file).formData();
  const parsed = parsedForm.get('file');
  const parsedReason = parsedForm.get('reason');
  console.error('MANUAL_UPLOAD_MULTIPART_DIAGNOSTIC', JSON.stringify({
    constructorName: parsed && typeof parsed === 'object' ? parsed.constructor?.name : null,
    tag: Object.prototype.toString.call(parsed),
    name: parsed && typeof parsed === 'object' && 'name' in parsed ? parsed.name : null,
    mimeType: parsed && typeof parsed === 'object' && 'type' in parsed ? parsed.type : null,
    size: parsed && typeof parsed === 'object' && 'size' in parsed ? parsed.size : null,
    arrayBuffer: parsed && typeof parsed === 'object' && 'arrayBuffer' in parsed ? typeof parsed.arrayBuffer : null,
    reasonType: typeof parsedReason,
    reason: parsedReason,
  }));
  expect(parsed).not.toBeNull();
});

test('requires owner auth before reading or storing manual artwork', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  const response = await POST(request(new File([new Uint8Array(12000)], 'art.png', { type: 'image/png' })), { params: Promise.resolve({ issueId }) });
  expect(response.status).toBe(401);
  expect(createManualArtworkUploadServiceMock).not.toHaveBeenCalled();
});

test('passes a bounded PNG and reason to the audited manual-upload service', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const upload = vi.fn().mockResolvedValue({ candidateId: 'candidate-1', width: 1800, height: 2400, approved: false });
  createManualArtworkUploadServiceMock.mockReturnValue({ upload });
  const file = new File([new Uint8Array(12000)], 'owner-art.png', { type: 'image/png' });

  const response = await POST(request(file), { params: Promise.resolve({ issueId }) });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toMatch(/no-store/);
  const call = upload.mock.calls[0][0];
  expect(call.issueId).toBe(issueId);
  expect(call.fileName).toBe('owner-art.png');
  expect(call.mimeType).toBe('image/png');
  expect(call.reason).toBe('manual art direction');
  expect(Buffer.isBuffer(call.bytes)).toBe(true);
  expect(call.bytes.length).toBe(12000);
});

test('rejects oversized files before constructing the upload service', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const file = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
  const response = await POST(request(file), { params: Promise.resolve({ issueId }) });
  expect(response.status).toBe(413);
  expect(createManualArtworkUploadServiceMock).not.toHaveBeenCalled();
});
