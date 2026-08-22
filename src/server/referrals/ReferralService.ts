import { randomUUID } from 'node:crypto';
import type { ReferralRules } from './ReferralPolicy';
import { normalizeReferralCode, validateReferralRules } from './ReferralPolicy';
import {
  createReferralAttributionToken,
  verifyReferralAttributionToken,
} from './referralAttributionToken';
import { hashSessionToken } from '@/server/http/sessionToken';

type ReferralRuleView = {
  creatorId: string;
  creatorEmailHash: string;
  ruleVersionId: string;
  normalizedCode: string;
  active: boolean;
  rules: ReferralRules;
};

type ReferralAttributionView = ReferralRuleView & {
  id: string;
  source: 'LINK' | 'CODE';
  createdAt: Date;
  expiresAt: Date;
};

type ReferralStore = {
  findActiveRuleByCode(code: string): Promise<ReferralRuleView | null>;
  createAttribution(input: {
    id: string;
    creatorId: string;
    ruleVersionId: string;
    source: 'LINK' | 'CODE';
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  findAttribution(id: string): Promise<ReferralAttributionView | null>;
};

type ReferralQuote = {
  id: string;
  experienceId: string;
  productSlug: string;
  variantId: string;
  grossAmountMinor?: number;
  discountAmountMinor?: number;
  amountMinor: number;
  currency: string;
  referralAttributionId?: string | null;
  referralCreatorId?: string | null;
  referralRuleVersionId?: string | null;
  referralRuleSnapshot?: unknown | null;
  expiresAt: Date;
};

type ReferralQuoteStore = {
  findById(id: string): Promise<ReferralQuote | null>;
  findLatestByExperienceId(experienceId: string): Promise<ReferralQuote | null>;
  create(record: ReferralQuote): Promise<void>;
};

type Dependencies = {
  referrals: ReferralStore;
  quotes: ReferralQuoteStore;
  contacts: {
    findVerifiedByExperienceId(experienceId: string): Promise<{ emailHash: string } | null>;
  };
  experiences: {
    findBySessionHash(sessionHash: string): Promise<{ id: string; stage: string } | null>;
  };
  signingKey: string;
  now?: () => Date;
  createAttributionId?: () => string;
  createQuoteId?: () => string;
};

function discountFor(grossAmountMinor: number, rules: ReferralRules): number {
  const validated = validateReferralRules(rules);
  const discount = validated.customerDiscount.mode === 'PERCENT'
    ? Math.floor((grossAmountMinor * validated.customerDiscount.basisPoints) / 10_000)
    : validated.customerDiscount.amountMinor;
  if (!Number.isSafeInteger(discount) || discount <= 0 || discount >= grossAmountMinor) return 0;
  return discount;
}

function currentGross(quote: ReferralQuote): number {
  const gross = quote.grossAmountMinor ?? quote.amountMinor;
  if (!Number.isSafeInteger(gross) || gross <= 0) throw new Error('Referral quote gross amount is invalid');
  return gross;
}

export class ReferralService {
  private readonly now: () => Date;
  private readonly createAttributionId: () => string;
  private readonly createQuoteId: () => string;

  constructor(private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createAttributionId = dependencies.createAttributionId ?? (() => randomUUID());
    this.createQuoteId = dependencies.createQuoteId ?? (() => randomUUID());
  }

  async captureLink(code: string): Promise<{ normalizedCode: string; token: string; expiresAt: Date }> {
    const normalizedCode = normalizeReferralCode(code);
    const rule = await this.dependencies.referrals.findActiveRuleByCode(normalizedCode);
    if (!rule || !rule.active) throw new Error('Referral code is unavailable');

    const now = this.now();
    const expiresAt = new Date(now.getTime() + validateReferralRules(rule.rules).attributionWindowDays * 86_400_000);
    const attributionId = this.createAttributionId();
    await this.dependencies.referrals.createAttribution({
      id: attributionId,
      creatorId: rule.creatorId,
      ruleVersionId: rule.ruleVersionId,
      source: 'LINK',
      createdAt: now,
      expiresAt,
    });

    return {
      normalizedCode,
      token: createReferralAttributionToken({ attributionId, expiresAt }, this.dependencies.signingKey),
      expiresAt,
    };
  }

  async applyToQuote(input: {
    sessionToken: string;
    quoteId: string;
    explicitCode?: string;
    attributionToken?: string;
  }): Promise<{
    quoteId: string;
    grossAmountMinor: number;
    discountAmountMinor: number;
    amountMinor: number;
    currency: string;
    applied: boolean;
    normalizedCode?: string;
  }> {
    const experience = await this.dependencies.experiences.findBySessionHash(hashSessionToken(input.sessionToken));
    if (!experience) throw new Error('Experience not found');
    if (experience.stage !== 'COMMITMENT_READY') throw new Error('Referral attribution is frozen after checkout starts');

    const quote = await this.dependencies.quotes.findById(input.quoteId);
    if (!quote || quote.experienceId !== experience.id) throw new Error('Referral quote does not belong to this experience');
    const latest = await this.dependencies.quotes.findLatestByExperienceId(experience.id);
    if (!latest || latest.id !== quote.id) throw new Error('Referral can only replace the latest quote');

    const grossAmountMinor = currentGross(quote);
    const unchanged = () => ({
      quoteId: quote.id,
      grossAmountMinor,
      discountAmountMinor: quote.discountAmountMinor ?? 0,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      applied: false,
    });

    const contact = await this.dependencies.contacts.findVerifiedByExperienceId(experience.id);
    if (!contact) return unchanged();

    let rule: ReferralRuleView | null = null;
    let attributionId: string | null = null;

    if (input.explicitCode?.trim()) {
      let normalizedCode: string;
      try {
        normalizedCode = normalizeReferralCode(input.explicitCode);
      } catch {
        return unchanged();
      }
      rule = await this.dependencies.referrals.findActiveRuleByCode(normalizedCode);
      if (!rule || !rule.active) return unchanged();

      const now = this.now();
      attributionId = this.createAttributionId();
      const expiresAt = new Date(now.getTime() + validateReferralRules(rule.rules).attributionWindowDays * 86_400_000);
      await this.dependencies.referrals.createAttribution({
        id: attributionId,
        creatorId: rule.creatorId,
        ruleVersionId: rule.ruleVersionId,
        source: 'CODE',
        createdAt: now,
        expiresAt,
      });
    } else if (input.attributionToken) {
      const verified = verifyReferralAttributionToken(input.attributionToken, this.dependencies.signingKey, this.now());
      if (!verified) return unchanged();
      const attribution = await this.dependencies.referrals.findAttribution(verified.attributionId);
      if (!attribution || !attribution.active || attribution.expiresAt.getTime() <= this.now().getTime()) return unchanged();
      attributionId = attribution.id;
      rule = attribution;
    } else {
      return unchanged();
    }

    if (!rule || !attributionId || rule.creatorEmailHash.toLowerCase() === contact.emailHash.toLowerCase()) return unchanged();

    const discountAmountMinor = discountFor(grossAmountMinor, rule.rules);
    if (discountAmountMinor <= 0) return unchanged();
    const amountMinor = grossAmountMinor - discountAmountMinor;
    if (amountMinor <= 0) return unchanged();

    const replacement: ReferralQuote = {
      id: this.createQuoteId(),
      experienceId: quote.experienceId,
      productSlug: quote.productSlug,
      variantId: quote.variantId,
      grossAmountMinor,
      discountAmountMinor,
      amountMinor,
      currency: quote.currency,
      referralAttributionId: attributionId,
      referralCreatorId: rule.creatorId,
      referralRuleVersionId: rule.ruleVersionId,
      referralRuleSnapshot: {
        code: rule.normalizedCode,
        rules: validateReferralRules(rule.rules),
      },
      expiresAt: quote.expiresAt,
    };
    await this.dependencies.quotes.create(replacement);

    return {
      quoteId: replacement.id,
      grossAmountMinor,
      discountAmountMinor,
      amountMinor,
      currency: replacement.currency,
      applied: true,
      normalizedCode: rule.normalizedCode,
    };
  }
}
