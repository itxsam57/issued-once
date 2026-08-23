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

Use a fresh `Experience`/order snapshot for every new purchase cycle while carrying forward the previously completed interview profile.

Do **not** reset an old `Experience` row back to `PROFILE_COMPLETE`. That would change state under an already-created quote/payment and make order history unsafe.

Do **not** introduce the full permanent customer-profile/order schema in this repair. That is the eventual clean model, but it would require a new production migration and is intentionally outside this incident because production migration `0029_creator_referrals.sql` remains separately owner-gated.

Instead, when bootstrap detects a session whose existing `Experience` is already in an order-progress stage (`OBJECT_SELECTED`, `SIZE_CONFIRMED`, `COMMITMENT_READY`, or `CHECKOUT_STARTED`), it creates a new `Experience` row for the next order at `PROFILE_COMPLETE`, copies the completed seven encrypted answers into the new experience without decrypting them, assigns the same question/profile semantics, rotates the browser session cookie to the new experience, and returns bootstrap state that opens the physical-form path immediately.

The previous `Experience` remains immutable for its prior order/payment lifecycle.

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

1. Buyer visits `/begin` or returns from/leaves the payment page and later re-enters the shopping flow.
2. `/api/experience/start` sees the current session points to an already-started order stage.
3. Server creates a new `Experience` row with a new session token and `PROFILE_COMPLETE` stage.
4. Server copies the prior completed encrypted answers to the new experience without exposing plaintext.
5. Browser session cookie rotates to the new order.
6. UI treats the interview as complete and lets the buyer unlock/select a physical form immediately.
7. New object/size/base/contact/shipping/quote/payment records attach only to the new experience.
8. This can repeat indefinitely.

## Privacy and Data Boundaries

- Private interview plaintext is never read merely to start another order.
- Reuse happens by copying already-encrypted stored payloads.
- Prior payment attempts remain attached to the prior experience.
- Prior Issues remain attached to the prior payment attempt.
- New contact/shipping/quote/payment state is isolated to the new experience unless a separate future customer-profile feature deliberately introduces reusable address/contact records.
- No raw answers, email addresses, shipping addresses, tokens, or payment secrets are emitted to logs or browser bootstrap payloads.

## Concurrency and Idempotency

Repeat-order bootstrap must be safe under refreshes/double requests.

The server should avoid creating multiple active replacement experiences from concurrent `/api/experience/start` calls. The implementation must use a repository-level or deterministic transition/clone primitive that makes "derive next order from this completed source experience" idempotent for the browser-session handoff.

If the currently referenced experience is still `QUESTION_1` through `PROFILE_COMPLETE`, bootstrap continues/reuses it normally. Only an experience that has already entered order-specific mutable stages triggers a fresh order snapshot.

## UI Behavior

- A first-time customer still sees the seven-question interview.
- A returning/repeat customer with a completed profile should not be visually presented as blocked by `WE HAVE ENOUGH.` with no next action.
- They should be able to proceed to `FORM / CURRENT ISSUE` and choose a new form.
- Choosing a cap after a tee order must work.
- The customer can still deliberately start over with a new profile in a future feature; that is not required for this repair.

## Dummy Payment Test Strategy

Testing must prove the lifecycle, not merely mock the final button.

### Server/unit/integration regression

Create a fake payment gateway and persistent in-memory/repository fixture that exercises real domain transitions:

1. Complete one seven-question profile.
2. Select tee, size, base, contact, shipping, quote.
3. Start dummy checkout and record a first payment attempt.
4. Bootstrap again with the same browser/customer context.
5. Assert a distinct second experience/order snapshot is returned at `PROFILE_COMPLETE`.
6. Assert the seven encrypted answer records are present for the new experience without plaintext exposure.
7. Assert the first experience remains `CHECKOUT_STARTED` and its payment attempt is unchanged.
8. Select a different form (cap/hat where catalog allows), complete its configuration, and start a second dummy checkout.
9. Assert the two payment attempts have distinct IDs and distinct experience IDs.
10. Assert no manufacturing job is created by the test.

### Browser/Playwright regression

Run desktop Chrome and mobile Chromium:

1. Complete first customer flow through tee checkout using intercepted/dummy Safepay.
2. Simulate leaving/returning from checkout and re-entering `/begin`.
3. Verify repeat customer skips repeated question entry and can unlock form selection.
4. Choose a different product (prefer hat/cap), proceed through available fit/base path, and reach a second dummy checkout.
5. Capture screenshots/artifacts of repeat-order product selection and second commitment/checkout state.
6. Assert no browser-visible state from the first order prevents the second.

### Release verification

Before merge and after canonical merge:

- full unit/integration suite
- typecheck
- lint
- production build
- Vercel preview/deployment status
- Browser QA desktop/mobile
- live production smoke that does not create a real charge

## Payment Safety

The requested dummy payment is a non-charging test payment through a fake/intercepted payment gateway. It must not call production Safepay with a real charge.

Real Safepay checkout behavior, `webhooks=true`, signed webhook verification, Reporter fallback, and existing paid-order idempotency remain unchanged.

## Database/Migration Boundary

This repair should reuse the existing schema if an idempotent clone/derive operation can be implemented safely with current tables and constraints.

If investigation during implementation proves the current schema cannot make repeat-order bootstrap concurrency-safe without a schema change, implementation must stop and upgrade the change to a separately owner-approved migration design. It must not silently consume or modify migration `0029_creator_referrals.sql`.

## Non-Goals

- No account/login system.
- No permanent customer profile table in this repair.
- No automatic reuse of shipping addresses or contact verification across orders.
- No referral migration rollout.
- No Printful production confirmation.
- No real-money payment solely for testing.

## Success Criteria

- Same customer/browser can place order 1, order 2, order 3, and beyond.
- Existing seven-question profile is reused by default.
- Every order has independent experience/order state and payment attempt.
- Back/return from payment can never permanently lock future purchases.
- A tee purchase followed by a cap/hat purchase reaches a second dummy checkout in automated browser tests.
- First order remains unchanged after second order begins.
- No new production migration is applied as part of this fix unless separately approved after an explicit architecture escalation.
