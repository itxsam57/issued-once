# Repeat-Order Lifecycle Design

Date: 2026-08-23
Project: ISSUED ONCE
Canonical branch: `feat/mystery-foundation`

## Problem

A browser session currently owns one `Experience` row. That row stores both the seven-question creative profile progression and the current purchase progression. After the first order reaches checkout, the same row advances to `CHECKOUT_STARTED` and remains there.

On a later visit, `/api/experience/start` finds the existing session row and reuses it. The UI therefore sees the interview as complete, but the physical-selection API still receives the terminal order row. `ObjectSelectionService` only accepts `PROFILE_COMPLETE`, so selecting another tee, cap, hoodie, or tote fails with a state conflict. Returning/backing out of Safepay can therefore strand the buyer on the completed-profile screen without a valid path to another order.

This is a lifecycle-model bug, not a button bug.

## Product Requirement

A customer must be able to place an unlimited number of independent orders from the same browser/customer context.

After an order has reached checkout and the customer starts another order, the customer must choose which creative profile feeds the new order:

1. **KEEP PREVIOUS ANSWERS** — reuse the previous completed seven answers and their exact assigned questions for the new order.
2. **ANSWER AGAIN** — create a fresh seven-question assignment and let the customer answer a new interview for the new order.

The system must never silently force one choice. The buyer decides on every new order, including when buying the same product again.

Each order must have independent mutable state. Starting order 2 or order 3 must never mutate, reopen, reset, supersede, or corrupt earlier orders, quotes, payment attempts, Issues, notifications, design jobs, or manufacturing state.

## Design Decision

Use a fresh `Experience`/order snapshot after a terminal checkout, but insert an explicit **profile-choice step** before the next order proceeds.

Do **not** reset an old `Experience` row back to `PROFILE_COMPLETE`. That would change state under an already-created quote/payment and make order history unsafe.

Do **not** introduce a full permanent account/customer-profile schema in this repair. That would require a new production migration and is intentionally outside this incident because production migration `0029_creator_referrals.sql` remains separately owner-gated.

When bootstrap detects that the browser session references an `Experience` at `CHECKOUT_STARTED`, it does **not** immediately clone the old profile and does **not** start a new random interview. Instead it returns a repeat-order entry state that presents the two customer choices.

The choice then creates or recovers exactly one next-order `Experience` using deterministic, idempotent session derivation from the current secret session token plus a choice-specific namespace.

### KEEP PREVIOUS ANSWERS

The next order starts at `PROFILE_COMPLETE`.

The persistence operation copies:

- all seven encrypted answer payloads without decrypting them;
- the exact seven assigned question-set snapshots (question/version/family/prompt/kind/options) so copied answers retain their original meaning.

The browser cookie rotates to the next-order token. The UI proceeds directly to physical form selection.

### ANSWER AGAIN

The next order starts at `QUESTION_1` with no copied answer rows.

The new experience receives a fresh seven-question assignment through the existing question-selection system. Those answers belong only to this new order.

The browser cookie rotates to the new-order token and the UI starts the interview normally.

The previous `Experience` remains immutable for its prior quote/payment/Issue lifecycle in either path.

## Why `CHECKOUT_STARTED` Is the Repeat Boundary

Only a terminal checkout exposes the repeat-order choice automatically.

`PROFILE_COMPLETE`, `OBJECT_SELECTED`, `SIZE_CONFIRMED`, and `COMMITMENT_READY` are still the current in-progress order and must not be silently abandoned merely because the browser refreshes. General mid-order resume UX can be hardened separately; this repair does not turn ordinary refreshes into accidental new orders.

The reported lockout occurs because `CHECKOUT_STARTED` is terminal for the old order but bootstrap incorrectly tries to reuse it for new shopping.

## Lifecycle

### First purchase

1. Visitor starts a fresh `Experience` at `QUESTION_1`.
2. Seven answers advance the experience to `PROFILE_COMPLETE`.
3. Buyer selects object, size, and base color.
4. Contact and shipping are collected for that order.
5. Quote is created.
6. Checkout advances the experience to `CHECKOUT_STARTED`.
7. Safepay webhook or Reporter finalizes the payment independently.

### Repeat-order entry

1. Buyer visits `/begin` after beginning or completing the prior Safepay checkout.
2. `/api/experience/start` sees the current session references `CHECKOUT_STARTED`.
3. Server returns a repeat-order choice state without mutating the prior order.
4. UI presents two explicit actions: `KEEP PREVIOUS ANSWERS` and `ANSWER AGAIN`.
5. No new order is created until the customer chooses one of them.

### Repeat purchase — KEEP PREVIOUS ANSWERS

1. Customer chooses `KEEP PREVIOUS ANSWERS`.
2. Server deterministically derives the reuse-path next-order token from the current secret token.
3. In one idempotent persistence operation, server creates-or-recovers a new `Experience` at `PROFILE_COMPLETE`, copies the seven encrypted answers, and copies the exact question-set assignment snapshots.
4. Browser session cookie rotates to the new order token.
5. UI opens directly at `FORM / CURRENT ISSUE`.
6. New object/size/base/contact/shipping/quote/payment records attach only to the new experience.

