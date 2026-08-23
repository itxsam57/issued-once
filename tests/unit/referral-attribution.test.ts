import { describe, expect, test, vi } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';
import {
  createReferralAttributionToken,
  verifyReferralAttributionToken,
} from '@/server/referrals/referralAttributionToken';
import { ReferralService } from '@/server/referrals/ReferralService';

const sessionToken = 'referral-session-token';
const now = new Date('2026-08-21T10:00:00.000Z');
const signingKey = Buffer.alloc(32, 7).toString('base64');

const rules = {
  customerDiscount: { mode: 'PERCENT' as const, basisPoints: 1000 },
  creatorReward: { mode: 'FIXED' as const, amountMinor: 500 },
  payoutCadence: 'THRESHOLD' as const,
  payoutThresholdMinor: 2500,
  attributionWindowDays: 30,
};

function activeRule(overrides: Record<string, unknown> = {}) {
  return {
    creatorId: '10000000-0000-4000-8000-000000000001',
    creatorEmailHash: 'a'.repeat(64),
    ruleVersionId: '20000000-0000-4000-8000-000000000001',
    normalizedCode: 'CREATOR-ONE',
    active: true,
    rules,
    ...overrides,
  };
}

function grossQuote() {
  return {
    id: 'quote-gross-001',
    experienceId: 'exp-1',
    productSlug: 'issued-tee',
    variantId: 'tee-m-black',
    grossAmountMinor: 5400,
    discountAmountMinor: 0,
    amountMinor: 5400,
    currency: 'USD',
    referralAttributionId: null,
    referralCreatorId: null,
    referralRuleVersionId: null,
    referralRuleSnapshot: null,
    expiresAt: new Date('2026-08-21T11:00:00.000Z'),
  };
}

function service(options: {
  customerEmailHash?: string;
  rule?: ReturnType<typeof activeRule> | null;
  attribution?: Record<string, unknown> | null;
} = {}) {
  const quote = grossQuote();
  const referrals = {
    findActiveRuleByCode: vi.fn().mockResolvedValue(options.rule === undefined ? activeRule() : options.rule),
    createAttribution: vi.fn().mockResolvedValue(undefined),
    findAttribution: vi.fn().mockResolvedValue(options.attribution ?? null),
  };
  const quotes = {
    findById: vi.fn().mockResolvedValue(quote),
    findLatestByExperienceId: vi.fn().mockResolvedValue(quote),
    create: vi.fn().mockResolvedValue(undefined),
  };
  const contacts = {
    findVerifiedByExperienceId: vi.fn().mockResolvedValue({
      id: 'contact-1', experienceId: 'exp-1',
      emailHash: options.customerEmailHash ?? 'b'.repeat(64),
      encryptedEmail: { version: 1, keyVersion: 'v1', iv: 'iv', ciphertext: 'cipher', tag: 'tag' },
      verifiedAt: now,
    }),
  };
  const experiences = {
    findBySessionHash: vi.fn().mockResolvedValue({
      id: 'exp-1', publicSessionHash: hashSessionToken(sessionToken), stage: 'COMMITMENT_READY', hookId: null,
      createdAt: now, updatedAt: now, expiresAt: new Date('2026-09-21T10:00:00.000Z'),
    }),
  };

  return {
    referrals,
    quotes,
    instance: new ReferralService({
      referrals,
      quotes,
      contacts,
      experiences,
      signingKey,
      now: () => now,
      createAttributionId: () => '30000000-0000-4000-8000-000000000001',
      createQuoteId: () => 'quote-discounted-001',
    }),
  };
}

describe('referral attribution token', () => {
  test('round-trips only opaque attribution id + expiry and rejects tampering/expiry', () => {
    const expiresAt = new Date('2026-09-20T10:00:00.000Z');
    const token = createReferralAttributionToken({ attributionId: '30000000-0000-4000-8000-000000000001', expiresAt }, signingKey);

    expect(token).not.toContain('CREATOR-ONE');
    expect(verifyReferralAttributionToken(token, signingKey, now)).toEqual({
      attributionId: '30000000-0000-4000-8000-000000000001',
      expiresAt,
    });
    expect(verifyReferralAttributionToken(`${token}x`, signingKey, now)).toBeNull();
    expect(verifyReferralAttributionToken(token, signingKey, new Date('2026-09-21T10:00:00.000Z'))).toBeNull();
  });
});

