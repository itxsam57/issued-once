import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export class InternalOperationsUnauthorizedError extends Error {
  constructor(message = 'Internal operation is unauthorized') {
    super(message);
    this.name = 'InternalOperationsUnauthorizedError';
  }
}

export function requireInternalAuthorization(headers: Headers): void {
  const configured = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
  if (!configured || configured.length < 24) {
    throw new InternalOperationsUnauthorizedError();
  }

  const authorization = headers.get('authorization')?.trim() ?? '';
  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix)) {
    throw new InternalOperationsUnauthorizedError();
  }
  const candidate = authorization.slice(prefix.length).trim();
  if (!candidate || !timingSafeEqual(digest(candidate), digest(configured))) {
    throw new InternalOperationsUnauthorizedError();
  }
}
