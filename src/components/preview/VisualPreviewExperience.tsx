'use client';

import { MysteryExperience } from '@/components/experience/MysteryExperience';

export function VisualPreviewExperience() {
  return (
    <main className="visual-preview">
      <div className="visual-preview__marker" role="note">
        VISUAL QA / NOT PRODUCTION
      </div>
      <MysteryExperience
        onAnswer={async () => undefined}
        onObjectSelected={async () => undefined}
      />
    </main>
  );
}
