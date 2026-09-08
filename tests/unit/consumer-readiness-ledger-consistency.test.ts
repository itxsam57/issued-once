import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type ContinuationState = {
  standingOwnerGates: { productionCoreMigration0036: boolean };
  productionRuntime: { coreMigration0036Verified: boolean };
};

const continuation = JSON.parse(
  readFileSync('.engineering/CONTINUATION.json', 'utf8'),
) as ContinuationState;
const masterPlan = readFileSync(
  'docs/superpowers/plans/2026-08-31-issued-once-consumer-readiness-master-plan.md',
  'utf8',
);

describe('consumer-readiness ledger consistency', () => {
  it('does not keep migration 0036 as an owner gate after production verification', () => {
    expect(continuation.standingOwnerGates.productionCoreMigration0036).toBe(false);
    expect(continuation.productionRuntime.coreMigration0036Verified).toBe(true);

    const cr15Row = masterPlan
      .split('\n')
      .find((line) => line.startsWith('| CR-15 |'));

    expect(cr15Row).toContain('production `0036` schema gate is verified');
    expect(masterPlan).not.toContain('It has not been applied to production.');
    expect(masterPlan).not.toContain(
      'production `0036` + destructive deployed recovery proof remain owner/live-gated',
    );
    expect(masterPlan).not.toContain(
      'apply `0036` only through its explicit production-migration gate',
    );
    expect(masterPlan).not.toContain(
      'Owner-gated production preflight: approve/apply required core migration `0036`',
    );
  });
});
