import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ContactRepository,
  OtpChallengeRecord,
  OtpRateLimitReservation,
  VerifiedContactRecord,
} from './ContactRepository';

type ChallengeRow = {
  id: string;
  experience_id: string;
  email_hash: string;
  email_payload_version: 1;
  email_key_version: EncryptedPayload['keyVersion'];
  email_iv: string;
  email_auth_tag: string;
  email_ciphertext: string;
  ip_hash: string;
  code_hash: string;
  expires_at: Date | string;
  resend_available_at: Date | string;
  attempts_remaining: number;
  consumed_at: Date | string | null;
  created_at: Date | string;
};

type ContactRow = {
  id: string;
  experience_id: string;
  email_hash: string;
  payload_version: 1;
  key_version: EncryptedPayload['keyVersion'];
  iv: string;
  auth_tag: string;
  ciphertext: string;
  verified_at: Date | string;
};

type BoolRow = { ok: boolean };
type CountRow = { deleted_count: number | string };

const date = (value: Date | string) => value instanceof Date ? value : new Date(value);

function encryptedFromChallenge(row: ChallengeRow): EncryptedPayload {
  return {
    version: row.email_payload_version,
    keyVersion: row.email_key_version,
    iv: row.email_iv,
    tag: row.email_auth_tag,
    ciphertext: row.email_ciphertext,
  };
}

function challengeFromRow(row: ChallengeRow): OtpChallengeRecord {
  return {
    id: row.id,
    experienceId: row.experience_id,
    emailHash: row.email_hash,
    encryptedEmail: encryptedFromChallenge(row),
    ipHash: row.ip_hash,
    codeHash: row.code_hash,
    expiresAt: date(row.expires_at),
    resendAvailableAt: date(row.resend_available_at),
    attemptsRemaining: Number(row.attempts_remaining),
    consumedAt: row.consumed_at ? date(row.consumed_at) : null,
    createdAt: date(row.created_at),
  };
}

function contactFromRow(row: ContactRow): VerifiedContactRecord {
  return {
    id: row.id,
    experienceId: row.experience_id,
    emailHash: row.email_hash,
    encryptedEmail: {
      version: row.payload_version,
      keyVersion: row.key_version,
      iv: row.iv,
      tag: row.auth_tag,
      ciphertext: row.ciphertext,
    },
    verifiedAt: date(row.verified_at),
  };
}

const CHALLENGE_SELECT = `
  SELECT
    id, experience_id, email_hash,
    email_payload_version, email_key_version, email_iv, email_auth_tag, email_ciphertext,
    ip_hash, code_hash, expires_at, resend_available_at, attempts_remaining, consumed_at, created_at
  FROM otp_challenges`;

