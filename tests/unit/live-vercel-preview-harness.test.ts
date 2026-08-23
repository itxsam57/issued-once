import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/browser-qa.yml', 'utf8');
const liveProbe = readFileSync('tests/e2e/live-owner-preview.mjs', 'utf8');
const liveProductionProbe = readFileSync('tests/e2e/live-production-smoke.mjs', 'utf8');
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

  it('targets the explicitly supplied repair-branch preview instead of a hard-coded base preview', () => {
    expect(workflow).toContain('preview_url:');
    expect(workflow).toContain("PREVIEW_URL: ${{ inputs.preview_url }}");
    expect(workflow).not.toContain('PREVIEW_URL: https://issued-once-git-feat-mystery-foundation-samx4.vercel.app');
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

  it('runs a real production smoke probe against the custom domain and checks persistence boundaries', () => {
    expect(workflow).toContain('LIVE_PRODUCTION_URL: https://issuedonce.shop');
    expect(workflow).toContain('node tests/e2e/live-production-smoke.mjs');
    expect(liveProductionProbe).toContain("'/api/experience/answer'");
    expect(liveProductionProbe).toContain("'/api/experience/object'");
    expect(liveProductionProbe).toContain("'/api/experience/size'");
    expect(liveProductionProbe).toContain("'/api/experience/base'");
    expect(liveProductionProbe).toContain("'/api/contact/request-otp'");
    expect(liveProductionProbe).toContain('webrefreshlab@gmail.com');
    expect(liveProductionProbe).toContain('response.ok()');
  });

  it('answers the randomized production question bank by rendered input type rather than prompt text', () => {
    expect(liveProductionProbe).toContain('async function answerCurrentQuestion');
    expect(liveProductionProbe).toContain("locator('input[type=\"radio\"]')");
    expect(liveProductionProbe).toContain("getByLabel('Your answer')");
    expect(liveProductionProbe).not.toContain("getByLabel('4 a.m.')");
  });
});