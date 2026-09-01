# ISSUED ONCE database migration manifest

`CURRENT` points to the newest migration represented by this repository. It is **not** a statement of production database state and must never be used by itself to decide what to apply.

Production rollout is intentionally split into tracks. Do not blindly apply every migration by filename order. Before any production migration, compare the target database schema with the verified production state and follow the approved track below. Stop on the first failure.

## Repository migrations

1. `0001_experience.sql`
2. `0002_checkout_quotes.sql`
3. `0003_physical_selection.sql`
4. `0004_commitment_ready.sql`
5. `0005_webhook_issue_registry.sql`
6. `0006_add_tote_form.sql`
7. `0007_question_vault.sql`
8. `0008_contact_shipping.sql`
9. `0009_payments.sql`
10. `0009a_issue_uuid_prerequisite.sql`
11. `0010_issue_identity_spine.sql`
12. `0011_design_jobs.sql`
13. `0012_manufacturing.sql`
14. `0013_notifications_support.sql`
15. `0014_payment_refunds.sql`
16. `0015_payment_snapshot_immutability.sql`
17. `0016_issue_state_machine.sql`
18. `0017_payment_exception_overlay.sql`
19. `0018_provider_money_consistency.sql`
20. `0019_payment_exception_timeline.sql`
21. `0020_owner_os_audit_notes.sql`
22. `0021_owner_os_design_candidates.sql`
23. `0022_owner_os_website_config.sql`
24. `0023_commercial_metric_buckets.sql`
25. `0024_owner_os_scale_indexes.sql`
26. `0025_delivered_metric_projection.sql`
27. `0026_issue_ledger_filter_indexes.sql`
28. `0027_issue_prefix_search_indexes.sql`
29. `0028_design_controls.sql`
30. `0029_creator_referrals.sql`
31. `0030_background_job_pipeline.sql`
32. `0031_quiz_encryption_v2.sql`
33. `0032_private_payload_key_v2.sql`
34. `0033_contact_otp_rate_limits.sql`
35. `0034_referral_launch_outreach.sql`
36. `0035_referral_private_payload_key_v2.sql`
37. `0036_durable_artwork_objects.sql`

## Production-applied core track

Production has been independently verified with the historical schema through `0028_design_controls.sql`, plus the later core migrations `0030_background_job_pipeline.sql`, `0031_quiz_encryption_v2.sql`, `0032_private_payload_key_v2.sql`, and `0033_contact_otp_rate_limits.sql`.

Those later core migrations were deliberately applied before the referral track. This makes production state non-linear by filename number and is why the repository manifest must not be treated as an automatic production migration queue.

## Pending core migration track

`0036_durable_artwork_objects.sql` is a code-ready core migration for CR-15 durable private artwork retention. It is **not production-applied**. It must remain unapplied until the explicit production-migration approval checkpoint, where the target schema is preflighted and the durable write/read plus restart/redeploy proof is executed without enabling paid factory confirmation.

## Deferred referral activation track

The referral rollout remains deferred. Its verified production activation order is exactly:

1. `0029_creator_referrals.sql`
2. `0034_referral_launch_outreach.sql`
3. `0035_referral_private_payload_key_v2.sql`

Do not apply any of these three migrations until the explicit referral production-activation checkpoint is approved. Do not send creator launch outreach until the schema is live, the creator roster is reviewed, provider email configuration is green, and the Owner explicitly triggers the launch control.

## Safety intent

- `0014`–`0019` harden payment/refund truth, immutable customer snapshots, lifecycle transitions, provider-money consistency, and exception history.
- `0020`–`0028` add Owner OS audit/design/website controls, incremental commercial projections, bounded operational indexes, delivery projection, scalable Issue-ledger search, and guarded design controls.
- `0029` adds encrypted creator identities/payout details, immutable referral rule and checkout snapshots, signed attribution, idempotent conversion/reward states, notification idempotency, and payout-allocation uniqueness. Existing non-referral quotes are backfilled as gross=final with zero discount and a compatibility trigger preserves legacy inserts during migration-first rollout.
- `0030` adds durable background jobs.
- `0031` and `0032` add V2 encryption support while preserving historical V1 readability.
- `0033` adds persistent OTP rate-limit controls.
- `0034` adds idempotent creator outreach delivery state.
- `0035` permits referral private payload key versions `v1` and `v2` so current V2 encryption can coexist with historical V1 data.
- `0036` stores private artwork bytes in the existing Postgres durability authority with byte-count and SHA-256 integrity metadata so generated and owner-uploaded artwork do not depend on a deployment-local filesystem.

## Latest verification evidence

On 2026-08-28, PR #18 re-proved the deferred referral chain on an isolated Neon branch in the exact order `0029` → `0034` → `0035`. V2 creator-email and payout-detail rows were accepted, the intended V1/V2 constraints were present, the outreach table/index existed, and checkout referral invariants had zero violations. The disposable proof branch was deleted afterward.

A fresh read-only production preflight on 2026-08-28 confirmed a clean referral starting state: zero existing referral objects, all prerequisite core columns/tables present, 342 existing checkout quotes with no non-positive amounts, and no partial referral columns, fill function, or trigger. No referral migration was applied during that preflight.

Production therefore remains intentionally split: core migrations `0030`, `0031`, `0032`, and `0033` are live; core migration `0036` is pending explicit production-migration approval; and referral migrations `0029`, `0034`, and `0035` remain unapplied pending their separate activation gate.
