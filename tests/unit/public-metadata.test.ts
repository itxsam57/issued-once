import { describe, expect, test } from 'vitest';
import { PUBLIC_METADATA } from '@/brand/publicMetadata';

const revealTerms = /\b(?:apparel|clothing|shirt|tee|hoodie|hat|garment|merch|design|artwork|personalized)\b/i;

describe('public metadata', () => {
  test('does not reveal the product category before the visitor enters', () => {
    expect(PUBLIC_METADATA.title).toBe('ISSUED ONCE');
    expect(PUBLIC_METADATA.description).toBeTruthy();
    expect(PUBLIC_METADATA.description).not.toMatch(revealTerms);
  });
});
