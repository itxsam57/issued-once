import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
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
  });

  test('homepage is a reference-owned presentation tree, not the rejected material-study patch', () => {
    const page = read('src/app/page.tsx');
    expect(page).not.toContain('HomeMaterialStudy');
    render(<Home />);
    expect(screen.getByTestId('reference-home')).toBeInTheDocument();
    expect(screen.queryByTestId('home-material-study')).toBeNull();
  });
});
