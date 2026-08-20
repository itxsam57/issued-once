import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/browser-qa.yml', 'utf8');
const liveProbe = readFileSync('tests/e2e/live-owner-preview.mjs', 'utf8');
const previewExperience = readFileSync(
  'src/components/preview/VisualPreviewExperience.tsx',
  'utf8',
);

describe('live Vercel preview harness', () => {
  it('passes the Vercel automation bypass secret from GitHub Actions into the live probe', () => {
    expect(workflow).toContain(
      "VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}",
    );
    expect(liveProbe).toContain("'x-vercel-protection-bypass'");
    expect(liveProbe).toContain("'x-vercel-set-bypass-cookie': 'true'");
  });

  it('tracks the preview-specific physical and delivery contract', () => {
    expect(previewExperience).toContain("{ code: 'M', label: 'Medium'");
    expect(previewExperience).toContain('amountMinor: 5400');
    expect(liveProbe).toContain("getByRole('radio', { name: /^Medium/ })");
    expect(liveProbe).toContain("getByLabel('Address', { exact: true })");
    expect(liveProbe).toContain("getByLabel('Province / state / region')");
    expect(liveProbe).toContain("getByLabel('Phone')");
    expect(liveProbe).toContain("getByText('$54.00')");
  });
});
