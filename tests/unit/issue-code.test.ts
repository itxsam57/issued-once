import { describe, expect, test } from 'vitest';
import { generateIssueCode } from '@/server/issues/IssueCode';

const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

describe('generateIssueCode', () => {
  test('produces a human-readable non-sequential Issue code with no ambiguous random characters', () => {
    const code = generateIssueCode(() => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]));

    expect(code).toMatch(/^IO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(code.slice(3)).not.toMatch(/[01ILO]/);
    expect(code).toBe(
      `IO-${alphabet[0]}${alphabet[1]}${alphabet[2]}${alphabet[3]}-${alphabet[4]}${alphabet[5]}${alphabet[6]}${alphabet[7]}`,
    );
  });

  test('does not depend on timestamps or a sales sequence', () => {
    const bytes = Uint8Array.from([31, 30, 29, 28, 27, 26, 25, 24]);
    const first = generateIssueCode(() => bytes);
    const second = generateIssueCode(() => bytes);

    expect(second).toBe(first);
    expect(first).not.toMatch(/2026|000001|000002/);
  });
});