### Repeat purchase — ANSWER AGAIN

1. Customer chooses `ANSWER AGAIN`.
2. Server deterministically derives the fresh-interview next-order token from the current secret token using a different namespace from the reuse path.
3. Server creates-or-recovers a new `Experience` at `QUESTION_1` with no copied answers.
4. A fresh seven-question assignment is created through the existing assignment service.
5. Browser session cookie rotates to the new order token.
6. UI begins the seven-question interview.
7. After completion, that order proceeds through product selection and checkout normally.

### Unlimited repetition

After any new order reaches `CHECKOUT_STARTED`, the same repeat-order choice appears again. A customer may therefore make any sequence such as:

- order 1: fresh answers → tee;
- order 2: keep previous answers → cap;
- order 3: answer again → tee;
- order 4: keep order 3 answers → hoodie;
- order 5: answer again → tote;
- and so on without an artificial order limit.

The “previous answers” offered for reuse are the answers attached to the immediately preceding completed order session represented by the current browser token. Reuse therefore follows the customer’s latest chosen creative profile rather than reaching backward unpredictably to an older order.

## Idempotency and Concurrency

The existing production schema already provides the constraints required to avoid a migration:

- `experiences.public_session_hash` is unique;
- `experience_answers` is unique by `(experience_id, question_id)`;
- question-set records are unique by experience and their slot/ordinal relationships.

The next token is deterministic for a given terminal source token and profile choice. Concurrent requests for the **same choice** therefore target the same next public-session hash and converge on one child experience.

The two choices use different derivation namespaces, so reuse and fresh-interview requests can never accidentally resolve to the same child experience.

The profile-choice endpoint must tolerate accidental double-clicks. Once one choice successfully rotates the browser cookie, later stale requests against the old terminal token must not mutate the selected child or overwrite the cookie with an incompatible path.

A dedicated repeat-order service/repository will perform child creation and, for reuse, encrypted-answer + question-set copy as one database operation/transaction using existing uniqueness constraints.

The derived token remains high-entropy because its input is the existing 256-bit random secret session token. Only hashes of session tokens are persisted. Knowing a stored session hash does not reveal the current or next browser token.

## Privacy and Data Boundaries

- Private interview plaintext is never read merely to reuse a profile.
- Reuse copies already-encrypted payload fields verbatim.
- Exact question assignment snapshots are copied with reused answers so semantic pairing cannot drift.
- `ANSWER AGAIN` copies neither old answers nor old question assignments; it receives a fresh assignment.
- Prior payment attempts remain attached to the prior experience.
- Prior Issues remain attached to the prior payment attempt.
- New contact/shipping/quote/payment state is isolated to the new experience.
- Contact verification and shipping are collected again for the new order in this repair; automatic address/contact reuse is a separate customer-profile feature.
- No raw answers, email addresses, shipping addresses, tokens, or payment secrets are emitted to logs or browser bootstrap payloads.

## API and Client Contract

`/api/experience/start` continues to return assigned questions and progression data for ordinary sessions and adds an explicit safe entry indicator, for example:

- `entryMode: 'interview'` for a new/in-progress interview;
- `entryMode: 'profile'` for a completed first profile before product selection;
- `entryMode: 'repeat-choice'` when the current order is terminal and the buyer must choose profile behavior.

For `repeat-choice`, no child order is created and no private answer payloads are returned.

Add a dedicated repeat-order choice action/endpoint that accepts only an enum such as `reuse` or `fresh`.

### Reuse response

- new order `stage` is `PROFILE_COMPLETE`;
- `interviewComplete` is true;
- new order entry mode routes directly to physical form selection;
- no private answer payloads are returned.

### Fresh response

- new order `stage` is `QUESTION_1`;
- `interviewComplete` is false;
- a fresh question assignment is returned/bootstrapped;
- no old answer payloads are returned.

`PublicInterviewExperience` passes entry mode into `MysteryExperience`.

`MysteryExperience` gains a repeat-order choice phase with two clear customer actions. First-time interview completion keeps the existing artistic `WE HAVE ENOUGH.` threshold before form unlock. Repeat-order choice is a different screen and must not masquerade as the original completion threshold.

## Repeat-Order Choice UX

The screen should preserve the mysterious ISSUED ONCE tone while making the decision unmistakable.

Suggested content structure:

- signal: `ANOTHER ISSUE`
- short message explaining that the previous answers can shape the next piece, or the customer can answer again for something different;
- primary actions:
  - `KEEP PREVIOUS ANSWERS`
  - `ANSWER AGAIN`

Neither option should be visually hidden or framed as an error-recovery action. Repeat purchasing is normal product behavior, not an exception.

The choice screen must work on desktop and mobile and must remain usable with keyboard/focus navigation.

## Dummy Payment Test Strategy

Testing must prove the lifecycle, not merely mock the final button.

### Server/unit/integration regression

