import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { VisualPreviewExperience } from '@/components/preview/VisualPreviewExperience';


describe('VisualPreviewExperience', () => {
  test('renders the real mystery components with an unmistakable non-production marker', () => {
    render(<VisualPreviewExperience />);

    expect(screen.getByText('VISUAL QA / NOT PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('01 / 07')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Name three things you can talk about for hours.' })).toBeInTheDocument();
    expect(screen.queryByText(/tee|hoodie|hat|shop now/i)).not.toBeInTheDocument();
  });
});
