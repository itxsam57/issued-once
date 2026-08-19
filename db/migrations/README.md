# ISSUED ONCE database migration manifest

Apply in lexicographic filename order. Stop on first failure.

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

`CURRENT` points to the latest migration represented by this repository. It does **not** assert that any production database has been migrated.

## Safety intent of the final migrations

- `0014` adds explicit `REFUNDED` payment truth.
- `0015` freezes verified contact and shipping snapshots while active money truth references them.
- `0016` makes Issue lifecycle transitions a database finite-state machine.
- `0017` separates post-production financial exceptions from physical fulfillment progress.
- `0018` quarantines signed provider events whose amount/currency contradict the frozen payment attempt.
- `0019` projects payment exceptions into the Issue timeline.
- `0020` adds append-only Owner OS audit events and private internal Issue notes.
- `0021` adds append-only design candidate history and permits design rework only before manufacturing has started.
- `0022` adds versioned Owner OS website catalog configuration.
- `0023` adds incremental daily commercial metric buckets and trigger-based projections for funnel, paid sales, product/size/color/country mix, payment outcomes, lifecycle timing, design activity, and support activity. It intentionally performs no historical full-table backfill; any future legacy backfill must be a separate resumable maintenance job.
- `0024` adds bounded operational indexes for recent paid sales, Issue status, payment exceptions, payment outcomes, design/manufacturing/notification/support queues, and newest-first Issue events.
- `0025` projects delivered counts independently of lifecycle timing so lifetime delivery totals do not require scanning delivered Issues.

## Verification state

On 2026-08-19, migrations `0020`–`0022` were exercised on isolated Neon branch `owner-os-migration-proof-20260819` (`br-shy-fire-axkuvyf8`) against the prerequisite Issue/design/manufacturing schema. Verification confirmed four Owner OS tables, seven intended indexes, and the updated Issue transition function. A database behavior check confirmed that `DESIGN_REVIEW -> BEING_INTERPRETED` is allowed before a manufacturing draft and rejected once a `DRAFT` exists. The temporary branch was deleted after verification.

On 2026-08-19, migrations `0023`–`0025` were exercised on isolated Neon branch `owner-os-metric-buckets-proof-20260819` (`br-still-boat-axp76bq8`) against representative prerequisite tables. Verification confirmed incremental projection for start/answer/physical/verified/shipping/checkout/paid funnel stages, gross paid sales, Tee/size/color/country dimensions, start-to-paid timing, paid-to-production timing, production-to-delivery timing, design approval/rework, support activity, refund value, failed-payment count, and delivered count. A synthetic $54 USD Issue produced the expected $54 gross bucket, one paid order, one Tee/M/Black/PK dimension count, 16-minute start-to-paid, 24-hour paid-to-production, 72-hour production-to-delivery, one $54 refund when refunded, and one failed-payment event on a separate attempt. Verification also confirmed all 9 Owner OS scale indexes. The temporary branch was deleted after verification.

The connected production/default Neon database was inspected during these proofs and did not contain the canonical `issues` table. Therefore production is **not** considered migrated. The complete ordered chain above must be applied and verified on the production branch before real payment/design/manufacturing traffic is enabled.
