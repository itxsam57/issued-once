# ISSUED ONCE — Final Migration Order

Apply migrations strictly in lexicographic filename order. For every environment, the authoritative migration chain is `db/migrations/README.md`, and `db/migrations/CURRENT` identifies the repository head. This runbook intentionally mirrors that source of truth for operator readability, but `CURRENT` wins if this document ever becomes stale.

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

Current repository migration head:

`db/migrations/CURRENT -> 0027_issue_prefix_search_indexes.sql`

`0009a_issue_uuid_prerequisite.sql` is required because the legacy Fourthwall-era `issues` table used `issue_code` without the internal UUID required by the final design/manufacturing identity spine.

## Required hardening groups

The migrations after the original commercial spine are required launch schema, not optional patches:

- `0014`–`0019`: refund truth, payment-snapshot immutability, Issue lifecycle enforcement, payment-exception overlay, provider-money consistency, and canonical payment-exception timeline projection.
- `0020`–`0022`: append-only Owner OS audit/private notes, design-candidate history and pre-manufacturing rework support, and versioned website/catalog configuration.
- `0023`–`0025`: incremental daily commercial metric buckets, bounded operational indexes, and independent delivered-count projection so long-window analytics do not require full-table scans.
- `0026`–`0027`: newest-first Issue-ledger/country-filter indexes plus `pg_trgm`-backed case-insensitive prefix search for Issue Code, Safepay provider reference, Printful order ID, and tracking number.

## Production rule

No production migration is considered applied merely because these files exist in Git or because an isolated proof branch passed. Record separate database evidence for every environment.

For the connected production/default Neon database, the current verified state is **not migrated**. Before real traffic, apply the complete chain through whatever file `db/migrations/CURRENT` names at execution time, then verify the resulting schema directly.

Never skip to a later migration on a fresh database. Stop on the first failed migration and investigate the failure before continuing.
