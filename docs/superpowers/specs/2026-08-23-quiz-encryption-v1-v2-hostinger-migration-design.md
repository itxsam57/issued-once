# ISSUED ONCE — Quiz Encryption V1 → V2 Hostinger Migration Design

Date: 2026-08-23
Status: approved design for implementation; production schema mutation remains separately owner-gated.

## Purpose

ISSUED ONCE is permanently moving from Vercel to Hostinger. The existing production questionnaire ciphertext is encrypted with `QUIZ_ENCRYPTION_KEY_V1`. Vercel stores that variable as Sensitive and does not reveal the plaintext through the dashboard or `vercel env pull`; the pulled value is intentionally represented as `[SENSITIVE]`.

The objective is therefore not to keep Vercel in the architecture. Vercel is used only as a temporary one-time migration bridge because its running production functions can still access the hidden V1 key internally. Once all persisted questionnaire answers have been re-encrypted under V2 and Hostinger is live-proven, Vercel is retired.

## Non-negotiable safety rules

- Never expose V1 or V2 in logs, GitHub, artifacts, browser responses, database rows, or chat.
- Never replace `QUIZ_ENCRYPTION_KEY_V1` with a newly generated value; doing so would make existing V1 ciphertext undecryptable.
- No plaintext questionnaire answer may be persisted during migration.
- Existing V1 rows must remain readable until each row is atomically converted to V2.
- Production schema migration `0031` requires separate exact owner approval before it is applied.
- Migration `0029_creator_referrals.sql` remains forbidden and unrelated.
- Printful production confirmation stays disabled and no real Safepay QA charge is authorized.

## Architecture

### Versioned cryptography

`privatePayload` becomes explicitly version-aware:

- V1 decrypts only with `QUIZ_ENCRYPTION_KEY_V1`.
- V2 encrypts and decrypts with `QUIZ_ENCRYPTION_KEY_V2`.
- New writes use V2 once V2 is configured.
- V1 remains decrypt-only during the migration window.
- Payload metadata remains self-describing through `payload_version` and `key_version`.

The application must fail closed if a required key is missing or decodes to anything other than exactly 32 bytes.

### Database compatibility

Migration `0031` broadens the `experience_answers.key_version` constraint from V1-only to permit `v1` and `v2`. It does not alter ciphertext contents by itself.

The migration must be idempotent where practical and scoped only to the questionnaire-key-version constraint.

### One-time re-encryption bridge

A protected server-side migration path runs only in the old Vercel production runtime while V1 is still available there.

For each V1 row in bounded batches:

1. Read ciphertext and metadata from Postgres.
2. Decrypt in memory with V1.
3. Encrypt the plaintext immediately in memory with V2 using a fresh IV.
4. Atomically replace that same row's encrypted fields and set `key_version = 'v2'`.
5. Discard plaintext from process memory by normal request lifecycle; never log or serialize it.

The updater must include a `WHERE key_version = 'v1'` guard so repeated execution is safe and already-migrated rows are not reprocessed unnecessarily.

### Authentication and exposure

The re-encryption operation must not be a public unauthenticated endpoint. It must use an existing server-only operations authentication mechanism or a dedicated one-time migration secret, validated server-side using timing-safe comparison where applicable.

Responses expose only aggregate counts such as scanned, migrated, remaining, failed. They never return questionnaire content, ciphertext, IVs, tags, keys, session tokens, or customer identity data.

### Cutover lifecycle

1. Implement and test V1/V2 compatibility and the migration path off-production.
2. Generate a new high-entropy 32-byte V2 key and store it separately in both Vercel and Hostinger; never paste it into chat.
3. With explicit owner approval, apply migration `0031` to production.
4. Deploy the V1/V2-compatible release to Vercel while V1 remains available there.
5. Execute bounded migration batches until production reports zero V1 questionnaire rows.
6. Independently verify by read-only database query that every questionnaire row is V2.
7. Deploy/prove Hostinger with V2 configured.
8. Run exact release-health and Tee/Cap/Tote live product proof on Hostinger.
9. Cut `issuedonce.shop` permanently to Hostinger and repeat the live proof.
10. Only after successful Hostinger cutover may Vercel be retired and V1 removed from the old runtime.

## Failure handling

- If a V1 row cannot decrypt, stop and report aggregate failure without modifying that row.
- If V2 encryption or database update fails, the original V1 row remains intact.
- Migration batches are restartable and idempotent.
- A partial run is safe because each row carries its own key version.
- Hostinger must not become the sole production runtime until remaining V1 count is zero, unless a deliberate documented decision is made to abandon those rows.

## Testing

### Unit/TDD

- V1 ciphertext decrypts with V1.
- V2 ciphertext decrypts with V2.
- V1 does not decrypt with V2 and vice versa.
- New encryption writes V2 metadata.
- Missing/malformed keys fail closed.
- Batch migrator converts V1 → V2 without exposing plaintext.
- Already-V2 rows are skipped.
- Failed conversion leaves original V1 row unchanged.
- Migration endpoint rejects missing/incorrect authorization.

### Integration

- Temporary database branch accepts both key versions after `0031`.
- A seeded V1 answer is migrated to V2 and remains semantically identical after decrypting with the appropriate key.
- Re-running migration produces zero additional changes.

### Release proof

After all V1 rows are converted:

- Hostinger `/api/health/release` remains HTTP 200 and exact-SHA green.
- Tee / M / Bone reaches contact/OTP boundary.
- Cap / OS / Bone reaches contact boundary.
- Tote / OS / Bone reaches contact boundary.
- No real Safepay charge occurs.
- No Printful confirmation occurs.
- Read-only Neon verification shows V1 questionnaire row count = 0 and expected V2 rows present.

## Completion definition

This migration is complete only when Vercel is no longer required for decryption or request serving, all preserved questionnaire ciphertext is V2, Hostinger passes exact live release proof, `issuedonce.shop` serves the proved Hostinger release, and the production safety invariants remain intact.