Use fake payment and repository fixtures that exercise actual domain transitions:

1. Complete order 1 with a fixed seven-question assignment and seven answers.
2. Select tee, size, base, contact, shipping, and quote.
3. Start dummy checkout and record payment attempt 1; experience 1 becomes `CHECKOUT_STARTED`.
4. Bootstrap again and assert `repeat-choice` is returned without creating a child order.
5. Choose `reuse` twice concurrently and assert both requests converge on exactly one experience 2.
6. Assert experience 2 is distinct from experience 1 and is at `PROFILE_COMPLETE`.
7. Assert exactly seven encrypted answer rows and the exact seven question assignment snapshots were copied to experience 2.
8. Assert experience 1 remains `CHECKOUT_STARTED` and payment attempt 1 is unchanged.
9. Complete experience 2 with a different product, preferably cap/hat where catalog allows, and start dummy checkout/payment attempt 2.
10. Bootstrap from experience 2 and assert `repeat-choice` again.
11. Choose `fresh` and assert exactly one experience 3 starts at `QUESTION_1` with zero copied answer rows.
12. Assert experience 3 receives a fresh seven-question assignment rather than the copied order-2 assignment.
13. Complete the seven new answers, configure another product, and start dummy checkout/payment attempt 3.
14. Assert payment attempts 1, 2, and 3 have distinct IDs and distinct experience IDs.
15. Assert experiences 1 and 2 remain unchanged after experience 3 begins.
16. Assert no manufacturing job is created by the test.

### Browser/Playwright regression

Run desktop Chrome and mobile Chromium through three consecutive orders in one browser context:

#### Order 1

1. Complete seven questions.
2. Choose tee and complete physical/contact/shipping flow.
3. Start intercepted/dummy Safepay checkout.
4. Simulate leaving/returning from checkout and re-enter `/begin`.

#### Order 2 — KEEP PREVIOUS ANSWERS

5. Verify the repeat-order choice screen is visible.
6. Click `KEEP PREVIOUS ANSWERS`.
7. Verify no interview questions are shown.
8. Verify product selection opens and choose cap/hat where available.
9. Complete the second order and reach dummy checkout 2.
10. Verify the second quote/payment identity differs from order 1.

#### Order 3 — ANSWER AGAIN

11. Re-enter `/begin` after dummy checkout 2.
12. Verify the repeat-order choice screen is visible again.
13. Click `ANSWER AGAIN`.
14. Verify a fresh seven-question interview starts at `01 / 07`.
15. Complete the new interview and then choose another product, including another tee if desired.
16. Complete the third order and reach dummy checkout 3.
17. Verify all three checkout/payment identities are distinct.
18. Capture screenshots/artifacts for the repeat-choice screen, reuse path product selection, fresh-interview start, and third commitment/checkout state.
19. Assert no browser-visible state from an earlier order prevents a later one.

### Release verification

Before merge and after canonical merge:

- targeted RED/GREEN repeat-order tests;
- full unit/integration suite;
- typecheck;
- lint;
- production build;
- Vercel preview/deployment status;
- Browser QA desktop/mobile;
- live production smoke that does not create a real charge.

## Payment Safety

The requested dummy payments are non-charging test payments through a fake/intercepted payment gateway. They must not call production Safepay with a real charge.

Real Safepay checkout behavior, `webhooks=true`, signed webhook verification, Reporter fallback, and existing paid-order idempotency remain unchanged.

## Database/Migration Boundary

Schema inspection confirms the current uniqueness constraints are sufficient for deterministic, idempotent repeat-order derivation. No new production migration is required for this repair.

Migration `0029_creator_referrals.sql` remains untouched and separately owner-gated.

If implementation evidence contradicts this assumption, work must stop and escalate rather than silently changing production schema.

## Non-Goals

- No account/login system.
- No permanent customer profile table in this repair.
- No automatic reuse of shipping addresses or contact verification across orders.
- No referral migration rollout.
- No Printful production confirmation.
- No real-money payment solely for testing.
- No silent creation of a new order from ordinary mid-order refreshes before checkout.
- No automatic forced reuse of previous interview answers.
- No automatic forced fresh interview for every repeat order.

## Success Criteria

- Same customer/browser can place order 1, order 2, order 3, and beyond.
- Every repeat order explicitly offers `KEEP PREVIOUS ANSWERS` or `ANSWER AGAIN`.
- Neither profile option is silently forced.
- Reuse preserves the exact seven encrypted answers and exact assigned-question semantics from the immediately previous order profile.
- Fresh interview starts with a new seven-question assignment and no copied answers.
- Every order has independent experience/order state and payment attempt.
- Back/return from a terminal payment checkout can never permanently lock future purchases.
- Order 1 tee → order 2 keep answers + cap → order 3 answer again + another product reaches three separate dummy checkouts in automated browser tests on desktop and mobile.
- Concurrent same-choice repeat-order requests converge on one new experience.
- Earlier orders remain unchanged after later orders begin.
- No new production migration is applied as part of this fix.
