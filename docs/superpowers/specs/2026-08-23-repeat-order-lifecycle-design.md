# Repeat-Order Lifecycle Design

Date: 2026-08-23
Project: ISSUED ONCE
Canonical branch: `feat/mystery-foundation`

## Problem

A browser session currently owns one `Experience` row. That row stores both the reusable seven-question profile progression and the current purchase progression. After the first order reaches checkout, the same row advances to `CHECKOUT_STARTED` and remains there.

On a later visit, `/api/experience/start` finds the existing session row and reuses it. The UI therefore sees the interview as complete, but the physical-selection API still receives the terminal order row. `ObjectSelectionService` only accepts `PROFILE_COMPLETE`, so selecting another tee, cap, hoodie, or tote fails with a state conflict. Returning/backing out of Safepay can therefore strand the buyer on the completed-profile screen without a valid path to another order.

This is a lifecycle-model bug, not a button bug.

## Product Requirement

A customer must be able to place an unlimited number of independent orders from the same browser/customer context.

The seven private interview answers are reusable by default. A repeat buyer should not be forced to answer the same seven questions again merely because they want another physical form.

Each order must have independent mutable state. Starting a second order must never mutate, reopen, reset, supersede, or corrupt the first order, its quote, payment attempt, Issue, notification, or manufacturing state.

## Design Decision

Use a fresh `Experience`/order snapshot after a terminal checkout while carrying forward the previously completed interview profile.

Do **not** reset an old `Experience` row back to `PROFILE_COMPLETE`. That would change state under an already-created quote/payment and make order history unsafe.

Do **not** introduce the full permanent customer-profile/order schema in this repair. That is the eventual clean model, but it would require a new production migration and is intentionally outside this incident because production migration `0029_creator_referrals.sql` remains separately owner-gated.

When bootstrap detects that the browser session references an `Experience` at `CHECKOUT_STARTED`, it derives a deterministic next-order session token from the current secret session token using a domain-separated one-way hash, then asks a dedicated repeat-order repository to atomically create-or-recover the next order snapshot.

The new `Experience` starts at `PROFILE_COMPLETE`. The repository copies:

- all seven encrypted answer payloads without decrypting them;
- the exact seven assigned question-set snapshots (question/version/family/prompt/kind/options) so copied answers retain their original meaning.

The browser cookie rotates to the derived next-order token. Bootstrap marks this as repeat-order entry, and the client opens directly at physical form selection instead of showing the completed-interview threshold again.

The previous `Experience` remains immutable for its prior quote/payment/Issue lifecycle.

## Why `CHECKOUT_STARTED` Is the Repeat Boundary

Only a terminal checkout starts a new order automatically.

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

### Repeat purchase

1. Buyer visits `/begin` after beginning or completing the prior Safepay checkout.
2. `/api/experience/start` sees the current session references `CHECKOUT_STARTED`.
3. Server deterministically derives the next-order session token from the current secret token.
4. In one idempotent persistence operation, server creates-or-recovers a new `Experience` at `PROFILE_COMPLETE`, copies the seven encrypted answers, and copies the exact question-set assignment snapshots.
5. Browser session cookie rotates to the new order token.
6. Bootstrap identifies repeat-order entry.
7. UI opens directly at `FORM / CURRENT ISSUE` without asking the seven questions again and without trapping the buyer on `WE HAVE ENOUGH.`.
8. New object/size/base/contact/shipping/quote/payment records attach only to the new experience.
9. After that order reaches `CHECKOUT_STARTED`, the same process can derive order 3, order 4, and so on indefinitely.

## Idempotency and Concurrency

The existing production schema already provides the constraints required to avoid a migration:

- `experiences.public_session_hash` is unique;
- `experience_answers` is unique by `(experience_id, question_id)`;
- question-set records are unique by experience and their slot/ordinal relationships.

The next token is deterministic for a given current secret token. Concurrent `/api/experience/start` requests therefore target the same next public-session hash.

A dedicated `RepeatOrderRepository` will perform the create/recover + encrypted-answer copy + question-set copy as one database operation/transaction using existing uniqueness constraints. Simultaneous starts converge on the same child experience rather than creating orphan order rows.

