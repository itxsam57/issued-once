import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const workflowPath = '.github/workflows/live-release-qa.yml';
const releaseProbePath = 'tests/e2e/live-release-health.mjs';

test('manual live release QA accepts any deployment URL and proves health before the physical matrix', () => {
  expect(existsSync(workflowPath)).toBe(true);
  expect(existsSync(releaseProbePath)).toBe(true);
  if (!existsSync(workflowPath) || !existsSync(releaseProbePath)) return;

  const workflow = readFileSync(workflowPath, 'utf8');
  const releaseProbe = readFileSync(releaseProbePath, 'utf8');
  const physicalProbe = readFileSync('tests/e2e/live-production-smoke.mjs', 'utf8');

  expect(workflow).toContain('deployment_url:');
  expect(workflow).toContain("LIVE_PRODUCTION_URL: ${{ inputs.deployment_url }}");
  expect(workflow).toContain('node tests/e2e/live-release-health.mjs');
  expect(workflow).toContain('node tests/e2e/live-production-smoke.mjs');
  expect(workflow.indexOf('node tests/e2e/live-release-health.mjs')).toBeLessThan(
    workflow.indexOf('node tests/e2e/live-production-smoke.mjs'),
  );
  expect(workflow).not.toContain('VERCEL_AUTOMATION_BYPASS_SECRET');

  expect(releaseProbe).toContain("'/api/health/release'");
  for (const field of ['runtimeProvider', 'releaseId', 'version', 'databaseReady', 'queueReady', 'storageReady']) {
    expect(releaseProbe).toContain(field);
  }
  expect(releaseProbe).toContain("runtimeProvider !== 'hostinger'");
  expect(releaseProbe).toContain('databaseReady !== true');
  expect(releaseProbe).toContain('queueReady !== true');
  expect(releaseProbe).toContain('storageReady !== true');

  expect(physicalProbe).toContain("{ key: 'tee', radio: 'TEE', size: 'M'");
  expect(physicalProbe).toContain("{ key: 'hat', radio: 'CAP', size: 'OS'");
  expect(physicalProbe).toContain("{ key: 'tote', radio: 'TOTE', size: 'OS'");
  expect(physicalProbe).toContain('LIVE_PRODUCTION_${item.key.toUpperCase()}_PHYSICAL_GATE_PASS');
  expect(physicalProbe).toContain("'/api/experience/object'");
  expect(physicalProbe).toContain("'/api/experience/size'");
  expect(physicalProbe).toContain("'/api/experience/base'");
});
