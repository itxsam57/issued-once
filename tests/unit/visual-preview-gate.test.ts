import { describe, expect, test } from 'vitest';
import { isVisualPreviewEnabled } from '@/server/preview/visualPreview';

describe('visual preview gate', () => {
  test('is closed by default and opens only with the explicit harness flag', () => {
    expect(isVisualPreviewEnabled({})).toBe(false);
    expect(isVisualPreviewEnabled({ ENABLE_VISUAL_PREVIEW: '0' })).toBe(false);
    expect(isVisualPreviewEnabled({ ENABLE_VISUAL_PREVIEW: '1' })).toBe(true);
  });
});
