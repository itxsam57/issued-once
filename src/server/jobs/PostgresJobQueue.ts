import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ClaimedJob,
  ClaimJobsInput,
  EnqueueJobInput,
  EnqueueJobResult,
  JobPayload,
  JobQueue,
} from './JobQueue';

type EnqueueRow = {
  id: string;
  duplicate: boolean;
};

type ClaimedJobRow = {
  id: string;
  topic: string;
  payload: JobPayload | string;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  lease_expires_at: Date | string;
};

type MutationRow = { id: string };

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function parsePayload(value: JobPayload | string): JobPayload {
  if (typeof value === 'string') return JSON.parse(value) as JobPayload;
  return value;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function assertMutation(rows: MutationRow[], operation: string): void {
  if (rows.length === 0) throw new Error(`Job lease conflict during ${operation}`);
}

export class PostgresJobQueue implements JobQueue {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly idFactory: () => string = randomUUID,
  ) {}

  async enqueue(input: EnqueueJobInput): Promise<EnqueueJobResult> {
    if (!input.topic.trim()) throw new Error('Job topic is required');
    if (!input.idempotencyKey.trim()) throw new Error('Job idempotency key is required');
    const id = this.idFactory();
    const availableAt = input.availableAt ?? new Date();
    const rows = await this.sql.query<EnqueueRow>(
      `
        WITH inserted AS (
          INSERT INTO background_jobs (
            id,
            topic,
            payload,
            idempotency_key,
            available_at
          )
          VALUES ($1, $2, $3::jsonb, $4, $5)
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING id
        )
        SELECT id, FALSE AS duplicate
        FROM inserted
        UNION ALL
        SELECT id, TRUE AS duplicate
        FROM background_jobs
        WHERE idempotency_key = $4
          AND NOT EXISTS (SELECT 1 FROM inserted)
        LIMIT 1
      `,
      [id, input.topic, JSON.stringify(input.payload), input.idempotencyKey, availableAt],
    );
    const row = rows[0];
    if (!row) throw new Error('Job enqueue did not return a row');
    return { id: row.id, duplicate: Boolean(row.duplicate) };
  }

  async claim(input: ClaimJobsInput): Promise<ClaimedJob[]> {
    if (input.topics.length === 0) return [];
    if (!input.workerId.trim()) throw new Error('Job worker id is required');
    assertPositiveInteger(input.limit, 'Job claim limit');
    assertPositiveInteger(input.leaseMs, 'Job lease');
    const now = input.now ?? new Date();
    const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
    const rows = await this.sql.query<ClaimedJobRow>(
      `
        WITH exhausted AS (
          UPDATE background_jobs
          SET
            state = 'FAILED',
            lease_owner = NULL,
            lease_expires_at = NULL,
            last_error = COALESCE(last_error, 'Worker lease expired after maximum attempts'),
            updated_at = $2
          WHERE state = 'PROCESSING'
            AND lease_expires_at <= $2
            AND attempts >= max_attempts
          RETURNING id
        ),
        due AS (
          SELECT id
          FROM background_jobs
          WHERE topic = ANY($1::text[])
            AND available_at <= $2
            AND attempts < max_attempts
            AND (
              state = 'PENDING'
              OR (state = 'PROCESSING' AND lease_expires_at <= $2)
            )
          ORDER BY available_at ASC, created_at ASC
          LIMIT $3
          FOR UPDATE SKIP LOCKED
        )
        UPDATE background_jobs AS jobs
        SET
          state = 'PROCESSING',
          attempts = attempts + 1,
          lease_owner = $4,
          lease_expires_at = $5,
          updated_at = $2
        FROM due
        WHERE jobs.id = due.id
        RETURNING
          jobs.id,
          jobs.topic,
          jobs.payload,
          jobs.idempotency_key,
          jobs.attempts,
          jobs.max_attempts,
          jobs.lease_expires_at
      `,
      [input.topics, now, input.limit, input.workerId, leaseExpiresAt],
    );
    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      payload: parsePayload(row.payload),
      idempotencyKey: row.idempotency_key,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      leaseExpiresAt: toDate(row.lease_expires_at),
    }));
  }

  async complete(id: string, workerId: string): Promise<void> {
    const rows = await this.sql.query<MutationRow>(
      `
        UPDATE background_jobs
        SET
          state = 'COMPLETED',
          lease_owner = NULL,
          lease_expires_at = NULL,
          last_error = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND state = 'PROCESSING'
          AND lease_owner = $2
        RETURNING id
      `,
      [id, workerId],
    );
    assertMutation(rows, 'complete');
  }

  async retry(
    id: string,
    workerId: string,
    input: { availableAt: Date; error: string },
  ): Promise<void> {
    const rows = await this.sql.query<MutationRow>(
      `
        UPDATE background_jobs
        SET
          state = 'PENDING',
          available_at = $3,
          lease_owner = NULL,
          lease_expires_at = NULL,
          last_error = $4,
          updated_at = NOW()
        WHERE id = $1
          AND state = 'PROCESSING'
          AND lease_owner = $2
        RETURNING id
      `,
      [id, workerId, input.availableAt, input.error],
    );
    assertMutation(rows, 'retry');
  }

  async fail(id: string, workerId: string, error: string): Promise<void> {
    const rows = await this.sql.query<MutationRow>(
      `
        UPDATE background_jobs
        SET
          state = 'FAILED',
          lease_owner = NULL,
          lease_expires_at = NULL,
          last_error = $3,
          updated_at = NOW()
        WHERE id = $1
          AND state = 'PROCESSING'
          AND lease_owner = $2
        RETURNING id
      `,
      [id, workerId, error],
    );
    assertMutation(rows, 'fail');
  }
}
