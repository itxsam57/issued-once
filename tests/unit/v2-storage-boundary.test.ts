import { expect, test, vi } from 'vitest';
import { PostgresOpsPrivateSource } from '@/server/ops/PostgresOpsPrivateSource';
import { PostgresReferralNotificationRepository } from '@/server/referrals/PostgresReferralNotificationRepository';
import { PostgresReferralLaunchOutreachRepository } from '@/server/referrals/PostgresReferralLaunchOutreachRepository';

const v2Columns = {
  payload_version: 1,
  key_version: 'v2',
  iv: 'opaque-v2-iv',
  auth_tag: 'opaque-v2-tag',
  ciphertext: 'opaque-v2-ciphertext',
};

const encryptedV2 = {
  version: 1,
  keyVersion: 'v2',
  iv: v2Columns.iv,
  tag: v2Columns.auth_tag,
  ciphertext: v2Columns.ciphertext,
};

test('owner private source preserves V2 encrypted answer metadata', async () => {
  const query = vi.fn().mockResolvedValue([{
    slot: 'q1',
    prompt_snapshot: 'Private prompt',
    ...v2Columns,
  }]);
  const source = new PostgresOpsPrivateSource({ query });

  const answers = await source.getAnswers('00000000-0000-4000-8000-000000000001');

  expect(answers).toEqual([{ slot: 'q1', prompt: 'Private prompt', payload: encryptedV2 }]);
});

test('referral notification repository preserves a V2 creator email payload', async () => {
  const query = vi.fn().mockResolvedValue([{
    conversion_id: '40000000-0000-4000-8000-000000000001',
    creator_id: '10000000-0000-4000-8000-000000000001',
    email_payload_version: 1,
    email_key_version: 'v2',
    email_iv: v2Columns.iv,
    email_auth_tag: v2Columns.auth_tag,
    email_ciphertext: v2Columns.ciphertext,
    reward_amount_minor: 500,
    currency: 'USD',
    pending_balance_minor: 500,
    available_balance_minor: 0,
  }]);
  const repository = new PostgresReferralNotificationRepository({ query });

  const input = await repository.loadNotificationInput('40000000-0000-4000-8000-000000000001');

  expect(input?.encryptedEmail).toEqual(encryptedV2);
});

test('referral launch outreach repository preserves a V2 creator email payload', async () => {
  const query = vi.fn().mockResolvedValue([{
    creator_id: '10000000-0000-4000-8000-000000000001',
    display_name: 'Creator V2',
    normalized_code: 'creator-v2',
    email_payload_version: 1,
    email_key_version: 'v2',
    email_iv: v2Columns.iv,
    email_auth_tag: v2Columns.auth_tag,
    email_ciphertext: v2Columns.ciphertext,
  }]);
  const repository = new PostgresReferralLaunchOutreachRepository({ query });

  const rows = await repository.listActiveCreatorsForOutreach('launch', 10);

  expect(rows[0]?.encryptedEmail).toEqual(encryptedV2);
});
