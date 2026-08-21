import { NextResponse } from 'next/server';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createManualArtworkUploadService } from '@/server/ops/runtimeOwnerOs';
import { OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

type Context = { params: Promise<{ issueId: string }> };
type UploadFile = { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

function isUploadFile(value: FormDataEntryValue | null): value is FormDataEntryValue & UploadFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<UploadFile>;
  return typeof candidate.name === 'string'
    && typeof candidate.type === 'string'
    && typeof candidate.size === 'number'
    && typeof candidate.arrayBuffer === 'function';
}

function errorStatus(message: string) {
  if (/not eligible|current factory state|manufacturing/i.test(message)) return 409;
  return 400;
}

export async function POST(request: Request, context: Context) {
  if (!(await hasOpsSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  try {
    const { issueId } = await context.params;
    const form = await request.formData();
    const file = form.get('file');
    const reason = form.get('reason');

    if (!isUploadFile(file)) return NextResponse.json({ error: 'PNG artwork file is required' }, { status: 400, headers: NO_STORE });
    if (typeof reason !== 'string' || !reason.trim()) return NextResponse.json({ error: 'Upload reason is required' }, { status: 400, headers: NO_STORE });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Artwork file is too large' }, { status: 413, headers: NO_STORE });
    if (file.type !== 'image/png' || !file.name.toLowerCase().endsWith('.png')) {
      return NextResponse.json({ error: 'Artwork must be PNG' }, { status: 400, headers: NO_STORE });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await createManualArtworkUploadService().upload({
      issueId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      reason,
    });
    return NextResponse.json(result, { status: 200, headers: NO_STORE });
  } catch (cause) {
    if (cause instanceof OpsRuntimeUnavailableError) {
      return NextResponse.json({ error: 'Manual artwork upload is unavailable' }, { status: 503, headers: NO_STORE });
    }
    const message = cause instanceof Error ? cause.message : 'Manual artwork upload failed';
    return NextResponse.json({ error: message }, { status: errorStatus(message), headers: NO_STORE });
  }
}
