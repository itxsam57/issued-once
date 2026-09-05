export type JobPayload = Record<string, unknown>;

export type EnqueueJobInput = {
  topic: string;
  payload: JobPayload;
  idempotencyKey: string;
  availableAt?: Date;
};

export type EnqueueJobResult = {
  id: string;
  duplicate: boolean;
};

export type ClaimedJob = {
  id: string;
  topic: string;
  payload: JobPayload;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
  leaseExpiresAt: Date;
};

export type ClaimJobsInput = {
  topics: string[];
  workerId: string;
  limit: number;
  leaseMs: number;
  now?: Date;
};

export interface JobQueue {
  enqueue(input: EnqueueJobInput): Promise<EnqueueJobResult>;
  claim(input: ClaimJobsInput): Promise<ClaimedJob[]>;
  complete(id: string, workerId: string): Promise<void>;
  retry(id: string, workerId: string, input: { availableAt: Date; error: string }): Promise<void>;
  fail(id: string, workerId: string, error: string): Promise<void>;
}
