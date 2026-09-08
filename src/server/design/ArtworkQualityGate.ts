export type ArtworkReviewCandidate = {
  issueId: string;
  designJobId: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  state: 'QUEUED' | 'INTERPRETING' | 'GENERATING' | 'REVIEW' | 'APPROVED' | 'FAILED';
  artworkUrl: string | null;
  artworkMimeType: string | null;
  artworkBytes: number | null;
  width: number | null;
  height: number | null;
};

export type ArtworkPrintTemplate = {
  objectType: string;
  sizeCode: string;
  colorCode: string;
  placementWidth: number;
  placementHeight: number;
  targetDpi: number;
};

export interface ArtworkPrintTemplateResolver {
  resolve(input: { objectType: string; sizeCode: string; colorCode: string }): ArtworkPrintTemplate;
}

const MIN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  tee: { width: 1024, height: 1536 },
  hoodie: { width: 1024, height: 1536 },
  tote: { width: 1024, height: 1536 },
  hat: { width: 1024, height: 1024 },
};

const SAFE_DURABLE_SEGMENT = /^[A-Za-z0-9_:-]+$/;

function validateDurableLocator(candidate: ArtworkReviewCandidate, value: string): string {
  const key = value.slice('artwork://'.length);
  const segments = key.split('/');
  if (
    segments.length !== 2
    || segments.some((segment) => !segment || !SAFE_DURABLE_SEGMENT.test(segment))
  ) {
    throw new Error('Production artwork durable locator is invalid');
  }
  const [issueId, artifactId] = segments;
  if (issueId !== candidate.issueId) {
    throw new Error('Production artwork durable locator does not match the Issue');
  }
  const manualPrefix = `${candidate.designJobId}-owner-upload:`;
  if (artifactId !== candidate.designJobId && !artifactId.startsWith(manualPrefix)) {
    throw new Error('Production artwork durable locator is not canonical for this design');
  }
  return 'storage:durable-private';
}

function validatePrivateArtworkLocator(candidate: ArtworkReviewCandidate): string {
  const value = candidate.artworkUrl;
  if (!value) throw new Error('Artwork URL is missing');

  if (value.startsWith('artwork://')) {
    return validateDurableLocator(candidate, value);
  }
  if (value.startsWith('fs://')) {
    throw new Error('Production artwork must use durable private storage, not a deployment filesystem');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Artwork URL must use private durable storage');
  }
  if (url.protocol !== 'https:') throw new Error('Artwork URL must use HTTPS or durable private storage');
  if (!url.hostname.endsWith('.private.blob.vercel-storage.com')) {
    throw new Error('Production artwork must use private storage');
  }
  return 'storage:private-blob';
}

function exactTemplateKey(input: { objectType: string; sizeCode: string; colorCode: string }): string {
  return `${input.objectType}:${input.sizeCode}:${input.colorCode}`;
}

function validateTemplate(candidate: ArtworkReviewCandidate, template: ArtworkPrintTemplate): string {
  const candidateKey = exactTemplateKey(candidate);
  const templateKey = exactTemplateKey(template);
  if (templateKey !== candidateKey) {
    throw new Error(`Print template mapping ${templateKey} does not match physical selection ${candidateKey}`);
  }
  if (
    !Number.isFinite(template.placementWidth) || template.placementWidth <= 0
    || !Number.isFinite(template.placementHeight) || template.placementHeight <= 0
    || !Number.isFinite(template.targetDpi) || template.targetDpi <= 0
  ) {
    throw new Error('Print template placement/DPI values are invalid');
  }
  return templateKey;
}

export class ArtworkQualityGate {
  validate(candidate: ArtworkReviewCandidate, template: ArtworkPrintTemplate): { ok: true; checks: readonly string[] } {
    const checks: string[] = [];
    if (candidate.state !== 'REVIEW') throw new Error('Artwork must be in review before approval');
    checks.push('state:review');

    checks.push(validatePrivateArtworkLocator(candidate));

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

    const templateKey = validateTemplate(candidate, template);
    checks.push(`template:${templateKey}`);

    const horizontalDpi = (candidate.width * template.targetDpi) / template.placementWidth;
    const verticalDpi = (candidate.height * template.targetDpi) / template.placementHeight;
    const effectiveDpi = Math.min(horizontalDpi, verticalDpi);
    checks.push(`effective-dpi:${effectiveDpi.toFixed(2)}`);
    if (effectiveDpi < template.targetDpi) {
      throw new Error(`Artwork effective DPI ${effectiveDpi.toFixed(2)} is below the print placement target ${template.targetDpi}`);
    }

    return { ok: true, checks };
  }
}
