import { randomUUID } from 'node:crypto';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import type { DesignPolicy } from './DesignPolicy';
import { PostgresDesignPolicyRepository } from './PostgresDesignPolicyRepository';
import { PostgresDesignRepository } from './PostgresDesignRepository';
import { enqueueDesignIssue } from './designQueue';
import { DesignRuntimeUnavailableError } from './runtimeDesign';

type EffectivePolicyReader = {
  getEffective(issueId: string): Promise<{
    globalVersion: number;
    override: Partial<DesignPolicy> | null;
    policy: DesignPolicy;
  }>;
};

type DispatchActions = {
  enqueue(issueId: string): Promise<unknown>;
  reserveManual(issueId: string): Promise<unknown>;
  automationReady(): boolean;
};

export type DesignDispatchResult = {
  mode: DesignPolicy['mode'];
  queued: boolean;
  policyVersion: number;
  fallback: boolean;
};

export class DesignDispatchService {
  constructor(
    private readonly policies: EffectivePolicyReader,
    private readonly actions: DispatchActions,
  ) {}

  async dispatchPaidIssueDesign(issueId: string): Promise<DesignDispatchResult> {
    const effective = await this.policies.getEffective(issueId);
    const manualMode = effective.policy.mode === 'MANUAL';
    const fallback = !manualMode && !this.actions.automationReady();

    if (manualMode || fallback) {
      await this.actions.reserveManual(issueId);
      return {
        mode: effective.policy.mode,
        queued: false,
        policyVersion: effective.globalVersion,
        fallback,
      };
    }

    await this.actions.enqueue(issueId);
    return {
      mode: effective.policy.mode,
      queued: true,
      policyVersion: effective.globalVersion,
      fallback: false,
    };
  }
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new DesignRuntimeUnavailableError('DATABASE_URL is required');
  return value;
}

function hasDesignAutomationConfig(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function createDesignDispatchService(): DesignDispatchService {
  const sql = createNeonSqlExecutor(databaseUrl());
  const designs = new PostgresDesignRepository(sql);
  return new DesignDispatchService(
    new PostgresDesignPolicyRepository(sql),
    {
      enqueue: (issueId) => enqueueDesignIssue(issueId),
      automationReady: hasDesignAutomationConfig,
      reserveManual: async (issueId) => {
        const existing = await designs.findByIssueId(issueId);
        if (existing) return existing;
        const now = new Date();
        return designs.begin({
          id: randomUUID(),
          issueId,
          state: 'QUEUED',
          encryptedBrief: null,
          artworkUrl: null,
          artworkMimeType: null,
          artworkBytes: null,
          width: null,
          height: null,
          provider: null,
          model: null,
          createdAt: now,
          updatedAt: now,
        });
      },
    },
  );
}

export function dispatchPaidIssueDesign(issueId: string): Promise<DesignDispatchResult> {
  return createDesignDispatchService().dispatchPaidIssueDesign(issueId);
}
