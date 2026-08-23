import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('Vercel deploys both design and customer-notification queue consumers', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8')) as {
    functions?: Record<string, { experimentalTriggers?: Array<{ type: string; topic: string }> }>;
  };

  expect(config.functions?.['src/app/api/queue/design/route.ts']?.experimentalTriggers).toContainEqual(
    expect.objectContaining({ type: 'queue/v2beta', topic: 'issued-once-design' }),
  );
  expect(config.functions?.['src/app/api/queue/notifications/route.ts']?.experimentalTriggers).toContainEqual(
    expect.objectContaining({ type: 'queue/v2beta', topic: 'issued-once-notifications' }),
  );
});
