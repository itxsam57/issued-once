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
2. Owner OS Home and Sales currently fetch on mount and can remain stale in a long-lived owner session.
3. Repeat orders correctly create isolated child Experiences, but the new child does not have safe continuity knowledge of a previously verified email.
4. The latest repeat-order OTP challenge exhausted all five attempts without verification.
5. Resend currently gives every OTP the identical subject `Your ISSUED ONCE code`. Gmail evidence shows many different codes grouped into the same conversation, making the newest code ambiguous to a human.
6. The browser discards safe server error detail and presents expired, stale, locked, unavailable, and genuinely wrong OTPs as the same misleading `That code did not match.` message.

## Chosen contact behavior

A repeat order must **not silently inherit or automatically activate a verified email**.

The customer always reaches an email field and types the address they want to use for that order.

If the entered normalized email matches an email that was verified on the immediately preceding order **and the same browser has cryptographic continuity proof from that repeat transition**, show:

`THIS EMAIL IS ALREADY VERIFIED.`

Actions:
- `USE THIS EMAIL` -> explicitly reuse the prior verification for the new isolated order and continue to shipping without sending another OTP.
- `CHANGE EMAIL` -> return to/edit the email field. A different email requires a fresh OTP.

If the entered email does not match the prior verified email, or the browser does not possess valid continuity proof, start the normal OTP flow.

Knowing another person's email address must never be sufficient to bypass OTP.

This behavior applies after both repeat choices:
- `KEEP PREVIOUS ANSWERS`
- `ANSWER AGAIN`

Shipping is not silently reused; delivery information remains per-order.

## Architecture

### 1. Verified-email continuity without automatic carry-forward

Do **not** create a `verified_contacts` row when the repeat child Experience is created.

When a repeat transition is created from a source Experience that has a verified contact, mint a short-lived, HttpOnly, Secure, SameSite continuity cookie/claim scoped to the new child. The claim contains only the minimum server-verifiable references required to prove:
- child Experience identity;
- source verified-contact identity;
- source email lookup hash;
- expiry/version.

The claim is integrity-protected with an existing server-side identity secret; no plaintext email, OTP, session token, answer, address, or payment data is exposed to JavaScript.

The repeat child remains unverified until the customer explicitly chooses `USE THIS EMAIL` after entering the matching address.

On `USE THIS EMAIL`:
- verify the continuity claim belongs to the current child and is unexpired;
- hash the normalized entered email server-side;
- require it to equal the proven source email hash;
- copy the source encrypted verified-contact snapshot into a **new** contact row owned by the child;
- preserve the original verification timestamp as provenance and record the new row/update time normally;
- consume or rotate the continuity claim so it cannot authorize another unrelated Experience.

Never copy `otp_challenges`.

If the customer chooses a different address, the prior continuity proof does not verify it; normal OTP is mandatory.

No production schema migration is expected. If implementation proves a schema change is required, stop at `OWNER_REQUIRED` instead of improvising a migration.

Legacy repeat children created before this repair may not possess continuity proof. They must fall back to the normal OTP flow rather than guessing ancestry or weakening identity checks.

### 2. Contact-stage UX and API truth

The contact stage begins with the email field on every order.

Submitting an email performs a safe server-side contact decision:
- valid continuity claim + matching verified email -> return a non-secret `previouslyVerified: true` decision and render the explicit reuse prompt;
- otherwise -> create/send a fresh OTP challenge and render the OTP screen.

The server never sends the previous plaintext email to the browser merely to prefill or reveal it.

Reuse prompt:
- heading: `THIS EMAIL IS ALREADY VERIFIED.`
- primary: `USE THIS EMAIL`
- secondary: `CHANGE EMAIL`

`USE THIS EMAIL` persists the verified contact for the current child before shipping is unlocked. `CHANGE EMAIL` clears any transient decision state and keeps the customer at the email entry step.

### 3. OTP delivery disambiguation

Each OTP email gets a unique request tag derived from the challenge ID. The tag is not a secret.

Example:
- Subject: `Your ISSUED ONCE code · 6C6BA8D3`
- Body includes `Request 6C6BA8D3` beside the six-digit code.
- The browser shows the same request tag after sending the code.

This prevents every OTP from appearing as one indistinguishable Gmail conversation and lets the customer match the email to the active challenge.

No customer email, session token, private answer, address, or other private data goes in the subject/tag.

### 4. OTP error preservation and recovery

Replace the generic client failure path with a typed API error that preserves safe server error text/status for the component that owns recovery.

Distinguish at least:
- wrong six-digit code, with remaining attempts when safe;
- attempt limit exhausted;
- expired code;
- already-used/stale challenge;
- resend cooldown;
- service unavailable.

Recovery rules:
- Wrong code keeps the active challenge until exhausted.
- Expired/used/locked challenge exposes `SEND NEW CODE` after cooldown instead of trapping the customer.
- Changing email clears challenge/code/error state.
- Sending a newer code invalidates the previous active challenge.
- A stale older code cannot verify after a newer challenge exists.
- Backend responses never expose OTP hashes or secret material.

### 5. Live Owner OS truth

Owner OS must not behave like a static snapshot.

Create one reusable read-only live-query mechanism with:
- immediate fetch on mount;
- refresh on browser focus/visibility return;
- periodic refresh while visible (about 10 seconds for Home/Attention and 15-30 seconds for list/analytics rooms);
- explicit `CHECK AGAIN` / `REFRESH` where operationally useful;
- `cache: no-store` preserved;
- in-flight deduplication and stale-response protection;
- visible `UPDATED <time>` on Home.

