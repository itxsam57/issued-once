# Contact Continuity and OTP Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repeat-order email reuse explicit and secure, make OTP delivery unambiguous and recoverable, and preserve order isolation without a database migration.

**Architecture:** Repeat creation stays isolated. The server issues an HttpOnly signed continuity cookie only when the source checkout has a verified contact; the cookie binds source contact identity to the deterministic child session. At contact entry the customer still types an email. A matching email may be reused only after the server validates both the signed continuity proof and current child session; otherwise normal OTP is required. OTP APIs return safe typed failure states and a public request tag.

**Tech Stack:** Next.js 16 route handlers, React 19, TypeScript 5.9, Vitest, Neon PostgreSQL, Resend.

**Spec:** `docs/superpowers/specs/2026-08-23-workflow-audit-otp-live-owner-design.md`

## Global Constraints

- No production schema migration.
- Never apply `0029_creator_referrals.sql`.
- Never copy OTP challenges into repeat children.
- Merely knowing an email address must never bypass OTP.
- No plaintext email in continuity cookies or URLs.
- Existing `IDENTITY_HMAC_KEY` may be reused only with explicit domain separation.
- Printful production confirmation remains disabled.
- Use TDD RED before each behavior change.

---

### Task 1: Signed contact-continuity proof

**Files:**
- Create: `src/server/contact/contactContinuity.ts`
- Create: `tests/unit/contact-continuity.test.ts`
- Modify: `src/server/http/sessionCookie.ts`

**Interfaces:**
- Produces: `CONTACT_CONTINUITY_COOKIE_NAME`, `contactContinuityCookieOptions`, `createContactContinuityToken(input)`, `verifyContactContinuityToken(token, expectedChildSessionHash)`.
- Token payload fields: `sourceContactId`, `emailHash`, `childSessionHash`, `issuedAt`; payload is authenticated with HMAC-SHA256 using `IDENTITY_HMAC_KEY` and domain string `issued-once:contact-continuity:v1`.

- [ ] **Step 1: Write failing token tests**

```ts
const token = createContactContinuityToken({
  sourceContactId: 'contact-1',
  emailHash: 'a'.repeat(64),
  childSessionHash: 'b'.repeat(64),
  issuedAt: new Date('2026-08-23T06:00:00Z'),
});
expect(verifyContactContinuityToken(token, 'b'.repeat(64))).toMatchObject({
  sourceContactId: 'contact-1', emailHash: 'a'.repeat(64), childSessionHash: 'b'.repeat(64),
});
expect(() => verifyContactContinuityToken(token, 'c'.repeat(64))).toThrow(/session/i);
```

Also flip one byte in the payload/signature and assert verification fails.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/unit/contact-continuity.test.ts`
Expected: FAIL because continuity module does not exist.

- [ ] **Step 3: Implement minimal signed token and cookie constants**

Use base64url payload plus HMAC signature; compare signatures with `timingSafeEqual`. Add `__Host-io_contact_continuity` using `httpOnly: true`, `secure: true`, `sameSite: 'lax'`, `path: '/'`, and the same 30-day maximum as the anonymous session.

- [ ] **Step 4: Run GREEN**

Run: `pnpm test -- tests/unit/contact-continuity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add signed repeat contact continuity proof`

---

### Task 2: Expose source verified-contact continuity when repeat child is chosen

**Files:**
- Modify: `src/server/contact/ContactRepository.ts`
- Modify: `src/server/contact/PostgresContactRepository.ts`
- Modify: `src/server/experience/RepeatOrderService.ts`
- Modify: `src/server/experience/runtimeRepeatOrders.ts`
- Modify: `src/app/api/experience/repeat/route.ts`
- Modify: `tests/unit/repeat-order-service.test.ts`
- Modify: `tests/unit/repeat-order-route.test.ts`
- Modify/Create: `tests/unit/postgres-contact-repository.test.ts`

**Interfaces:**
- `ContactRepository.findVerifiedById(contactId: string)` returns the encrypted verified-contact record or null.
- `RepeatOrderService.choose()` returns optional `contactContinuity: { sourceContactId: string; emailHash: string }` but never copies a verified-contact row.
- Repeat route sets continuity cookie only when that descriptor exists, binding it to `hashSessionToken(result.token)`.

- [ ] **Step 1: Write RED service/route tests**

Add a source contact fixture and assert both `reuse` and `fresh` results contain continuity metadata while a source with no verified contact returns none. Route test must assert `cookieStore.set(CONTACT_CONTINUITY_COOKIE_NAME, ...)` occurs only when continuity exists.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/unit/repeat-order-service.test.ts tests/unit/repeat-order-route.test.ts`
Expected: FAIL on missing contact dependency/continuity cookie behavior.

