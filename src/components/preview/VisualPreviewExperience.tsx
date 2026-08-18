'use client';

import { useState } from 'react';
import { MysteryExperience } from '@/components/experience/MysteryExperience';

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

const VISUAL_QA_COMMITMENT_QUOTE = {
  quoteId: 'qa-live-quote-001',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: '2026-08-18T06:00:00.000Z',
} as const;

type VisualPreviewExperienceProps = {
  mode?: 'qa' | 'owner';
};

async function requestCheckout(quoteId: string): Promise<void> {
  const response = await fetch('/api/checkout/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ quoteId }),
  });

  if (!response.ok) {
    throw new Error('Checkout could not be opened');
  }

  const payload = (await response.json()) as { checkoutUrl?: string };
  if (!payload.checkoutUrl) {
    throw new Error('Checkout response is invalid');
  }

  window.location.assign(payload.checkoutUrl);
}

export function VisualPreviewExperience({ mode = 'qa' }: VisualPreviewExperienceProps) {
  const [ownerComplete, setOwnerComplete] = useState(false);
  const isOwnerPreview = mode === 'owner';
  const marker = isOwnerPreview
    ? 'OWNER PREVIEW / NO PAYMENT'
    : 'VISUAL QA / NOT PRODUCTION';

  if (ownerComplete) {
    return (
      <main className="visual-preview">
        <div className="visual-preview__marker" role="note">
          OWNER PREVIEW / NO PAYMENT
        </div>
        <section className="commitment" aria-labelledby="owner-preview-complete-heading">
          <p className="commitment__signal">PREVIEW / COMPLETE</p>
          <h1 id="owner-preview-complete-heading">PREVIEW COMPLETE.</h1>
          <p className="commitment__unknown">No payment was attempted.</p>
          <p className="commitment__unknown">
            Live checkout stays disabled until production commerce is configured.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="visual-preview">
      <div className="visual-preview__marker" role="note">
        {marker}
      </div>
      <MysteryExperience
        onAnswer={async () => undefined}
        onObjectSelected={async () => undefined}
        sizeCatalog={VISUAL_QA_SIZE_CATALOG}
        onSizeConfirmed={async () => undefined}
        baseColorCatalog={VISUAL_QA_BASE_COLOR_CATALOG}
        onBaseColorConfirmed={async () => undefined}
        getCommitmentQuote={async () => VISUAL_QA_COMMITMENT_QUOTE}
        onCheckoutRequested={
          isOwnerPreview
            ? async () => setOwnerComplete(true)
            : requestCheckout
        }
      />
    </main>
  );
}
