export type ArtworkReviewCandidate = {
  issueId: string;
  designJobId: string;
  objectType: string;
  state: 'QUEUED' | 'INTERPRETING' | 'GENERATING' | 'REVIEW' | 'APPROVED' | 'FAILED';
  artworkUrl: string | null;
  artworkMimeType: string | null;
  artworkBytes: number | null;
  width: number | null;
  height: number | null;
};

const MIN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  tee: { width: 1024, height: 1536 },
  hoodie: { width: 1024, height: 1536 },
  tote: { width: 1024, height: 1536 },
  hat: { width: 1024, height: 1024 },
};

export class ArtworkQualityGate {
  validate(candidate: ArtworkReviewCandidate): { ok: true; checks: readonly string[] } {
    const checks: string[] = [];
    if (candidate.state !== 'REVIEW') throw new Error('Artwork must be in review before approval');
    checks.push('state:review');

    if (!candidate.artworkUrl) throw new Error('Artwork URL is missing');
    const url = new URL(candidate.artworkUrl);
    if (url.protocol !== 'https:') throw new Error('Artwork URL must use HTTPS');
    checks.push('url:https');
    if (!url.hostname.endsWith('.private.blob.vercel-storage.com')) {
      throw new Error('Production artwork must use private Blob storage');
    }
    checks.push('storage:private');

    if (candidate.artworkMimeType !== 'image/png') throw new Error('Production artwork must be PNG');
    checks.push('mime:png');

    if (!candidate.artworkBytes || candidate.artworkBytes < 10_000) throw new Error('Artwork bytes are empty or implausibly small');
    checks.push('bytes:nonempty');

    const minimum = MIN_DIMENSIONS[candidate.objectType];
    if (!minimum) throw new Error('Object type has no approved print profile');
    if (!candidate.width || !candidate.height || candidate.width < minimum.width || candidate.height < minimum.height) {
      throw new Error('Artwork resolution/dimensions are below the approved print profile');
    }
    checks.push(`dimensions:${candidate.width}x${candidate.height}`);

    return { ok: true, checks };
  }
}