- [ ] **Step 3: Implement read-only contact lookup and route cookie issuance**

Do not modify `PostgresRepeatOrderRepository` SQL and do not insert into `verified_contacts` during repeat creation. Extend runtime dependencies with `PostgresContactRepository` read access.

- [ ] **Step 4: Run GREEN**

Run the same targeted tests plus `pnpm typecheck`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: issue secure contact continuity on repeat orders`

---

### Task 3: Email match check and explicit reuse confirmation

**Files:**
- Create: `src/app/api/contact/check-email/route.ts`
- Create: `src/app/api/contact/reuse-verified/route.ts`
- Modify: `src/server/contact/ContactRepository.ts`
- Modify: `src/server/contact/PostgresContactRepository.ts`
- Modify: `src/server/contact/ContactService.ts`
- Modify: `src/server/contact/runtimeContact.ts`
- Modify: `tests/unit/contact-service.test.ts`
- Modify: `tests/unit/contact-shipping-routes.test.ts`

**Interfaces:**
- `ContactService.checkContinuity({ experienceToken, email, continuityToken }) -> { alreadyVerified: boolean }`.
- `ContactService.reuseVerified({ experienceToken, email, continuityToken }) -> { verified: true }`.
- `ContactRepository.copyVerifiedContact({ sourceContactId, targetExperienceId, expectedEmailHash, newContactId, now }) -> boolean` copies encrypted payload only after server proof validation.

- [ ] **Step 1: Write RED security tests**

Cover: matching email + valid proof -> `alreadyVerified: true`; wrong email -> false; tampered proof -> false/409; proof for another child session -> false/409; confirming reuse copies one contact row; retry is idempotent; no OTP challenge is copied; missing continuity proof never matches.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/unit/contact-service.test.ts tests/unit/contact-shipping-routes.test.ts`
Expected: FAIL because new methods/routes do not exist.

- [ ] **Step 3: Implement proof-bound match and copy**

`checkContinuity` computes `emailLookupHash(normalizeEmail(email))`, verifies continuity signature against current session hash, then compares hashes. `reuseVerified` repeats every check server-side and performs `INSERT ... SELECT` from the source verified contact into the current Experience with `ON CONFLICT (experience_id) DO UPDATE` only for the same expected email hash.

- [ ] **Step 4: Run GREEN + SQL contract test**

Run targeted tests and `pnpm typecheck`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: require explicit verified email reuse`

---

### Task 4: Typed OTP failures and request tags

**Files:**
- Modify: `src/server/contact/ContactService.ts`
- Modify: `src/app/api/contact/request-otp/route.ts`
- Modify: `src/app/api/contact/verify-otp/route.ts`
- Modify: `src/server/contact/ResendOtpDeliveryGateway.ts`
- Modify: `tests/unit/contact-service.test.ts`
- Modify: `tests/unit/contact-shipping-routes.test.ts`
- Modify: `tests/unit/resend-otp-delivery.test.ts`

**Interfaces:**
- Add `OtpVerificationError` with codes: `WRONG_CODE`, `ATTEMPT_LIMIT`, `EXPIRED`, `USED_OR_STALE`, `CHALLENGE_NOT_FOUND` and optional `attemptsRemaining`.
- `requestOtp` returns `{ challengeId, retryAfterSeconds, requestTag }` where `requestTag = challengeId.replace(/-/g,'').slice(0,8).toUpperCase()`.
- Verify route returns safe JSON `{ error, code, attemptsRemaining? }` with 409/429 according to state.

- [ ] **Step 1: Write RED tests for all failure codes and tagged email**

Assert first wrong code reports 4 attempts remaining; fifth wrong code returns `ATTEMPT_LIMIT`; expired and stale/used are distinct; tagged Resend subject/body includes the request tag and still excludes internal provider details.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/unit/contact-service.test.ts tests/unit/contact-shipping-routes.test.ts tests/unit/resend-otp-delivery.test.ts`
Expected: FAIL on generic errors/untagged mail.