The derived token remains high-entropy because its input is the existing 256-bit random secret session token. Only hashes of session tokens are persisted. Knowing a stored session hash does not reveal the current or next browser token.

## Privacy and Data Boundaries

- Private interview plaintext is never read merely to start another order.
- Reuse copies already-encrypted payload fields verbatim.
- Exact question assignment snapshots are copied with the answers so semantic pairing cannot drift.
- Prior payment attempts remain attached to the prior experience.
- Prior Issues remain attached to the prior payment attempt.
- New contact/shipping/quote/payment state is isolated to the new experience.
- Contact verification and shipping are collected again for the new order in this repair; automatic address/contact reuse is a separate customer-profile feature.
- No raw answers, email addresses, shipping addresses, tokens, or payment secrets are emitted to logs or browser bootstrap payloads.

## API and Client Contract

`/api/experience/start` continues to return the assigned questions and progression data but adds an explicit safe entry indicator for the client, such as `entryMode: 'interview' | 'profile' | 'repeat-order'`.

For repeat-order bootstrap:

- `stage` is `PROFILE_COMPLETE` for the new order;
- `interviewComplete` is true;
- `entryMode` is `repeat-order`;
- no private answer payloads are returned.

`PublicInterviewExperience` passes the entry mode into `MysteryExperience`. `MysteryExperience` initializes repeat-order entry directly at the `form` phase. First-time interview completion keeps the existing artistic `WE HAVE ENOUGH.` threshold before form unlock.

## Dummy Payment Test Strategy

Testing must prove the lifecycle, not merely mock the final button.

### Server/unit/integration regression

Use a fake payment gateway and repository fixtures that exercise actual domain transitions:

1. Complete one seven-question profile with a fixed assigned question set.
2. Select tee, size, base, contact, shipping, and quote.
3. Start dummy checkout and record a first payment attempt; first experience becomes `CHECKOUT_STARTED`.
4. Bootstrap twice concurrently with the same original session token.
5. Assert both calls resolve to the same derived next-order token/experience.
6. Assert the second experience is distinct from the first and is at `PROFILE_COMPLETE`.
7. Assert exactly seven encrypted answer rows were copied without decrypting them.
8. Assert the exact seven question assignment snapshots were copied unchanged.
9. Assert the first experience remains `CHECKOUT_STARTED` and its payment attempt is unchanged.
10. Select a different form (prefer hat/cap where catalog allows), complete its size/base/contact/shipping/quote path, and start a second dummy checkout.
11. Assert the two payment attempts have distinct IDs and distinct experience IDs.
12. Assert no manufacturing job is created by the test.

### Browser/Playwright regression

Run desktop Chrome and mobile Chromium:

1. Complete first customer flow through tee checkout using intercepted/dummy Safepay.
2. Simulate leaving/returning from checkout and re-enter `/begin` with the same browser context.
3. Verify the seven-question interview is not shown again.
4. Verify the repeat buyer lands directly on `FORM / CURRENT ISSUE` rather than being trapped on `WE HAVE ENOUGH.`.
5. Choose a different product (prefer hat/cap), proceed through available fit/base/contact/shipping path, and reach a second dummy checkout.
6. Assert the second checkout uses a different quote/payment identity.
7. Capture screenshots/artifacts of repeat-order product selection and second commitment/checkout state.
8. Assert no browser-visible state from the first order prevents the second.

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

The requested dummy payment is a non-charging test payment through a fake/intercepted payment gateway. It must not call production Safepay with a real charge.

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

## Success Criteria

- Same customer/browser can place order 1, order 2, order 3, and beyond.
- Existing seven-question profile and exact assigned-question semantics are reused by default.
- Every order has independent experience/order state and payment attempt.
- Back/return from a terminal payment checkout can never permanently lock future purchases.
- Repeat-order entry goes directly to physical form selection.
- A tee purchase followed by a cap/hat purchase reaches a second dummy checkout in automated browser tests on desktop and mobile.
- Concurrent repeat-order bootstrap calls converge on one new experience.
- First order remains unchanged after second order begins.
- No new production migration is applied as part of this fix.
