# Unified Issue Access Recovery Implementation Plan

**Goal:** Restore the existing anonymous Issue session after a trusted payment return or verified Issue-code recovery without creating a parallel authentication system.

**Architecture:** The existing `__Host-io_session` remains the only public Issue-access credential. A shared `ExperienceAccessService` rotates `experiences.public_session_hash` for a known `experienceId`, invalidating the old token and returning a fresh token for the existing cookie. Payment return may call it only after authoritative paid reconciliation/finalization. Explicit recovery must prove ownership through the Issue's verified contact and the existing OTP challenge system before rotating access.

**Constraints:** No schema migration; no raw email/session token persistence; no Issue-code-only login; no new auth cookie; preserve current payment truth, OTP rate limits, anti-enumeration behavior, and sanitized logging.

## Task 1 — Shared session-rotation primitive

- Extend `ExperienceRepository` with an atomic rotation operation for a non-expired experience.
- Implement it in Postgres and preview repositories.
- Add `ExperienceAccessService` that creates a new session token, hashes it, rotates the stored hash, and returns only the raw token.
- Tests: repository SQL contract, old-token invalidation/new-token access, missing/expired experience failure.

## Task 2 — Payment-return restoration

- After Reporter-backed reconciliation returns paid/duplicate and `finalizePaidAttempt` returns the Issue, rotate access using `issue.experienceId`.
- Set `__Host-io_session` on the 303 redirect using the existing cookie options.
- Never restore from tracker/query data unless authoritative reconciliation/finalization succeeds.
- Tests: paid return sets rotated cookie; pending/failed/missing tracker does not; restoration failure does not alter payment truth and safely falls back to pending navigation.

## Task 3 — Verified Issue-code recovery

- Resolve Issue Code through the existing issue-status repository lookup to `experienceId`.
- Match the supplied normalized email against the verified contact's keyed email hash without exposing existence details.
- Reuse ContactService OTP challenge creation/verification by factoring methods that operate on a known `experienceId`; keep existing session-based endpoints delegating to the same implementation.
- Add recovery request/verify routes. A successful OTP verification rotates the existing Issue session and sets the existing cookie.
- Tests: generic mismatch response, OTP bound to Issue experience, wrong/stale code cannot restore, successful proof rotates access.

## Task 4 — Public recovery UX

- Add a small self-service recovery surface reachable from the Issue/contact experience.
- Collect Issue Code + email, request OTP, verify code, then send the buyer to `/issue` with the restored cookie.
- Do not reveal whether an Issue Code/email pair exists before successful proof.
- Tests: component contract and browser QA for the recovery journey.

## Verification

1. Focused RED tests before each implementation slice.
2. Focused GREEN tests after minimal implementation.
3. Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` through CI.
4. Browser QA on the exact feature head.
5. Merge only after required gates are green; rerun exact merged-head verification.
6. Record branch, SHAs, PR, runs, and next work in `.engineering/CONTINUATION.json`.