describe('ReferralService', () => {
  test('captures an active link into a signed opaque attribution without creator private data', async () => {
    const { instance, referrals } = service();
    const result = await instance.captureLink('creator-one');

    expect(result.normalizedCode).toBe('CREATOR-ONE');
    expect(result.token).not.toContain('CREATOR-ONE');
    expect(referrals.createAttribution).toHaveBeenCalledWith(expect.objectContaining({
      id: '30000000-0000-4000-8000-000000000001',
      creatorId: '10000000-0000-4000-8000-000000000001',
      ruleVersionId: '20000000-0000-4000-8000-000000000001',
      source: 'LINK',
      createdAt: now,
      expiresAt: new Date('2026-09-20T10:00:00.000Z'),
    }));
  });

  test('explicit valid code freezes gross discount final and immutable rule snapshot into a new quote', async () => {
    const { instance, quotes } = service();
    const result = await instance.applyToQuote({ sessionToken, quoteId: 'quote-gross-001', explicitCode: 'creator-one' });

    expect(result).toMatchObject({
      quoteId: 'quote-discounted-001', grossAmountMinor: 5400, discountAmountMinor: 540, amountMinor: 4860,
      currency: 'USD', applied: true, normalizedCode: 'CREATOR-ONE',
    });
    expect(quotes.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'quote-discounted-001', experienceId: 'exp-1', grossAmountMinor: 5400,
      discountAmountMinor: 540, amountMinor: 4860,
      referralCreatorId: '10000000-0000-4000-8000-000000000001',
      referralRuleVersionId: '20000000-0000-4000-8000-000000000001',
      referralRuleSnapshot: expect.objectContaining({ code: 'CREATOR-ONE', rules }),
    }));
  });

  test('invalid, paused, expired or self-referral attribution does not alter the current quote', async () => {
    const invalid = service({ rule: null });
    await expect(invalid.instance.applyToQuote({ sessionToken, quoteId: 'quote-gross-001', explicitCode: 'NOPE' }))
      .resolves.toMatchObject({ quoteId: 'quote-gross-001', amountMinor: 5400, applied: false });
    expect(invalid.quotes.create).not.toHaveBeenCalled();

    const self = service({ customerEmailHash: 'a'.repeat(64) });
    await expect(self.instance.applyToQuote({ sessionToken, quoteId: 'quote-gross-001', explicitCode: 'CREATOR-ONE' }))
      .resolves.toMatchObject({ quoteId: 'quote-gross-001', amountMinor: 5400, applied: false });
    expect(self.quotes.create).not.toHaveBeenCalled();

    const expiredAttribution = {
      id: '30000000-0000-4000-8000-000000000002',
      ...activeRule(), source: 'LINK', createdAt: new Date('2026-07-01T10:00:00.000Z'), expiresAt: new Date('2026-08-20T10:00:00.000Z'),
    };
    const expired = service({ attribution: expiredAttribution });
    const expiredToken = createReferralAttributionToken({ attributionId: expiredAttribution.id, expiresAt: expiredAttribution.expiresAt }, signingKey);
    await expect(expired.instance.applyToQuote({ sessionToken, quoteId: 'quote-gross-001', attributionToken: expiredToken }))
      .resolves.toMatchObject({ quoteId: 'quote-gross-001', amountMinor: 5400, applied: false });
  });

  test('refuses to replace a quote after checkout starts or when the supplied quote is no longer latest', async () => {
    const first = service();
    first.quotes.findLatestByExperienceId.mockResolvedValue({ ...grossQuote(), id: 'newer-quote' });
    await expect(first.instance.applyToQuote({ sessionToken, quoteId: 'quote-gross-001', explicitCode: 'CREATOR-ONE' }))
      .rejects.toThrow(/latest quote/i);
  });
});
