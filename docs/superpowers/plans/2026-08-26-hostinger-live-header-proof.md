# Hostinger Live Header Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the stale bare-homepage Hostinger cache an automatic live release-proof failure without changing production runtime behavior.

**Architecture:** Reuse the existing five-header production security contract already covered by unit tests. Extend the live non-OTP boundary harness so its bare `/` probe also validates the exact required headers, rejects `x-powered-by`, and rejects cacheable `s-maxage` behavior. Add an isolated push-triggered strict-header workflow for the active engineering branch that first proves the configured live release identity from `.engineering/CONTINUATION.json`, then runs only the header probe against the temporary Hostinger URL.

**Tech Stack:** Node.js 22, Playwright APIRequestContext, GitHub Actions, Next.js production deployment on Hostinger.

**Spec:** `.engineering/CONTINUATION.json` securityHeaders contract and `tests/unit/hostinger-proxy-security-headers.test.ts`.

## Global Constraints

- Do not modify the exact V10 runtime candidate `aa73848e9ef79905e8239f9fb4cc8fce244e04c6` or any frozen release branch.
- Do not change Hostinger branch selection or environment variables.
- Do not expose secrets, OTPs, raw questionnaire answers, addresses, payment/provider credentials or session tokens.
- Do not create a real Safepay charge or confirm Printful production fulfillment.
- Keep PR #13 draft/unmerged and migration 0029 disabled.
- The expected live release identity must be resolved from `.engineering/CONTINUATION.json`, not duplicated as a hard-coded SHA in the strict-header workflow.

---

### Task 1: Add strict bare-home live header assertions

**Files:**
- Modify: `tests/e2e/live-non-otp-boundaries.mjs`

**Interfaces:**
- Consumes: Playwright `APIResponse.headers()` from the existing `fetchText` request helper.
- Produces: live finding messages for missing/mismatched security headers, exposed `x-powered-by`, missing `no-store`, or any `s-maxage` cache directive on bare `/`.

- [ ] **Step 1: Establish the RED evidence**

Use the existing V10 live evidence in `.engineering/CONTINUATION.json`: bare `/` is a Hostinger cache HIT with `s-maxage=31536000` and all five required security headers missing, while the current live boundary harness reports only the five configuration findings. This proves the live harness does not currently fail on the known header defect.

- [ ] **Step 2: Add the minimal harness implementation**

Extend `fetchText` to return `response.headers()`. Add one helper containing the exact existing contract:

```js
const REQUIRED_SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

function assertBareHomeSecurityHeaders(result) {
  for (const [name, expected] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    check(result.headers[name] === expected, `bare / ${name} mismatch`);
  }
  check(!('x-powered-by' in result.headers), 'bare / exposes x-powered-by');
  const cacheControl = result.headers['cache-control'] ?? '';
  check(cacheControl.includes('no-store'), 'bare / cache-control is missing no-store');
  check(!/s-maxage\s*=/.test(cacheControl), 'bare / cache-control contains s-maxage');
}
```

Call the helper only for the bare `/` response in the existing public-page loop.

- [ ] **Step 3: Verify repository checks**

Require the normal CI and Browser QA triggered by the harness commit to stay green. The live boundary itself is expected to remain RED until Hostinger's stale cache is purged and the remaining five runtime/public configuration findings are resolved.

- [ ] **Step 4: Commit**

Commit only the harness change with message `test: enforce bare Hostinger security headers live`.

### Task 2: Add isolated strict-header live workflow

**Files:**
- Create: `.github/workflows/hostinger-strict-header-audit.yml`
- Create: `tests/e2e/live-security-headers.mjs`

**Interfaces:**
- Consumes: `LIVE_PRODUCTION_URL` and expected release SHA resolved from `.engineering/CONTINUATION.json`.
- Produces: a small, non-destructive GitHub Actions proof that fails specifically when the bare `/` response violates the security/cache contract.

- [ ] **Step 1: Write the live probe**

Create a Node 22 script using built-in `fetch` that requests `${LIVE_PRODUCTION_URL}/`, requires HTTP 200, validates the exact five security headers, requires `x-powered-by` absent, requires `cache-control` to include `no-store`, rejects `s-maxage`, and prints only safe pass/finding messages.

- [ ] **Step 2: Add the workflow**

Trigger on `workflow_dispatch` and pushes to `engineering/live-header-proof-20260826`. Checkout the pushed engineering commit. Resolve the expected live SHA with Node from `.engineering/CONTINUATION.json` field `sourceOfTruth.hostingerLinkedBranchHead`, export it as `EXPECTED_RELEASE_ID`, run `tests/e2e/live-release-health.mjs`, then run `tests/e2e/live-security-headers.mjs`.

- [ ] **Step 3: Verify RED for the correct reason**

The first workflow run must reach the strict-header probe after exact-release health succeeds, then fail because the currently cached bare `/` response lacks the five headers and/or carries `s-maxage`. Any release-identity mismatch or script error is the wrong RED and must be fixed before proceeding.

- [ ] **Step 4: Commit**

Commit the isolated live proof with message `test: add strict Hostinger header audit`.

### Task 3: Reconcile governor and source branch

**Files:**
- Modify: `.engineering/CONTINUATION.json`

**Interfaces:**
- Consumes: verified CI/Browser QA plus strict-header workflow evidence.
- Produces: source-of-truth continuation state that records the automated header gate and preserves the owner cache-purge boundary.

- [ ] **Step 1: Update governor evidence**

Record the strict-header workflow run ID/job ID/result, the exact known RED reason, and that the next owner action is still a cache purge only—no branch or environment-variable change.

- [ ] **Step 2: Fast-forward active migration branch**

Only after repository verification, fast-forward `infra/hostinger-migration-20260823` to the verified engineering branch head; never force-update.

- [ ] **Step 3: Update PR #13 release notes**

Keep PR #13 draft/unmerged and add the automated strict-header gate plus current owner boundary.

- [ ] **Step 4: Post-cache GREEN criterion**

After the owner clears Hostinger server cache, rerun the strict-header job and require exact-release health plus all header/cache assertions to pass before marking the stale-cache gate complete.
