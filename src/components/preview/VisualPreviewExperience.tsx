'use client';

import { InterviewFlow } from '@/components/experience/InterviewFlow';

export function VisualPreviewExperience() {
  return (
    <main className="visual-preview">
      <div className="visual-preview__marker" role="note">
        VISUAL QA / NOT PRODUCTION
      </div>
      <InterviewFlow onAnswer={async () => undefined} />
    </main>
  );
}
