# Repeat-Order Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer place unlimited independent orders after checkout while choosing either to reuse the immediately previous seven-answer creative profile or answer seven genuinely different questions for the next order.

**Architecture:** A terminal `CHECKOUT_STARTED` experience no longer doubles as the next purchase. Bootstrap reports a `repeat-choice` state without mutating anything. A dedicated repeat-order service derives one deterministic child session identity from the terminal source token, lets PostgreSQL uniqueness arbitrate concurrent choice requests, and persists the winning mode in the existing `hook_id` field. Reuse mode atomically copies encrypted answers and exact question snapshots; fresh mode creates a `QUESTION_1` child and assigns one different prompt per family by excluding the prior seven question IDs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Neon Postgres, Vitest, Testing Library, Playwright, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-08-23-repeat-order-lifecycle-design.md`

## Global Constraints

- A repeat buyer must explicitly choose `KEEP PREVIOUS ANSWERS` or `ANSWER AGAIN`; neither path is forced.
- Every order must have a distinct `Experience`, quote, payment attempt, and downstream Issue lifecycle.
- `ANSWER AGAIN` must exclude the immediately previous question ID in every required family; the current vault has ten active prompts per family.
- `KEEP PREVIOUS ANSWERS` must copy encrypted payload fields verbatim and copy exact question assignment snapshots; no answer plaintext is decrypted for reuse.
- Opposite-choice and same-choice races from one terminal source must converge on one deterministic child experience; the first committed mode wins.
- No new database migration is permitted for this repair. `0029_creator_referrals.sql` remains untouched and owner-gated.
- No real-money payment is used for the regression. Dummy checkout uses a fake/intercepted gateway.
- Existing Safepay `webhooks=true`, signed webhook verification, Reporter fallback, and paid-order idempotency must remain unchanged.
- Printful production confirmation remains disabled.

---

### Task 1: Deterministic next-order identity and race-safe child persistence

**Files:**
- Modify: `src/server/http/sessionToken.ts`
- Create: `src/server/experience/RepeatOrderRepository.ts`
- Create: `src/server/experience/PostgresRepeatOrderRepository.ts`
- Create: `src/server/experience/RepeatOrderService.ts`
- Test: `tests/unit/repeat-order-token.test.ts`
- Test: `tests/unit/repeat-order-service.test.ts`

**Interfaces:**
- Produces: `deriveNextOrderSessionToken(currentToken: string): string`
- Produces: `RepeatOrderMode = 'reuse' | 'fresh'`
- Produces: `RepeatOrderRepository.resolve(input): Promise<RepeatOrderChild>` where `RepeatOrderChild` includes `{ experienceId, mode, stage, created }`.
- Produces: `RepeatOrderService.choose(input): Promise<{ token, mode, stage, experienceId }>` for Task 3.

- [ ] **Step 1: Write failing deterministic-token tests**

Create `tests/unit/repeat-order-token.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveNextOrderSessionToken } from '@/server/http/sessionToken';

describe('deriveNextOrderSessionToken', () => {
  it('is deterministic, domain separated, and does not echo the source token', () => {
    const source = 'source-session-token';
    const first = deriveNextOrderSessionToken(source);
    const second = deriveNextOrderSessionToken(source);

    expect(first).toBe(second);
    expect(first).not.toBe(source);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveNextOrderSessionToken('another-session-token')).not.toBe(first);
  });
});
```

- [ ] **Step 2: Run the token test and verify RED**

Run: `pnpm test -- tests/unit/repeat-order-token.test.ts`

Expected: FAIL because `deriveNextOrderSessionToken` is not exported.

- [ ] **Step 3: Implement the deterministic token derivation**

Modify `src/server/http/sessionToken.ts` to keep `createSessionToken()`/`hashSessionToken()` unchanged and add:

```ts
export function deriveNextOrderSessionToken(currentToken: string): string {
  return createHash('sha256')
    .update('issued-once:repeat-order:v1\0', 'utf8')
    .update(currentToken, 'utf8')
    .digest('base64url');
}
```

- [ ] **Step 4: Run the token test and verify GREEN**

Run: `pnpm test -- tests/unit/repeat-order-token.test.ts`

Expected: PASS.

- [ ] **Step 5: Define the repeat-order repository contract**

Create `src/server/experience/RepeatOrderRepository.ts`:

```ts
import type { ExperienceStage } from '@/domain/experience/types';

