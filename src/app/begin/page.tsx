import { PublicInterviewExperience } from '@/components/experience/PublicInterviewExperience';
import { VisualPreviewExperience } from '@/components/preview/VisualPreviewExperience';

export default function BeginPage() {
  if (process.env.VERCEL_ENV === 'preview') {
    return <VisualPreviewExperience mode="owner" />;
  }

  return (
    <main className="public-interview io-customer-theme" data-io-surface="secret-motion">
      <PublicInterviewExperience />
    </main>
  );
}
