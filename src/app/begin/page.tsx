import { PublicInterviewExperience } from '@/components/experience/PublicInterviewExperience';
import { VisualPreviewExperience } from '@/components/preview/VisualPreviewExperience';

export default function BeginPage() {
  if (process.env.VERCEL_ENV === 'preview') {
    return <VisualPreviewExperience />;
  }

  return (
    <main className="public-interview">
      <PublicInterviewExperience />
    </main>
  );
}
