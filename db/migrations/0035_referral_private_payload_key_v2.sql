BEGIN;

ALTER TABLE referral_creators
  DROP CONSTRAINT referral_creators_email_key_version_check;

ALTER TABLE referral_creators
  ADD CONSTRAINT referral_creators_email_key_version_check
  CHECK (email_key_version IN ('v1', 'v2'));

ALTER TABLE referral_payout_requests
  DROP CONSTRAINT referral_payout_requests_details_key_version_check;

ALTER TABLE referral_payout_requests
  ADD CONSTRAINT referral_payout_requests_details_key_version_check
  CHECK (details_key_version IN ('v1', 'v2'));

COMMIT;
