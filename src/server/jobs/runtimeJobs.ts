import { randomUUID } from 'node:crypto';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { JobProcessor } from './JobProcessor';
import { PostgresJobQueue } from './PostgresJobQueue';
import { createIssuedOnceJobHandlers } from './issuedOnceJobHandlers';

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required for background jobs');
  return value;
}

export function createJobQueue(): PostgresJobQueue {
  return new PostgresJobQueue(createNeonSqlExecutor(databaseUrl()));
}

export function createIssuedOnceJobProcessor(): JobProcessor {
  return new JobProcessor(createJobQueue(), createIssuedOnceJobHandlers());
}

export function createJobWorkerId(): string {
  return `hostinger-${process.pid}-${randomUUID()}`;
}
