# ISSUED ONCE — Final Migration Order

Apply migrations strictly in lexicographic order. Do not skip the UUID prerequisite between payment attempts and the new Issue identity spine.

Final commercial-cycle additions:

1. `0007_question_vault.sql`
2. `0008_contact_shipping.sql`
3. `0009_payments.sql`
4. `0009a_issue_uuid_prerequisite.sql`
5. `0010_issue_identity_spine.sql`
6. `0011_design_jobs.sql`
7. `0012_manufacturing.sql`
8. `0013_notifications_support.sql`

`0009a_issue_uuid_prerequisite.sql` exists because the legacy Fourthwall-era `issues` table used `issue_code` without the internal UUID now required by design/manufacturing foreign keys.

No production migration is considered applied merely because these files exist in Git. Record separate database evidence for every environment.
