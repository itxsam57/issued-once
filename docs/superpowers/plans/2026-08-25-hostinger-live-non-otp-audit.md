# Hostinger live non-OTP audit plan

**Goal:** Prove the temporary Hostinger deployment's remaining safe production boundaries without entering an OTP, creating a real payment, enabling manufacturing, applying referral migration 0029, or exposing private data.

**Isolation:** Execute from `infra/hostinger-migration-20260823`; keep frozen deployment branch `release/hostinger-v2-candidate-20260824` unchanged.

## Task 1 — Add a read/write-safe live boundary harness

Create `tests/e2e/live-non-otp-boundaries.mjs` on the engineering branch. The harness will use a fresh browser/session and test only operations that are safe to invoke repeatedly:

- public merchant pages return successfully and contain no obvious secret/error dump;
- release health remains healthy;
- start a fresh experience and prove shipping rejects before verified contact;
- prove payment creation rejects before verified contact/shipping;
- malformed/unknown issue lookup fails without private data leakage;
- invalid artwork token fails closed;
- owner/ops API endpoints reject unauthenticated requests;
- internal job/design/manufacturing/rotation endpoints reject without internal auth;
- unsigned Safepay, Printful, and Fourthwall webhook requests fail closed;
- referral application fails closed while production referral migration/config remains intentionally absent.

The harness must never print cookies, session tokens, emails, OTPs, raw answers, addresses, secrets, provider payloads, or database credentials.

## Task 2 — Run it in an independent GitHub Actions workflow

Create `.github/workflows/hostinger-live-boundary-audit.yml` that:

- checks out the frozen release for dependency installation;
- checks out the engineering branch into a separate directory for the harness;
- runs the harness against `https://lightgray-coyote-141764.hostingersite.com`;
- uploads only sanitized screenshots/evidence;
- never uses production mutation secrets.

## Task 3 — Corroborate production invariants

After the live run, use read-only Neon queries to verify:

- no verified contact was created by the audit;
- no shipping snapshot was created by the audit;
- no manufacturing job/event was created;
- referral tables remain absent;
- only expected experience/answer/OTP smoke-test rows changed.

## Task 4 — Mailbox and release evidence

Use connected `webrefreshlab@gmail.com` only to verify delivery metadata/placement of Issued Once messages. Never expose OTP values. Record whether the newest request produced a corresponding message and whether it landed in Inbox/Spam.

## Task 5 — Update governor/runbook evidence

Update `.engineering/CONTINUATION.json` with exact workflow IDs/results, mailbox evidence, Neon invariants, and the remaining owner OTP gate. Keep domain cutover, real Safepay QA charge, Printful confirmation, and migration 0029 blocked.