export class PostgresContactRepository implements ContactRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findRecentChallenge(experienceId: string, emailHash: string) {
    const rows = await this.sql.query<ChallengeRow>(
      `${CHALLENGE_SELECT}
       WHERE experience_id = $1
         AND email_hash = $2
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [experienceId, emailHash],
    );
    return rows[0] ? challengeFromRow(rows[0]) : null;
  }

  async reserveOtpRateLimit(input: OtpRateLimitReservation): Promise<boolean> {
    const rows = await this.sql.query<BoolRow>(
      `INSERT INTO otp_rate_limits (
         subject_kind, subject_hash,
         short_window_started_at, short_count,
         long_window_started_at, long_count,
         updated_at
       )
       VALUES ($1,$2,$3,1,$3,1,$3)
       ON CONFLICT (subject_kind, subject_hash) DO UPDATE
       SET short_window_started_at = CASE
             WHEN otp_rate_limits.short_window_started_at <= $4 THEN $3
             ELSE otp_rate_limits.short_window_started_at
           END,
           short_count = CASE
             WHEN otp_rate_limits.short_window_started_at <= $4 THEN 1
             ELSE otp_rate_limits.short_count + 1
           END,
           long_window_started_at = CASE
             WHEN otp_rate_limits.long_window_started_at <= $5 THEN $3
             ELSE otp_rate_limits.long_window_started_at
           END,
           long_count = CASE
             WHEN otp_rate_limits.long_window_started_at <= $5 THEN 1
             ELSE otp_rate_limits.long_count + 1
           END,
           updated_at = $3
       WHERE (otp_rate_limits.short_window_started_at <= $4 OR otp_rate_limits.short_count < $6)
         AND (otp_rate_limits.long_window_started_at <= $5 OR otp_rate_limits.long_count < $7)
       RETURNING TRUE AS ok`,
      [
        input.subjectKind,
        input.subjectHash,
        input.now,
        input.shortWindowCutoff,
        input.longWindowCutoff,
        input.shortLimit,
        input.longLimit,
      ],
    );
    return rows[0]?.ok === true;
  }

  async pruneOtpRateLimits(input: { olderThan: Date; limit: number }): Promise<number> {
    const rows = await this.sql.query<CountRow>(
      `WITH stale AS (
         SELECT subject_kind, subject_hash
         FROM otp_rate_limits
         WHERE updated_at < $1
         ORDER BY updated_at ASC
         LIMIT $2
       ), deleted AS (
         DELETE FROM otp_rate_limits AS rate
         USING stale
         WHERE rate.subject_kind = stale.subject_kind
           AND rate.subject_hash = stale.subject_hash
         RETURNING 1
       )
       SELECT COUNT(*)::int AS deleted_count
       FROM deleted`,
      [input.olderThan, input.limit],
    );
    return Number(rows[0]?.deleted_count ?? 0);
  }

  async createChallenge(record: OtpChallengeRecord): Promise<void> {
    const encrypted = record.encryptedEmail;
    await this.sql.query(
      `WITH invalidated AS (
         UPDATE otp_challenges
         SET consumed_at = $13
         WHERE experience_id = $2
           AND email_hash = $3
           AND consumed_at IS NULL
         RETURNING id
       )
       INSERT INTO otp_challenges (
         id, experience_id, email_hash,
         email_payload_version, email_key_version, email_iv, email_auth_tag, email_ciphertext,
         ip_hash, code_hash, expires_at, resend_available_at, attempts_remaining, consumed_at, created_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$14,NULL,$13)`,
      [
        record.id,
        record.experienceId,
        record.emailHash,
        encrypted.version,
        encrypted.keyVersion,
        encrypted.iv,
        encrypted.tag,
        encrypted.ciphertext,
        record.ipHash,
        record.codeHash,
        record.expiresAt,
        record.resendAvailableAt,
        record.createdAt,
        record.attemptsRemaining,
      ],
    );
  }

  async findChallenge(challengeId: string) {
    const rows = await this.sql.query<ChallengeRow>(
      `${CHALLENGE_SELECT} WHERE id = $1 LIMIT 1`,
      [challengeId],
    );
    return rows[0] ? challengeFromRow(rows[0]) : null;
  }

  async recordFailedAttempt(challengeId: string, attemptsRemaining: number): Promise<void> {
    await this.sql.query(
      `UPDATE otp_challenges
       SET attempts_remaining = LEAST(attempts_remaining, $2)
       WHERE id = $1
         AND consumed_at IS NULL`,
      [challengeId, attemptsRemaining],
    );
  }

  async verifyContact(input: {
    challengeId: string;
    contact: VerifiedContactRecord;
  }): Promise<boolean> {
    const encrypted = input.contact.encryptedEmail;
    const rows = await this.sql.query<BoolRow>(
      `WITH consumed AS (
         UPDATE otp_challenges
         SET consumed_at = $3
         WHERE id = $1
           AND experience_id = $2
           AND consumed_at IS NULL
           AND attempts_remaining > 0
           AND expires_at >= $3
         RETURNING id
       ), upserted AS (
         INSERT INTO verified_contacts (
           id, experience_id, email_hash,
           payload_version, key_version, iv, auth_tag, ciphertext,
           verified_at, updated_at
         )
         SELECT $4,$2,$5,$6,$7,$8,$9,$10,$3,$3
         WHERE EXISTS (SELECT 1 FROM consumed)
         ON CONFLICT (experience_id) DO UPDATE
         SET email_hash = EXCLUDED.email_hash,
             payload_version = EXCLUDED.payload_version,
             key_version = EXCLUDED.key_version,
             iv = EXCLUDED.iv,
             auth_tag = EXCLUDED.auth_tag,
             ciphertext = EXCLUDED.ciphertext,
             verified_at = EXCLUDED.verified_at,
             updated_at = EXCLUDED.updated_at
         RETURNING id
       )
       SELECT EXISTS (SELECT 1 FROM upserted) AS ok`,
      [
        input.challengeId,
        input.contact.experienceId,
        input.contact.verifiedAt,
        input.contact.id,
        input.contact.emailHash,
        encrypted.version,
        encrypted.keyVersion,
        encrypted.iv,
        encrypted.tag,
        encrypted.ciphertext,
      ],
    );
    return rows[0]?.ok === true;
  }

  async findVerifiedByExperienceId(experienceId: string) {
    const rows = await this.sql.query<ContactRow>(
      `SELECT id, experience_id, email_hash, payload_version, key_version, iv, auth_tag, ciphertext, verified_at
       FROM verified_contacts
       WHERE experience_id = $1
       LIMIT 1`,
      [experienceId],
    );
    return rows[0] ? contactFromRow(rows[0]) : null;
  }

  async copyVerifiedContact(input: {
    sourceContactId: string;
    targetExperienceId: string;
    expectedEmailHash: string;
    newContactId: string;
    now: Date;
  }): Promise<boolean> {
    const rows = await this.sql.query<BoolRow>(
      `WITH copied AS (
         INSERT INTO verified_contacts (
           id, experience_id, email_hash,
           payload_version, key_version, iv, auth_tag, ciphertext,
           verified_at, updated_at
         )
         SELECT
           $4, $2, source.email_hash,
           source.payload_version, source.key_version, source.iv, source.auth_tag, source.ciphertext,
           source.verified_at, $5
         FROM verified_contacts AS source
         WHERE source.id = $1
           AND source.email_hash = $3
         ON CONFLICT (experience_id) DO UPDATE
         SET email_hash = EXCLUDED.email_hash,
             payload_version = EXCLUDED.payload_version,
             key_version = EXCLUDED.key_version,
             iv = EXCLUDED.iv,
             auth_tag = EXCLUDED.auth_tag,
             ciphertext = EXCLUDED.ciphertext,
             verified_at = EXCLUDED.verified_at,
             updated_at = EXCLUDED.updated_at
         WHERE verified_contacts.email_hash = EXCLUDED.email_hash
         RETURNING id
       )
       SELECT EXISTS (SELECT 1 FROM copied) AS ok`,
      [
        input.sourceContactId,
        input.targetExperienceId,
        input.expectedEmailHash,
        input.newContactId,
        input.now,
      ],
    );
    return rows[0]?.ok === true;
  }
}