- [ ] **Step 3: Implement typed failures and unique email subject/body**

Example subject: `Your ISSUED ONCE code · 6C6BA8D3`; body contains both six-digit code and `Request 6C6BA8D3`.

- [ ] **Step 4: Run GREEN**

Run targeted tests.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: make otp failures recoverable and emails unambiguous`

---

### Task 5: Customer contact UI state machine

**Files:**
- Create: `src/components/experience/apiClient.ts`
- Modify: `src/components/experience/PublicInterviewExperience.tsx`
- Modify: `src/components/experience/ContactVerification.tsx`
- Modify: `src/components/experience/contact-verification.module.css`
- Modify: `tests/unit/contact-shipping-components.test.tsx`

**Interfaces:**
- `ApiError extends Error { status: number; code?: string; attemptsRemaining?: number }`.
- Contact props add `onCheckEmail(email)`, `onReuseVerified(email)`.
- UI states: `enter-email -> already-verified-confirm | otp-entry`; confirmation buttons are `USE THIS EMAIL` and `CHANGE EMAIL`.

- [ ] **Step 1: Write RED component tests**

Cover entered matching email -> `THIS EMAIL IS ALREADY VERIFIED`; `USE THIS EMAIL` calls reuse endpoint and completes; `CHANGE EMAIL` returns to editable email and never marks contact verified; nonmatching email requests OTP; wrong code displays remaining attempts; expired/locked exposes `SEND NEW CODE`; request tag is visible next to the active OTP instructions.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/unit/contact-shipping-components.test.tsx`
Expected: FAIL on missing states/API error handling.

- [ ] **Step 3: Implement typed client helper and contact state machine**

The generic client helper must preserve safe JSON error data instead of replacing it with `The next step could not be saved.` Existing non-contact callers may keep their current fallback message.

- [ ] **Step 4: Run GREEN + accessibility assertions**

Run targeted test and `pnpm typecheck`.
Expected: PASS, buttons have accessible names and errors use `role="alert"`.

- [ ] **Step 5: Commit**

Commit message: `fix: make repeat contact choice explicit and otp recovery visible`

---

### Task 6: Contact/OTP integration gate

**Files:**
- Modify: `tests/e2e/repeat-order-lifecycle.spec.ts`
- Modify: `tests/e2e/public-physical-flow.spec.ts`

- [ ] **Step 1: Add RED browser scenarios**

Extend route stubs so order 2 enters the same email, receives `alreadyVerified: true`, sees explicit confirmation, and proceeds via `USE THIS EMAIL`; order 3 chooses `CHANGE EMAIL` and completes fresh OTP. Add wrong-then-correct and expired/locked recovery paths.

- [ ] **Step 2: Run desktop + mobile RED/GREEN as implementation lands**

Run: `pnpm test:e2e -- tests/e2e/repeat-order-lifecycle.spec.ts tests/e2e/public-physical-flow.spec.ts`
Expected final: PASS on both configured Playwright projects.

- [ ] **Step 3: Full contact regression**

Run: `pnpm test -- tests/unit/contact-continuity.test.ts tests/unit/contact-service.test.ts tests/unit/contact-shipping-routes.test.ts tests/unit/contact-shipping-components.test.tsx tests/unit/resend-otp-delivery.test.ts tests/unit/repeat-order-service.test.ts`
Then: `pnpm typecheck && pnpm lint && pnpm build`.

- [ ] **Step 4: Commit**

Commit message: `test: harden repeat contact and otp journeys`
