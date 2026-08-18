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
      />
    </main>
  );
}
