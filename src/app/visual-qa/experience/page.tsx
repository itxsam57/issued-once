import { notFound } from 'next/navigation';
import { VisualPreviewExperience } from '@/components/preview/VisualPreviewExperience';
import { isVisualPreviewEnabled } from '@/server/preview/visualPreview';

export default function VisualQaExperiencePage() {
  if (!isVisualPreviewEnabled(process.env)) {
    notFound();
  }

  return <VisualPreviewExperience />;
}
