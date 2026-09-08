BEGIN;

ALTER TABLE otp_challenges
  DROP CONSTRAINT otp_challenges_email_key_version_check;

ALTER TABLE otp_challenges
  ADD CONSTRAINT otp_challenges_email_key_version_check
  CHECK (email_key_version IN ('v1', 'v2'));

ALTER TABLE verified_contacts
  DROP CONSTRAINT verified_contacts_key_version_check;

ALTER TABLE verified_contacts
  ADD CONSTRAINT verified_contacts_key_version_check
  CHECK (key_version IN ('v1', 'v2'));

ALTER TABLE shipping_snapshots
  DROP CONSTRAINT shipping_snapshots_key_version_check;

ALTER TABLE shipping_snapshots
  ADD CONSTRAINT shipping_snapshots_key_version_check
  CHECK (key_version IN ('v1', 'v2'));

ALTER TABLE support_requests
  DROP CONSTRAINT support_requests_key_version_check;

ALTER TABLE support_requests
  ADD CONSTRAINT support_requests_key_version_check
  CHECK (key_version IN ('v1', 'v2'));

COMMIT;
