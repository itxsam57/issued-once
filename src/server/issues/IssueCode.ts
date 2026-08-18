import { randomBytes } from 'node:crypto';

const ISSUE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

type RandomBytesSource = (size: number) => Uint8Array;

const defaultRandomBytes: RandomBytesSource = (size) => randomBytes(size);

export function generateIssueCode(
  randomBytesSource: RandomBytesSource = defaultRandomBytes,
): string {
  const bytes = randomBytesSource(8);
  if (bytes.length < 8) {
    throw new Error('Issue code entropy source returned too few bytes');
  }

  const characters = Array.from(bytes.slice(0, 8), (byte) =>
    ISSUE_ALPHABET[byte % ISSUE_ALPHABET.length],
  );

  return `IO-${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
}
