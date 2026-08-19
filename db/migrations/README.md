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

## Safety intent of the final migrations

- `0014` adds explicit `REFUNDED` payment truth.
- `0015` freezes verified contact and shipping snapshots while active money truth references them.
- `0016` makes Issue lifecycle transitions a database finite-state machine.
- `0017` separates post-production financial exceptions from physical fulfillment progress.
- `0018` quarantines signed provider events whose amount/currency contradict the frozen payment attempt.

The connected temporary Neon branch has been used to exercise these migrations and rollback safety proofs. Production is not considered migrated until the owner explicitly approves the production migration action and the production branch is verified afterward.
