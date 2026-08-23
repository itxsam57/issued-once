# ISSUED ONCE workflow audit, OTP continuity, and live Owner OS design

Date: 2026-08-23
Canonical base: `feat/mystery-foundation` at `209787cba3f0e8a750624aa18fef7fc65f06218b`
Working branch: `fix/workflow-audit-otp-live-owner-20260823`

## Goal

Before the next owner test, make the customer purchase journey and Owner OS observable, repeatable, and release-gated across every currently sellable form. The repair must address the production failures already observed, then prove the entire supported workflow instead of stopping after a narrow regression test.

The current sellable catalog is:
- Tee: USD 32.00, XS through 2XL, Bone / Black / Ash / Navy / Forest.
- Hat: USD 34.00, OS, Bone / Black.
- Tote: USD 36.00, OS, Bone / Black.

## Production evidence that drives this design

1. A newest real payment exists in production even though it was not visible to the owner in the already-open dashboard. Payment attempt `e6af01a5-1639-4184-b155-d69c842013e7` is `PAID`, USD 32.00, and has canonical Issue `IO-GUUM-8UR9` in `BEING_INTERPRETED`.
2. Owner OS Home and Sales panels currently fetch only on mount. A long-lived owner session can therefore display stale business truth indefinitely.
3. The repeat-order browser path is correctly creating isolated child Experiences, but verified contact is not inherited. The paid parent Experience `2b0af384-d1af-481f-99ec-1ad3e380e6c1` has a verified contact; its later `repeat:fresh` child `0c2d6125-c8f5-4b40-b3b0-55e5876821d8` does not.
4. The latest OTP challenge on that repeat child exhausted all five attempts without verification.
5. Resend OTP delivery currently gives every message the identical subject `Your ISSUED ONCE code`. Gmail evidence shows many different valid OTP messages collapsed into the same conversation, making the newest code ambiguous to a human.
6. The client-side `postJson` helper discards server error payloads, and `ContactVerification` converts every verification failure into `That code did not match.` Expired, consumed, locked, stale-challenge, and runtime failures are therefore presented as the same false diagnosis.

## Chosen behavior

A verified email carries forward to subsequent orders created from the same authenticated browser/session chain. A fresh OTP is required only when the customer explicitly chooses to change the email.

This applies to both repeat choices:
- `KEEP PREVIOUS ANSWERS`
- `ANSWER AGAIN`

The order Experience remains isolated. Only the verified contact snapshot is inherited. OTP challenges are never copied. Shipping is not silently reused in this repair; the customer supplies or confirms delivery information per order.

## Architecture

### 1. Repeat-order verified-contact inheritance

Extend repeat-order resolution so a child Experience may receive a new verified-contact row copied from the source Experience when the source has one.

Properties:
- New contact row ID for the child.
- Preserve encrypted email payload, email lookup hash, and original verification timestamp.
- Set child ownership to the new Experience ID.
- Never copy `otp_challenges`.
- Perform contact inheritance in the same PostgreSQL transaction that creates/resolves the repeat child so the child cannot be partially initialized.
- Apply to both `repeat:reuse` and `repeat:fresh`.
- Preserve existing race/idempotency semantics: an already-resolved repeat child must not gain duplicate contact rows.
- No production schema migration is required.

The child must still be able to replace the inherited verified contact by completing a new OTP verification for another address; the existing per-Experience verified-contact upsert already supports replacement.

### 2. Contact-stage UX and API truth

Add a small contact-status read path for the current Experience. It returns only the minimum required state, e.g. `{ verified: true }`; it does not return plaintext email.

When the customer reaches the contact stage:
- If no verified contact exists, show the normal email + OTP flow.
- If an inherited verified contact exists, show `EMAIL VERIFIED FROM YOUR LAST ORDER` with two choices:
  - `USE VERIFIED EMAIL` -> continue to shipping without another OTP.
  - `USE DIFFERENT EMAIL` -> open the normal email + OTP flow and replace the contact after successful verification.

This keeps the repeat purchase fast without removing the customer’s ability to change identity/contact information.

### 3. OTP delivery disambiguation

Each OTP email gets a unique request tag derived from the challenge ID. The tag is not a secret.

Example:
- Subject: `Your ISSUED ONCE code · 6C6BA8D3`
- Body includes `Request 6C6BA8D3` beside the six-digit code.
- The browser shows the same request tag after sending the code.

This prevents Gmail from collapsing every OTP into one indistinguishable conversation and gives the customer a deterministic way to match the email to the active challenge.

Do not place customer email, session token, private answers, or other private data in the subject/tag.

### 4. OTP error preservation and recovery

Replace the generic `postJson` failure with a typed client API error that preserves safe server `error` text and HTTP status.

Contact verification must distinguish at least:
- wrong six-digit code, with remaining attempts if available;
- attempt limit exhausted;
- expired code;
- already-used/stale challenge;
- resend cooldown;
- service unavailable.

Recovery rules:
- Wrong code keeps the active challenge and allows another attempt until exhausted.
- Expired/used/locked challenge exposes `SEND NEW CODE` after cooldown instead of trapping the customer.
- Changing email clears challenge/code/error state.
- Sending a newer code invalidates the previous active challenge as it does today.
- Generic non-contact flows may still use a concise fallback message, but safe backend failure reasons must no longer be destroyed before a component can handle them.

The server never returns OTP hashes or secret material.

### 5. Live Owner OS truth

Owner OS must not behave like a static snapshot.

Create a small reusable live-query mechanism for read-only owner resources with:
- immediate fetch on mount;
- refresh when the browser tab becomes visible/focused;
- periodic refresh while visible (target 10 seconds for Home/Attention, 15-30 seconds for list/analytics panels);
- explicit `CHECK AGAIN` / `REFRESH` control where the panel represents operational truth;
- `cache: no-store` preserved;
- in-flight request deduplication / stale-response protection;
- visible `UPDATED <time>` indicator on the Home panel.