export type RepeatOrderMode = 'reuse' | 'fresh';

export type RepeatOrderChild = {
  experienceId: string;
  mode: RepeatOrderMode;
  stage: ExperienceStage;
  created: boolean;
};

export interface RepeatOrderRepository {
  resolve(input: {
    sourceExperienceId: string;
    childExperienceId: string;
    childSessionHash: string;
    requestedMode: RepeatOrderMode;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<RepeatOrderChild>;
}
```

- [ ] **Step 6: Write failing service tests for reuse, fresh, and race recovery**

Create `tests/unit/repeat-order-service.test.ts` using small in-memory fakes for `ExperienceRepository`, `RepeatOrderRepository`, and a question assigner. Cover these exact assertions:

```ts
it('creates a reuse child from CHECKOUT_STARTED without mutating the source', async () => {
  const result = await service.choose({ sessionToken: sourceToken, mode: 'reuse' });
  expect(result.mode).toBe('reuse');
  expect(result.stage).toBe('PROFILE_COMPLETE');
  expect(result.token).toBe(deriveNextOrderSessionToken(sourceToken));
  expect(source.stage).toBe('CHECKOUT_STARTED');
});

it('creates a fresh child at QUESTION_1 and excludes all seven previous question ids', async () => {
  const result = await service.choose({ sessionToken: sourceToken, mode: 'fresh' });
  expect(result.mode).toBe('fresh');
  expect(result.stage).toBe('QUESTION_1');
  expect(assignFresh).toHaveBeenCalledWith(result.experienceId, expect.objectContaining({
    culture: expect.any(String), place: expect.any(String), rhythm: expect.any(String),
    identity: expect.any(String), music: expect.any(String), boundary: expect.any(String), wildcard: expect.any(String),
  }));
});

it('returns the persisted winning mode when an opposite choice loses the child race', async () => {
  repeatRepository.resolve = vi.fn().mockResolvedValue({
    experienceId: childId, mode: 'reuse', stage: 'PROFILE_COMPLETE', created: false,
  });
  const result = await service.choose({ sessionToken: sourceToken, mode: 'fresh' });
  expect(result.mode).toBe('reuse');
  expect(assignFresh).not.toHaveBeenCalled();
});
```

Also assert non-terminal sources are rejected and no new token is returned.

- [ ] **Step 7: Run the service test and verify RED**

Run: `pnpm test -- tests/unit/repeat-order-service.test.ts`

Expected: FAIL because the repository/service do not exist.

- [ ] **Step 8: Implement one-statement PostgreSQL child resolution**

Create `src/server/experience/PostgresRepeatOrderRepository.ts` using the existing `SqlExecutor` type. The SQL must:

1. insert a child with the deterministic `public_session_hash` and `hook_id` equal to `repeat:reuse` or `repeat:fresh` using `ON CONFLICT (public_session_hash) DO NOTHING`;
2. use `PROFILE_COMPLETE` for a newly inserted reuse child and `QUESTION_1` for a newly inserted fresh child;
3. only when the inserted child is `repeat:reuse`, copy one `experience_question_sets` row, the seven `experience_question_set_items`, and the seven `experience_answers` rows from the source in the same SQL statement;
4. return the existing or newly inserted child and derive `mode` from its persisted `hook_id`;
5. throw if the persisted hook is not one of the two expected repeat modes;
6. verify a newly inserted reuse child copied exactly seven answers and seven question items before returning. Any mismatch must throw so the statement rolls back.

The repository returns `created: true` only when this statement inserted the child; conflict recovery returns `created: false`.

- [ ] **Step 9: Implement `RepeatOrderService`**

Create `src/server/experience/RepeatOrderService.ts` with dependencies:

```ts
type QuestionProfileGateway = {
  assign(experienceId: string): Promise<readonly AssignedQuestionRecord[]>;
  assignExcluding(
    experienceId: string,
    excludedByFamily: Readonly<Partial<Record<QuestionFamily, string>>>,
  ): Promise<readonly AssignedQuestionRecord[]>;
};
```

`choose()` must:

1. hash the supplied source token and load the source experience;
2. require source stage exactly `CHECKOUT_STARTED`;
3. load the source stored question assignment and require exactly seven items;
4. derive the deterministic child token/hash and a random child UUID;
5. call `RepeatOrderRepository.resolve(...)`;
6. if resolved mode is `reuse`, return immediately without decrypting/copying in application code;
7. if resolved mode is `fresh`, build `excludedByFamily` from the source assignment and call `assignExcluding(child.experienceId, excludedByFamily)`; require exactly seven questions and require every family’s returned question ID differs from the excluded ID;
8. return the actual persisted mode/stage/token/experienceId.

- [ ] **Step 10: Run Task 1 unit tests and verify GREEN**

Run: `pnpm test -- tests/unit/repeat-order-token.test.ts tests/unit/repeat-order-service.test.ts`

Expected: PASS.

- [ ] **Step 11: Commit Task 1**

Commit message: `feat: isolate repeat order lifecycle`

---

### Task 2: Fresh-question exclusion without weakening weighted selection

**Files:**
- Modify: `src/server/questions/QuestionSelectionService.ts`
- Modify: `src/server/questions/PostgresLiveQuestionSelectionService.ts`
- Modify: `src/server/questions/runtimeQuestions.ts`
- Test: `tests/unit/repeat-question-selection.test.ts`

**Interfaces:**
- Consumes: `QuestionFamily`, `AssignedQuestionRecord`.
- Produces: `assignExcluding(experienceId, excludedByFamily)` on both preview and live question assigners.

- [ ] **Step 1: Write the failing question-selection regression**

Create `tests/unit/repeat-question-selection.test.ts` with a vault containing at least two active questions in each required family and deterministic `random: () => 0`. Persist a previous ID per family as exclusions, then assert:

```ts
const assigned = await service.assignExcluding('child', exclusions);
expect(assigned).toHaveLength(7);
for (const question of assigned) {
  expect(question.questionId).not.toBe(exclusions[question.family]);
}
```

Add a second test where one family has only the excluded active question and assert rejection with `Question family has no active alternate prompts`.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test -- tests/unit/repeat-question-selection.test.ts`

Expected: FAIL because `assignExcluding` does not exist.

- [ ] **Step 3: Extend `QuestionSelectionService`**

Refactor selection so existing `assign(experienceId)` remains behavior-compatible and delegates to:

```ts
async assignExcluding(
  experienceId: string,
  excludedByFamily: Readonly<Partial<Record<QuestionFamily, string>>>,
): Promise<readonly AssignedQuestionRecord[]>;
```

For each required family, filter out the matching excluded question ID before calling the existing weighted-selection function. If no active weighted candidate remains, throw `Question family has no active alternate prompts`.

Do not alter the weighting algorithm for the remaining candidates.

- [ ] **Step 4: Extend live question selection**

In `PostgresLiveQuestionSelectionService`, keep `assign()` unchanged for callers and add `assignExcluding()`. Both methods must seed/read the live question definition table exactly as today; the exclusion happens only after the active live vault has been loaded.

- [ ] **Step 5: Extend the runtime assigner type**

Update `runtimeQuestions.ts` so `getQuestionSelectionService()` returns both:

```ts
assign(experienceId: string): Promise<readonly AssignedQuestionRecord[]>;
assignExcluding(
  experienceId: string,
  excludedByFamily: Readonly<Partial<Record<QuestionFamily, string>>>,
): Promise<readonly AssignedQuestionRecord[]>;
```

Preview mode uses the same `QuestionSelectionService`, preserving deterministic preview randomness.

- [ ] **Step 6: Run targeted question tests and verify GREEN**

Run: `pnpm test -- tests/unit/repeat-question-selection.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Commit message: `feat: support fresh repeat interview prompts`

---

### Task 3: Bootstrap detection and repeat-choice API

**Files:**
- Modify: `src/server/questions/InterviewBootstrapService.ts`
- Modify: `src/app/api/experience/start/route.ts`
- Create: `src/server/experience/runtimeRepeatOrders.ts`
- Create: `src/app/api/experience/repeat/route.ts`
- Test: `tests/unit/interview-bootstrap-repeat.test.ts`
- Test: `tests/unit/repeat-order-route.test.ts`

**Interfaces:**
- Produces bootstrap `entryMode: 'interview' | 'profile' | 'repeat-choice'`.
- Consumes `RepeatOrderService.choose({ sessionToken, mode })`.
- Produces repeat endpoint response `{ entryMode: 'interview' | 'form', stage, initialPosition, interviewComplete, questions }` and rotates the normal session cookie to the child token.

- [ ] **Step 1: Write failing bootstrap tests**

Create `tests/unit/interview-bootstrap-repeat.test.ts` asserting:

```ts
expect(await bootstrapService.bootstrap(checkoutStartedToken)).toMatchObject({
  token: checkoutStartedToken,
  stage: 'CHECKOUT_STARTED',
  interviewComplete: true,
  entryMode: 'repeat-choice',
});
```

Also assert `QUESTION_1..QUESTION_7` return `entryMode: 'interview'` and `PROFILE_COMPLETE` returns `entryMode: 'profile'`.

- [ ] **Step 2: Run bootstrap test and verify RED**

Run: `pnpm test -- tests/unit/interview-bootstrap-repeat.test.ts`

Expected: FAIL because `entryMode` is missing.

- [ ] **Step 3: Implement bootstrap entry mode**

Add `entryMode` to `InterviewBootstrap`. Compute it without creating a child:

```ts
const entryMode = existing.stage === 'CHECKOUT_STARTED'
  ? 'repeat-choice'
  : POSITION_BY_STAGE[existing.stage]
    ? 'interview'
    : 'profile';
```

Keep source token/session unchanged for `repeat-choice`.

- [ ] **Step 4: Return `entryMode` from `/api/experience/start`**

Add the field to the JSON response. Do not return answer payloads.

- [ ] **Step 5: Write failing repeat-order route tests**

Create `tests/unit/repeat-order-route.test.ts` covering:

- body must be exactly a valid `choice` enum `reuse | fresh`;
- no session cookie -> 401;
- runtime unavailable -> 503;
- invalid lifecycle -> 409;
- reuse result sets session cookie to child token and returns `entryMode: 'form'` with `PROFILE_COMPLETE`;
- fresh result sets session cookie and returns `entryMode: 'interview'`, `QUESTION_1`, `initialPosition: 1`, and seven safe question definitions;
- if caller requested fresh but persisted winner is reuse, response reports `form`/reuse behavior.

- [ ] **Step 6: Run route test and verify RED**

Run: `pnpm test -- tests/unit/repeat-order-route.test.ts`

Expected: FAIL because route/runtime do not exist.

- [ ] **Step 7: Implement repeat-order runtime**

Create `runtimeRepeatOrders.ts` using the existing `DATABASE_URL`, `PostgresExperienceRepository`, `PostgresRepeatOrderRepository`, and `getQuestionSelectionService()`. Throw a dedicated `RepeatOrderRuntimeUnavailableError` when persistent runtime is not configured.

- [ ] **Step 8: Implement `/api/experience/repeat`**

Validate body with Zod:

```ts
z.object({ choice: z.enum(['reuse', 'fresh']) }).strict()
```

Read the existing session cookie, call `choose`, set the returned child token with existing `sessionCookieOptions`, and return the resolved mode as client entry state. For fresh mode, load/return the stored child assignment through `toInterviewQuestions`; for reuse, return `questions: []` because the UI proceeds directly to form.

Map lifecycle/state conflicts to 409 and runtime configuration failures to 503. Never log tokens or answer payloads.

- [ ] **Step 9: Run Task 3 tests and verify GREEN**

Run: `pnpm test -- tests/unit/interview-bootstrap-repeat.test.ts tests/unit/repeat-order-route.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

Commit message: `feat: expose repeat order choice API`

---

### Task 4: Customer choice UI and state transitions

**Files:**
- Create: `src/components/experience/RepeatOrderChoice.tsx`
- Modify: `src/components/experience/MysteryExperience.tsx`
- Modify: `src/components/experience/PublicInterviewExperience.tsx`
- Modify: the existing experience stylesheet that defines `.object-selection` / interview screen presentation; keep styling within the current design system rather than introducing a second visual system.
- Test: `tests/unit/repeat-order-choice.test.tsx`
- Test: `tests/unit/mystery-repeat-flow.test.tsx`

**Interfaces:**
- Consumes bootstrap `entryMode`.
- Consumes `POST /api/experience/repeat` response.
- Produces UI phases `repeat-choice`, `interview`, and `form` without page reload.

- [ ] **Step 1: Write failing choice-component test**

Create `tests/unit/repeat-order-choice.test.tsx`:

```tsx
render(<RepeatOrderChoice onChoose={onChoose} />);
expect(screen.getByText('ANOTHER ISSUE')).toBeVisible();
expect(screen.getByRole('button', { name: 'KEEP PREVIOUS ANSWERS' })).toBeEnabled();
expect(screen.getByRole('button', { name: 'ANSWER AGAIN' })).toBeEnabled();
await user.click(screen.getByRole('button', { name: 'ANSWER AGAIN' }));
expect(onChoose).toHaveBeenCalledWith('fresh');
```

Also assert buttons are disabled while the promise is pending and keyboard activation works through native button semantics.

- [ ] **Step 2: Run choice-component test and verify RED**

Run: `pnpm test -- tests/unit/repeat-order-choice.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement `RepeatOrderChoice`**

Render:

- signal `ANOTHER ISSUE`;
- heading that clearly says the customer can shape the next piece from the previous answers or answer again;
- two equally visible native buttons: `KEEP PREVIOUS ANSWERS` and `ANSWER AGAIN`;
- one shared pending state that prevents double submission.

Do not present repeat ordering as an error or recovery screen.

- [ ] **Step 4: Write failing MysteryExperience transition tests**

Create `tests/unit/mystery-repeat-flow.test.tsx` covering:

- initial `entryMode='repeat-choice'` renders the choice screen, not `WE HAVE ENOUGH.`;
- resolved reuse immediately shows `FORM / CURRENT ISSUE`;
- resolved fresh replaces the question set with the returned seven fresh questions and begins at `01 / 07`;
- first-time `PROFILE_COMPLETE` behavior keeps the existing `WE HAVE ENOUGH.` + `UNLOCK FORM` threshold.

- [ ] **Step 5: Run flow tests and verify RED**

Run: `pnpm test -- tests/unit/mystery-repeat-flow.test.tsx`

Expected: FAIL because entry mode/choice transitions are unsupported.

- [ ] **Step 6: Implement client API call**

In `PublicInterviewExperience.tsx`, extend `BootstrapPayload` with `entryMode`. Add:

```ts
async function chooseRepeatProfile(choice: 'reuse' | 'fresh'): Promise<BootstrapPayload> {
  return postJson<BootstrapPayload>('/api/experience/repeat', { choice });
}
```

Keep the existing payment redirect code unchanged.

- [ ] **Step 7: Implement phase initialization and choice resolution**

Extend `MysteryExperience` with an initial entry mode and an `onRepeatChoice` callback. Initialize phase as:

- `repeat-choice` for terminal repeat entry;
- `interview` for new/fresh interview;
- existing first-profile completion still renders `InterviewFlow` initially complete.

When choice resolves:

- reuse -> clear stale selected object/size/color/quote state and set phase `form`;
- fresh -> replace local questions/initial position from response, clear stale physical/quote state, set phase `interview`.

No previous order selection is carried into the new order.

- [ ] **Step 8: Apply existing design language to the choice screen**

Use the same typography, spacing, border treatment, button behavior, responsive breakpoints, and focus visibility already used by the interview/object selection screens. Add only the selectors required by `RepeatOrderChoice`.

- [ ] **Step 9: Run Task 4 tests and verify GREEN**

Run: `pnpm test -- tests/unit/repeat-order-choice.test.tsx tests/unit/mystery-repeat-flow.test.tsx`

Expected: PASS.

- [ ] **Step 10: Commit Task 4**

Commit message: `feat: let repeat buyers choose their profile`

---

### Task 5: Three-order dummy-payment hard test and regression verification

**Files:**
- Create: `tests/e2e/public-repeat-order.spec.ts`
- Modify only if required for shared test helpers: `tests/e2e/public-physical-flow.spec.ts`
- No production payment-provider code changes are expected in this task.

**Interfaces:**
- Exercises the production customer UI/API shape with intercepted fake Safepay checkout.
- Proves order 1 fresh -> order 2 reuse -> order 3 fresh.

- [ ] **Step 1: Write the failing desktop/mobile Playwright regression**

Create `tests/e2e/public-repeat-order.spec.ts` using the same interview/contact/shipping helpers and network interception style already present in `public-physical-flow.spec.ts`.

The test must keep one browser context and perform:

**Order 1**

1. begin from `/` and answer seven questions;
2. record the seven prompt texts shown;
3. choose TEE, complete fit/base/contact/shipping;
4. intercept `/api/payments/create` and redirect to a local/intercepted dummy Safepay page with payment identity `payment-repeat-1`;
5. re-enter `/begin`.

**Order 2 — reuse**

6. assert `ANOTHER ISSUE` is visible;
7. click `KEEP PREVIOUS ANSWERS`;
8. assert no question `01 / 07` is shown and `FORM / CURRENT ISSUE` is visible;
9. choose CAP, complete its available selection/contact/shipping path;
10. reach dummy checkout with identity `payment-repeat-2` and assert it differs from order 1;
11. re-enter `/begin`.

**Order 3 — fresh**

12. assert `ANOTHER ISSUE` again;
13. click `ANSWER AGAIN`;
14. assert `01 / 07` appears;
15. collect all seven new prompt texts and assert each ordinal prompt differs from the corresponding prompt from order 1/order 2 reused profile;
16. answer all seven;
17. choose TEE (or another available product), complete contact/shipping;
18. reach dummy checkout with identity `payment-repeat-3`;
19. assert all three payment identities are distinct;
20. capture screenshots for choice screen, reuse product selection, fresh interview start, and third commitment state.

Because Playwright config already runs `desktop-chromium` and `mobile-chromium`, the same spec must pass both projects.

- [ ] **Step 2: Run the new E2E spec and verify RED before implementation branch is considered complete**

Run: `pnpm test:e2e -- tests/e2e/public-repeat-order.spec.ts`

Expected before all prior tasks: FAIL at repeat-order choice/second order.

- [ ] **Step 3: Make only test-harness corrections required to exercise real application behavior**

Use route interception only for OTP, shipping persistence where existing tests already stub it, and dummy payment checkout. Do not intercept `/api/experience/start`, `/api/experience/repeat`, object, size, or base endpoints in a way that bypasses the repeat-order lifecycle under test.

- [ ] **Step 4: Run the new E2E spec and verify GREEN**

Run: `pnpm test:e2e -- tests/e2e/public-repeat-order.spec.ts`

Expected: PASS on desktop and mobile.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Expected: all commands exit 0.

- [ ] **Step 6: Audit the payment and migration diff**

Verify the implementation diff contains:

- no change that removes Safepay `webhooks=true`;
- no change to webhook/Reporter payment truth logic;
- no Printful production enablement;
- no new migration and no edit/application of `0029_creator_referrals.sql`.

- [ ] **Step 7: Commit Task 5**

Commit message: `test: prove unlimited repeat ordering`

- [ ] **Step 8: Open PR against `feat/mystery-foundation` and run hosted verification**

PR description must include the root cause, chosen lifecycle architecture, RED/GREEN evidence, three-order dummy-payment proof, migration boundary, and payment-provider safety statement.

Wait for GitHub CI/Vercel preview/Browser QA checks to report. Inspect failing logs if any and repair via the same TDD/root-cause process.

- [ ] **Step 9: Run live production smoke only after canonical merge/deploy**

The live smoke must not create a real charge. It may verify page entry, repeat-choice rendering through a safe test fixture/preview path, and ordinary production navigation, but must not submit a real Safepay payment solely for this test.

- [ ] **Step 10: Update `.engineering/CONTINUATION.json`**

Record the verified application head, CI/Browser QA evidence, repeat-order lifecycle status, and preserve existing owner gates for OpenAI/Blob design automation, migration `0029`, and Printful production confirmation.