Minimum live rooms for this release gate:
- Home
- Attention
- Issues
- Sales
- Designer
- Manufacturing
- Support
- Customers
- System/readiness

The newest real paid Issue must become visible without requiring the owner to reload the page.

### 6. End-to-end QA matrix

Testing is part of the repair.

#### Customer browser tests — desktop + mobile

Complete preview/dummy purchases for every currently sellable form:
1. Tee -> valid size/color -> contact -> shipping including phone and province/region -> commitment -> dummy checkout.
2. Hat -> OS/color -> contact -> shipping -> commitment -> dummy checkout.
3. Tote -> OS/color -> contact -> shipping -> commitment -> dummy checkout.

Also prove:
- all seven interview questions;
- `KEEP PREVIOUS ANSWERS`;
- `ANSWER AGAIN`;
- repeat child is **not** automatically verified;
- entering the previously verified email with valid same-browser continuity shows `THIS EMAIL IS ALREADY VERIFIED.`;
- `USE THIS EMAIL` skips a new OTP only after explicit customer choice;
- `CHANGE EMAIL` keeps the customer at email entry;
- a different email always requires OTP;
- missing/invalid continuity proof cannot reuse verification even if the email text matches;
- wrong OTP then correct OTP;
- expired OTP -> new-code recovery;
- five wrong attempts -> new-code recovery;
- stale previous OTP after resend is rejected while newest succeeds;
- unique OTP request tags are rendered;
- checkout cancel/back recovery;
- three or more sequential orders remain isolated;
- each dummy payment attempt ID and quote is distinct;
- preview/dummy flow creates no manufacturing job;
- invalid/unavailable object, size, color, address and phone requests are rejected visibly;
- no customer-facing button is a silent no-op.

Dummy payment tests use only the existing safe preview/fake gateway path. No extra real Safepay charge is created for QA.

#### Service/repository tests — RED first

Add RED tests for:
- repeat transition creates continuity proof but no verified child contact;
- continuity proof is bound to the child Experience and expires;
- matching entered email produces `previouslyVerified: true` only with valid proof;
- same email without proof still requires OTP;
- different email with valid proof still requires OTP;
- explicit `USE THIS EMAIL` copies one verified contact into the child idempotently;
- no OTP challenge inheritance;
- raced/retried reuse cannot create duplicate child contacts;
- a reused contact can later be replaced only through a successful OTP for another address;
- request-tagged Resend subject/body;
- safe OTP error mapping/remaining-attempt behavior;
- Owner OS live-query mount/focus/interval/stale-response behavior;
- every catalog form creates the expected quote amount/currency.

#### Owner OS browser tests — desktop + mobile

Exercise every current room/action or prove its gated disabled state:
- login/logout/session protection;
- Home automatic refresh and updated timestamp;
- Attention refresh/recovery contracts;
- Issues list/filter/pagination/detail/private reveal reason gate;
- Designer actions and unavailable-provider states;
- Manufacturing controls with production confirmation still disabled;
- Sales 7/30/90/lifetime windows;
- Customers;
- Support;
- Website catalog pricing and question editing;
- System/readiness;
- Audit.

At least one browser test must change the mocked server response after mount and prove visible Owner OS state updates automatically. A static mocked snapshot is not sufficient.

### 7. Production verification after merge

After CI, build, desktop/mobile Browser QA, code review, and deployment are green:
- confirm the newest paid payment and Issue still exist exactly once in production Neon;
- confirm Owner OS repository queries include that Issue/payment in the active window;
- confirm counts for payment attempts, provider events, Issues, design jobs, notifications and manufacturing jobs;
- confirm no unintended duplicate Issue/contact/payment rows;
- confirm migration `0029_creator_referrals.sql` remains unapplied;
- do not configure referral signing keys;
- keep Printful production confirmation disabled;
- use one normal production OTP only if necessary to prove the new request-tagged delivery; do not expose its six-digit code in engineering reports;
- do not create an extra real payment solely to prove dashboard refresh.

## Failure handling

- If continuity requires a production schema change, stop at `OWNER_REQUIRED` for explicit migration approval.
- If any product journey fails, keep the release gate closed until a RED regression proves the root cause and the fix is green.
- If Owner OS cannot surface canonical paid data already present in Neon, treat that as a release blocker.
- If live verification would create a charge or enable manufacturing, use read-only/preview proof instead.

## Preserved gates

- Do not apply migration `0029_creator_referrals.sql`.
- Do not configure `REFERRAL_ATTRIBUTION_SIGNING_KEY`.
- Do not enable Printful production confirmation.
- Do not use browser navigation as payment truth.
- Do not weaken OTP rate limits or expose private contact data.
- Do not silently merge purchases into one Experience/payment record.

## Release definition

Complete only when:
1. Tee, hat, and tote complete end-to-end preview purchases on desktop and mobile.
2. Repeat ordering remains indefinitely isolated.
3. Repeat customers explicitly enter an email; matching prior verification produces a choice, never silent reuse.
4. `USE THIS EMAIL` securely reuses verification only with valid same-browser continuity proof; `CHANGE EMAIL` or a different email requires normal OTP.
5. OTP messages are unambiguous and every challenge failure state recovers correctly.
6. Owner OS refreshes canonical payment/Issue state while left open and surfaces the newest real paid Issue.
7. Every current Owner OS room/button has an automated interaction test or explicit gated-state assertion.
8. Unit/integration tests, typecheck, lint, production build, CI, Browser QA, code review and deployment verification are green.
9. Production invariants remain intact: no unapproved migration, no duplicate Issue, no unintended manufacturing, no secret exposure.