Minimum panels that must use fresh data for this release gate:
- Home dashboard
- Attention
- Issues
- Sales
- Designer
- Manufacturing
- Support
- Customers
- System/readiness

Mutation actions already refresh their local state where appropriate; the live-query mechanism closes the external-event gap, especially Safepay/webhook/Reporter updates that happen while Owner OS is open.

Home `Live activity` remains the canonical fast visual confirmation that a paid Issue entered the system. The newest real payment must appear without a manual page reload after the next production deployment.

### 6. End-to-end QA matrix

Testing is part of the feature, not a follow-up.

#### Customer browser tests, desktop + mobile

For every sellable product, execute the complete journey with isolated dummy/preview payments:

1. Tee -> valid size/color -> email verification -> required shipping fields including phone and province/region -> commitment -> dummy checkout.
2. Hat -> OS/color -> contact path -> shipping -> commitment -> dummy checkout.
3. Tote -> OS/color -> contact path -> shipping -> commitment -> dummy checkout.

Also cover:
- all seven interview questions;
- `KEEP PREVIOUS ANSWERS`;
- `ANSWER AGAIN`;
- repeat child receives verified contact and offers `USE VERIFIED EMAIL`;
- `USE DIFFERENT EMAIL` requests and verifies a new OTP;
- wrong OTP then correct OTP;
- expired OTP -> recover with new code;
- five wrong attempts -> recover with new code;
- stale previous OTP after resend is rejected while newest code succeeds;
- unique OTP request tags are rendered;
- change-email path;
- cancel/back from checkout;
- three or more sequential orders remain isolated;
- each dummy payment attempt ID and quote is distinct;
- no manufacturing job is created by preview/dummy flow;
- unavailable/invalid object, size, color, address and phone requests are rejected safely;
- no button becomes a no-op without visible feedback.

Dummy payment testing must use the existing safe preview/fake gateway path. Do not create extra real Safepay charges solely for QA.

#### Service/repository tests

Add RED tests first for:
- repeat child contact inheritance in both repeat modes;
- no OTP challenge inheritance;
- idempotent/raced repeat resolution does not duplicate contacts;
- inherited contact can be replaced by successful new OTP;
- request-tagged Resend subject/body;
- safe OTP error mapping and remaining-attempt behavior;
- Owner OS live-query refresh/focus/stale-response behavior;
- each catalog form creates the expected quote amount/currency.

#### Owner OS browser tests, desktop + mobile

Exercise every current room and action:
- login/logout/session protection;
- Home automatic refresh and updated timestamp;
- Attention refresh and recovery action contracts;
- Issues list/filter/pagination/detail/private reveal reason gate;
- Designer actions and disabled/unavailable provider states;
- Manufacturing controls with production confirmation still disabled;
- Sales 7/30/90/lifetime windows;
- Customers;
- Support;
- Website catalog pricing and question editing;
- System/readiness;
- Audit.

A mocked owner API test is not enough for freshness. At least one test must change the mocked server response after mount and prove the visible dashboard/list updates automatically.

### 7. Production verification after merge

After CI, build, desktop/mobile browser QA, review, and Vercel deployment pass:

- Read production Neon and confirm newest paid payment and Issue still exist exactly once.
- Confirm Owner OS API repository queries include that Issue/payment in their current window.
- Confirm production payment/Issue/design/notification counts and no unintended duplicates.
- Confirm manufacturing job count remains unchanged/zero unless an independently approved manufacturing action occurred.
- Confirm migration `0029_creator_referrals.sql` remains unapplied.
- Confirm no referral signing key work is performed.
- Confirm Printful production confirmation remains disabled.
- Send one normal production OTP only if needed for verification; use Gmail to confirm the unique request-tagged message and matching delivery. Do not disclose the OTP in logs or reports.
- Do not create an extra real Safepay payment solely to prove dashboard refresh. The already-paid newest Issue is sufficient to verify data visibility; dummy payments prove UI flow.

## Failure handling

- If verified-contact inheritance would require a production schema change, stop at `OWNER_REQUIRED` and request explicit migration approval rather than improvising a migration. The current schema is expected to support the design without one.
- If any customer product journey fails, keep the release gate closed until a RED regression captures it and the root cause is fixed.
- If Owner OS cannot show canonical paid data that is present in Neon, treat that as a release blocker even if payment processing itself is correct.
- If live production verification would create a charge or enable manufacturing, use preview/read-only proof instead.

## Non-goals / preserved gates

- Do not apply migration `0029_creator_referrals.sql`.
- Do not configure `REFERRAL_ATTRIBUTION_SIGNING_KEY`.
- Do not enable Printful production confirmation.
- Do not use browser navigation as payment truth.
- Do not weaken OTP rate limits or expose private contact data.
- Do not silently merge multiple purchases into one Experience/payment record.

## Release definition

This repair is complete only when:
1. Tee, hat, and tote complete end-to-end preview purchases on desktop and mobile.
2. Repeat ordering works indefinitely with isolated Experiences.
3. Same-browser repeat orders can reuse a previously verified email without another OTP, while changing email still requires OTP.
4. OTP messages are unambiguous and all challenge failure states recover correctly.
5. Owner OS refreshes canonical payment/Issue state while left open and surfaces the newest real paid Issue.
6. Every current Owner OS room/button has an automated interaction test or an explicit gated/disabled-state assertion.
7. Unit/integration tests, typecheck, lint, production build, CI, browser QA, code review, and deployment verification are green.
8. Production invariants remain intact: no unapproved migration, no duplicate Issue, no unintended manufacturing, no secret exposure.
