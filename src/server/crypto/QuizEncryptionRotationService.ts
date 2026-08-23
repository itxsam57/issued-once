import { decryptPrivatePayload, encryptPrivatePayload } from './privatePayload';
import type { QuizEncryptionRotationRepository } from './QuizEncryptionRotationRepository';

export type QuizEncryptionRotationBatchResult = {
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  remaining: number;
};

export class QuizEncryptionRotationService {
  constructor(private readonly repository: QuizEncryptionRotationRepository) {}

  async migrateBatch(limit: number): Promise<QuizEncryptionRotationBatchResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      throw new Error('Quiz encryption rotation batch limit must be between 1 and 250');
    }

    const rows = await this.repository.listV1(limit);
    let scanned = 0;
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      scanned += 1;
      try {
        const plaintext = await decryptPrivatePayload<unknown>({
          version: row.payloadVersion,
          keyVersion: row.keyVersion,
          iv: row.iv,
          tag: row.tag,
          ciphertext: row.ciphertext,
        });
        const encrypted = await encryptPrivatePayload(plaintext);
        const replaced = await this.repository.replaceV1(row, encrypted);
        if (replaced) migrated += 1;
        else skipped += 1;
      } catch {
        failed += 1;
        break;
      }
    }

    return {
      scanned,
      migrated,
      skipped,
      failed,
      remaining: await this.repository.countV1(),
    };
  }
}
