import { render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import Home from '@/app/page';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('reference UI isolation contract', () => {
  test('root layout does not globally mount legacy phase styles', () => {
    const layout = read('src/app/layout.tsx');
    for (const legacy of [
      './object-stage.css',
      './size-stage.css',
      './base-stage.css',
      './commitment-stage.css',
    ]) {
      expect(layout).not.toContain(legacy);
    }

    for (const legacyPath of [
      'src/app/object-stage.css',
      'src/app/size-stage.css',
      'src/app/base-stage.css',
      'src/app/commitment-stage.css',
      'src/components/home/HomeMaterialStudy.tsx',
      'src/components/public/public-utility-header.module.css',
    ]) {
      expect(existsSync(join(process.cwd(), legacyPath))).toBe(false);
    }
  });

  test('homepage is a reference-owned presentation tree, not the rejected material-study patch', () => {
    const page = read('src/app/page.tsx');
    expect(page).not.toContain('HomeMaterialStudy');
    render(<Home />);
    expect(screen.getByTestId('reference-home')).toBeInTheDocument();
    expect(screen.queryByTestId('home-material-study')).toBeNull();
  });

  test('every public transaction family is explicitly attached to the reference surface', () => {
    expect(read('src/app/MerchantPageShell.tsx')).toContain('data-reference-surface="merchant"');
    expect(read('src/app/begin/page.tsx')).toContain('data-reference-surface="begin"');
    expect(read('src/app/issue/page.tsx')).toContain('data-reference-surface="status"');
    expect(read('src/app/payment/pending/page.tsx')).toContain('data-reference-surface="pending"');
    const publicExperience = read('src/components/experience/PublicInterviewExperience.tsx');
    expect(publicExperience).toContain('data-reference-surface="entry-loading"');
    expect(publicExperience).toContain('data-reference-surface="entry-error"');
    expect(publicExperience).toContain('data-reference-surface="repeat"');
  });

  test('one reference stylesheet owns interview, physical form, fit, base, and commitment presentation', () => {
    const css = read('src/app/reference-ui.css');
    for (const selector of [
      '.interview-question',
      '.object-selection__options',
      '.size-confirmation__options',
      '.base-color__options',
      '.commitment__ledger',
    ]) {
      expect(css).toContain(selector);
    }
  });
});
