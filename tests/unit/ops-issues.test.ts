import { expect, test } from 'vitest';
import { PostgresOpsIssueDetailRepository } from '@/server/ops/PostgresOpsIssueDetailRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

test('lists Issues with bounded operational data and no private plaintext', async () => {
  const sqlTexts: string[] = [];
  const sql: SqlExecutor = {
    query: async (text) => {
      sqlTexts.push(text);
      return [{
        issue_id: '11111111-1111-1111-1111-111111111111',
        issue_code: 'IO-ABCD-EFGH',
        status: 'DESIGN_REVIEW',
        object_type: 'tee',
        size_code: 'M',
        color_code: 'black',
        amount_minor: 5400,
        currency: 'USD',
        payment_status: 'PAID',
        design_state: 'REVIEW',
        manufacturing_state: null,
        provider_order_id: null,
        tracking_number: null,
        payment_exception_code: null,
        updated_at: new Date('2026-08-19T05:00:00Z'),
      }] as never;
    },
  };

  const page = await new PostgresOpsIssueDetailRepository(sql).listIssues({ limit: 50, cursor: null, search: 'IO-ABCD', filters: {} });
  expect(page.items).toHaveLength(1);
  expect(page.items[0].issueCode).toBe('IO-ABCD-EFGH');
  expect(page.items[0]).not.toHaveProperty('email');
  expect(page.items[0]).not.toHaveProperty('ciphertext');
  expect(sqlTexts.join('\n')).not.toMatch(/email_ciphertext|shipping.*ciphertext|experience_answers.*ciphertext/i);
});

test('returns canonical Issue detail with privacy presence flags only', async () => {
  let call = 0;
  const sql: SqlExecutor = {
    query: async () => {
      call += 1;
      if (call === 1) return [{
        issue_id: '11111111-1111-1111-1111-111111111111',
        issue_code: 'IO-ABCD-EFGH',
        status: 'DESIGN_REVIEW',
        object_type: 'tee',
        size_code: 'M',
        color_code: 'black',
        amount_minor: 5400,
        currency: 'USD',
        payment_status: 'PAID',
        payment_provider: 'SAFEPAY',
        payment_provider_reference: 'trk_1',
        payment_exception_code: null,
        design_job_id: '22222222-2222-2222-2222-222222222222',
        design_state: 'REVIEW',
        artwork_width: 1024,
        artwork_height: 1536,
        design_provider: 'OPENAI',
        design_model: 'gpt-image-2',
        manufacturing_job_id: null,
        manufacturing_state: null,
        provider_order_id: null,
        provider_status: null,
        tracking_number: null,
        tracking_url: null,
        has_verified_email: true,
        has_shipping: true,
        has_answers: true,
        has_private_brief: true,
        has_support_message: false,
        reserved_at: new Date('2026-08-19T04:00:00Z'),
        updated_at: new Date('2026-08-19T05:00:00Z'),
      }] as never;
      return [] as never;
    },
  };

  const detail = await new PostgresOpsIssueDetailRepository(sql).getIssueDetail('11111111-1111-1111-1111-111111111111');
  expect(detail?.privacy).toEqual({ verifiedEmail: true, shipping: true, answers: true, privateBrief: true, supportMessage: false });
  expect(JSON.stringify(detail)).not.toMatch(/ciphertext|private@example.com|street/i);
});
