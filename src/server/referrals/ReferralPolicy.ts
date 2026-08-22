export type ReferralPercentValue = {
  mode: 'PERCENT';
  basisPoints: number;
};

export type ReferralFixedValue = {
  mode: 'FIXED';
  amountMinor: number;
};

export type ReferralValue = ReferralPercentValue | ReferralFixedValue;

export type ReferralRules = {
  customerDiscount: ReferralValue;
  creatorReward: ReferralValue;
  payoutCadence: 'MONTHLY' | 'THRESHOLD';
  payoutThresholdMinor: number | null;
  attributionWindowDays: number;
};

function positiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function validateValue(value: ReferralValue, kind: 'discount' | 'reward'): ReferralValue {
  if (value.mode === 'PERCENT') {
    positiveInteger(value.basisPoints, `${kind} basis points`);
    const maximum = kind === 'discount' ? 9_999 : 10_000;
    if (value.basisPoints > maximum) {
      throw new Error(`${kind} percentage is outside the allowed range`);
    }
    return { mode: 'PERCENT', basisPoints: value.basisPoints };
  }

  if (value.mode === 'FIXED') {
    positiveInteger(value.amountMinor, `${kind} fixed amount`);
    return { mode: 'FIXED', amountMinor: value.amountMinor };
  }

  throw new Error(`${kind} mode is invalid`);
}

export function normalizeReferralCode(input: string): string {
  const normalized = input.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$/.test(normalized)) {
    throw new Error('Referral code must be 3-32 letters, digits, or internal hyphens');
  }
  return normalized;
}

export function validateReferralRules(input: ReferralRules): ReferralRules {
  const customerDiscount = validateValue(input.customerDiscount, 'discount');
  const creatorReward = validateValue(input.creatorReward, 'reward');
  positiveInteger(input.attributionWindowDays, 'attribution window');

  if (input.payoutCadence === 'THRESHOLD') {
    if (input.payoutThresholdMinor === null) {
      throw new Error('Threshold payout cadence requires a threshold amount');
    }
    positiveInteger(input.payoutThresholdMinor, 'threshold amount');
  } else if (input.payoutCadence === 'MONTHLY') {
    if (input.payoutThresholdMinor !== null) {
      throw new Error('Monthly payout cadence does not use a threshold amount');
    }
  } else {
    throw new Error('Payout cadence is invalid');
  }

  return {
    customerDiscount,
    creatorReward,
    payoutCadence: input.payoutCadence,
    payoutThresholdMinor: input.payoutThresholdMinor,
    attributionWindowDays: input.attributionWindowDays,
  };
}

export function referralValueColumns(value: ReferralValue): {
  mode: ReferralValue['mode'];
  basisPoints: number | null;
  fixedMinor: number | null;
} {
  return value.mode === 'PERCENT'
    ? { mode: value.mode, basisPoints: value.basisPoints, fixedMinor: null }
    : { mode: value.mode, basisPoints: null, fixedMinor: value.amountMinor };
}
