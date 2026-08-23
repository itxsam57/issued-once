import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import type { ArtworkStorageGateway } from './ArtworkStorageGateway';

const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]+$/;

function safeIdentifier(value: string, name: string): string {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`${name} identifier is invalid`);
  return value;
}

function assertInsideRoot(root: string, target: string): void {
  const rel = relative(root, target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== target) {
    throw new Error('Artwork path is invalid');
  }
}

export class FilesystemArtworkStorage implements ArtworkStorageGateway {
  private readonly root: string;

  constructor(root: string) {
    if (!root.trim()) throw new Error('Artwork storage directory is required');
    this.root = resolve(root);
  }

  async put(input: {
    issueId: string;
    designJobId: string;
    bytes: Buffer;
    mimeType: 'image/png';
  }): Promise<{ url: string; bytes: number }> {
    if (!input.bytes.length) throw new Error('Artwork cannot be empty');
    const issueId = safeIdentifier(input.issueId, 'Issue');
    const designJobId = safeIdentifier(input.designJobId, 'Design job');
    const key = `issues/${issueId}/design/${designJobId}.png`;
    const target = resolve(this.root, ...key.split('/'));
    assertInsideRoot(this.root, target);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.bytes, { flag: 'wx' });
    return { url: `fs://${key}`, bytes: input.bytes.length };
  }
}
