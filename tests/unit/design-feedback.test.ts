import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('DesignService keeps owner feedback separate from the seven customer answers', () => {
  const source = readFileSync('src/server/design/DesignService.ts', 'utf8');

  expect(source).toMatch(/createForIssue\(issueId: string, ownerFeedback\?: string\)/);
  expect(source).toMatch(/questions,\s*\.\.\.\(feedback \? \{ ownerFeedback: feedback \} : \{\}\)/s);
  expect(source).toMatch(/regenerateArtwork\(issueId: string, ownerFeedback\?: string\)/);
  expect(source).toMatch(/generateArtwork\(brief, \{\s*objectType: input\.objectType,\s*\.\.\.\(feedback \? \{ ownerFeedback: feedback \} : \{\}\),\s*\}\)/s);
});
