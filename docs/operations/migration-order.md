# ISSUED ONCE — Final Migration Order

Apply migrations strictly in lexicographic order. For a fresh database, the source of truth is the complete chain below and `db/migrations/CURRENT`.

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

Current migration head:

`db/migrations/CURRENT -> 0019_payment_exception_timeline.sql`

`0009a_issue_uuid_prerequisite.sql` is required because the legacy Fourthwall-era `issues` table used `issue_code` without the internal UUID required by the final design/manufacturing identity spine.

The post-0013 hardening migrations are part of the required launch schema, not optional patches. They add refund truth, payment-snapshot immutability, Issue lifecycle enforcement, payment-exception projection, provider-money consistency, and canonical payment-exception timeline events.

No production migration is considered applied merely because these files exist in Git. Record separate database evidence for every environment.
