import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { ShippingRepository, ShippingSnapshotRecord } from './ShippingRepository';

type Row = {
  id: string;
  experience_id: string;
  contact_id: string;
  country_code: string;
  payload_version: 1;
  key_version: 'v1';
  iv: string;
  auth_tag: string;
  ciphertext: string;
  created_at: Date | string;
  updated_at: Date | string;
};

const toDate = (value: Date | string) => value instanceof Date ? value : new Date(value);

function fromRow(row: Row): ShippingSnapshotRecord {
  const encryptedAddress: EncryptedPayload = {
    version: row.payload_version,
    keyVersion: row.key_version,
    iv: row.iv,
    tag: row.auth_tag,
    ciphertext: row.ciphertext,
  };
  return {
    id: row.id,
    experienceId: row.experience_id,
    contactId: row.contact_id,
    countryCode: row.country_code,
    encryptedAddress,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export class PostgresShippingRepository implements ShippingRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async upsert(record: ShippingSnapshotRecord): Promise<ShippingSnapshotRecord> {
    const e = record.encryptedAddress;
    const rows = await this.sql.query<Row>(
      `INSERT INTO shipping_snapshots (
         id, experience_id, contact_id, country_code, region_code, postal_prefix,
         payload_version, key_version, iv, auth_tag, ciphertext, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,NULL,NULL,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (experience_id) DO UPDATE
       SET contact_id = EXCLUDED.contact_id,
           country_code = EXCLUDED.country_code,
           payload_version = EXCLUDED.payload_version,
           key_version = EXCLUDED.key_version,
           iv = EXCLUDED.iv,
           auth_tag = EXCLUDED.auth_tag,
           ciphertext = EXCLUDED.ciphertext,
           updated_at = EXCLUDED.updated_at
       RETURNING id, experience_id, contact_id, country_code,
                 payload_version, key_version, iv, auth_tag, ciphertext, created_at, updated_at`,
      [
        record.id,
        record.experienceId,
        record.contactId,
        record.countryCode,
        e.version,
        e.keyVersion,
        e.iv,
        e.tag,
        e.ciphertext,
        record.createdAt,
        record.updatedAt,
      ],
    );
    if (!rows[0]) throw new Error('Shipping snapshot could not be persisted');
    return fromRow(rows[0]);
  }

  async findByExperienceId(experienceId: string): Promise<ShippingSnapshotRecord | null> {
    const rows = await this.sql.query<Row>(
      `SELECT id, experience_id, contact_id, country_code,
              payload_version, key_version, iv, auth_tag, ciphertext, created_at, updated_at
       FROM shipping_snapshots
       WHERE experience_id = $1
       LIMIT 1`,
      [experienceId],
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }
}
