'use client';

import { MysteryExperience } from '@/components/experience/MysteryExperience';

const VISUAL_QA_SIZE_CATALOG = {
  tee: [
    { code: 'S', label: 'Small', measurements: 'Chest 18 in · Length 28 in' },
    { code: 'M', label: 'Medium', measurements: 'Chest 20 in · Length 29 in' },
    { code: 'L', label: 'Large', measurements: 'Chest 22 in · Length 30 in' },
  ],
  hoodie: [
    { code: 'S', label: 'Small', measurements: 'Chest 20 in · Length 26 in' },
    { code: 'M', label: 'Medium', measurements: 'Chest 22 in · Length 27 in' },
    { code: 'L', label: 'Large', measurements: 'Chest 24 in · Length 28 in' },
  ],
  hat: [{ code: 'OS', label: 'One size', measurements: 'Adjustable closure' }],
} as const;

const VISUAL_QA_BASE_COLOR_CATALOG = {
  tee: {
    S: [
      { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
      { code: 'black', label: 'Black', swatch: '#171713' },
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
} as const;

const VISUAL_QA_COMMITMENT_QUOTE = {
  quoteId: 'qa-live-quote-001',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: '2026-08-18T06:00:00.000Z',
} as const;

export function VisualPreviewExperience() {
  return (
    <main className="visual-preview">
      <div className="visual-preview__marker" role="note">
        VISUAL QA / NOT PRODUCTION
      </div>
      <MysteryExperience
        onAnswer={async () => undefined}
        onObjectSelected={async () => undefined}
        sizeCatalog={VISUAL_QA_SIZE_CATALOG}
        onSizeConfirmed={async () => undefined}
        baseColorCatalog={VISUAL_QA_BASE_COLOR_CATALOG}
        onBaseColorConfirmed={async () => undefined}
        getCommitmentQuote={async () => VISUAL_QA_COMMITMENT_QUOTE}
        onCheckoutRequested={async () => undefined}
      />
    </main>
  );
}
