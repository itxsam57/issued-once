type PreviewEnvironment = Record<string, string | undefined>;

export function isVisualPreviewEnabled(environment: PreviewEnvironment): boolean {
  return environment.ENABLE_VISUAL_PREVIEW === '1';
}
