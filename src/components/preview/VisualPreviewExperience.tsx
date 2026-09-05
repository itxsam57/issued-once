'use client';

import { useState } from 'react';
import { MysteryExperience } from '@/components/experience/MysteryExperience';
import styles from './VisualPreviewExperience.module.css';

const VISUAL_QA_SIZE_CATALOG = {
  tee: [
    { code: 'XS', label: 'Extra small', measurements: 'Chest 17 in · Length 27 in' },
    { code: 'S', label: 'Small', measurements: 'Chest 18 in · Length 28 in' },
    { code: 'M', label: 'Medium', measurements: 'Chest 20 in · Length 29 in' },
    { code: 'L', label: 'Large', measurements: 'Chest 22 in · Length 30 in' },
    { code: 'XL', label: 'Extra large', measurements: 'Chest 24 in · Length 31 in' },
    { code: '2XL', label: '2X large', measurements: 'Chest 26 in · Length 32 in' },
  ],
  hoodie: [
    { code: 'S', label: 'Small', measurements: 'Chest 20 in · Length 26 in' },
    { code: 'M', label: 'Medium', measurements: 'Chest 22 in · Length 27 in' },
    { code: 'L', label: 'Large', measurements: 'Chest 24 in · Length 28 in' },
  ],
  hat: [{ code: 'OS', label: 'One size', measurements: 'Adjustable closure' }],
  tote: [{ code: 'OS', label: 'One size', measurements: 'One size' }],
} as const;

const VISUAL_QA_TEE_COLORS = [
  { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
  { code: 'black', label: 'Black', swatch: '#171713' },
  { code: 'ash', label: 'Ash', swatch: '#aaa69d' },
  { code: 'navy', label: 'Navy', swatch: '#202834' },
  { code: 'forest', label: 'Forest', swatch: '#344238' },
] as const;

const VISUAL_QA_BASE_COLOR_CATALOG = {
  tee: {
    XS: VISUAL_QA_TEE_COLORS,
    S: VISUAL_QA_TEE_COLORS,
    M: VISUAL_QA_TEE_COLORS,
    L: VISUAL_QA_TEE_COLORS,
    XL: VISUAL_QA_TEE_COLORS,
    '2XL': VISUAL_QA_TEE_COLORS,
  },
  hoodie: {
    S: [
      { code: 'black', label: 'Black', swatch: '#171713' },
      { code: 'ash', label: 'Ash', swatch: '#aaa69d' },
    ],
    M: [
      { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
      { code: 'black', label: 'Black', swatch: '#171713' },
      { code: 'ash', label: 'Ash', swatch: '#aaa69d' },
    ],
    L: [
      { code: 'black', label: 'Black', swatch: '#171713' },
      { code: 'ash', label: 'Ash', swatch: '#aaa69d' },
    ],
  },
  hat: {
    OS: [
      { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
      { code: 'black', label: 'Black', swatch: '#171713' },
    ],
  },
  tote: {
    OS: [
      { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
      { code: 'black', label: 'Black', swatch: '#171713' },
    ],
  },
} as const;

const VISUAL_QA_PRICE_MINOR = {
  tee: 3200,
  hat: 3400,
  tote: 3600,
} as const;

const PREVIEW_CHALLENGE_ID = 'owner-preview-challenge';
const PREVIEW_OTP = '123456';

type VisualPreviewExperienceProps = {
  mode?: 'qa' | 'owner';
};

export function VisualPreviewExperience({ mode = 'qa' }: VisualPreviewExperienceProps) {
  const [previewComplete, setPreviewComplete] = useState(false);
  const isOwnerPreview = mode === 'owner';
  const marker = isOwnerPreview
    ? 'OWNER PREVIEW / NO PAYMENT'
    : 'VISUAL QA / NOT PRODUCTION';

  if (previewComplete) {
    return (
      <main className="visual-preview io-customer-theme" data-io-surface="secret-motion">
        <div className="visual-preview__marker" role="note">
          {marker}
        </div>
        <section className="commitment" aria-labelledby="owner-preview-complete-heading">
          <p className="commitment__signal">PREVIEW / COMPLETE</p>
          <h1 id="owner-preview-complete-heading">PREVIEW COMPLETE.</h1>
          <p className="commitment__unknown">No payment was attempted.</p>
          <p className="commitment__unknown">
            Live payment exists only in the production customer journey.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="visual-preview io-customer-theme" data-io-surface="secret-motion">
      <div className="visual-preview__marker" role="note">
        {marker}
      </div>
      {isOwnerPreview ? (
        <div className={styles.otpHint} role="note">
          PREVIEW OTP / {PREVIEW_OTP}
        </div>
      ) : null}
      <MysteryExperience
        onAnswer={async () => undefined}
        onObjectSelected={async () => undefined}
        sizeCatalog={VISUAL_QA_SIZE_CATALOG}
        onSizeConfirmed={async () => undefined}
        baseColorCatalog={VISUAL_QA_BASE_COLOR_CATALOG}
        onBaseColorConfirmed={async () => undefined}
        getCommitmentQuote={async (selection) => {
          const amountMinor = selection.object === 'tee'
            ? VISUAL_QA_PRICE_MINOR.tee
            : selection.object === 'hat'
              ? VISUAL_QA_PRICE_MINOR.hat
              : selection.object === 'tote'
                ? VISUAL_QA_PRICE_MINOR.tote
                : null;
          if (amountMinor == null) return null;
          return {
            quoteId: `qa-${selection.object}-${selection.sizeCode}-${selection.colorCode}`,
            amountMinor,
            currency: 'USD',
            expiresAt: '2099-01-01T00:00:00.000Z',
          };
        }}
        onRequestOtp={async () => ({ challengeId: PREVIEW_CHALLENGE_ID, retryAfterSeconds: 0 })}
        onVerifyOtp={async (challengeId, code) => {
          if (challengeId !== PREVIEW_CHALLENGE_ID || code !== PREVIEW_OTP) {
            throw new Error('Preview OTP mismatch');
          }
          return { verified: true as const };
        }}
        onShippingSubmitted={async () => undefined}
        onCheckoutRequested={async () => setPreviewComplete(true)}
      />
    </main>
  );
}
