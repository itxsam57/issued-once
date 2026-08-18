import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ObjectSelectionTransition,
  PhysicalSelectionRecord,
  PhysicalSelectionRepository,
  SizeSelectionRepository,
  SizeSelectionTransition,
} from './PhysicalSelectionRepository';

type TransitionRow = {
  experience_id: string;
};

type PhysicalSelectionRow = {
  experience_id: string;
  object_type: string;
  product_slug: string;
  size_code: string | null;
  color_code: string | null;
  color_label: string | null;
  color_swatch: string | null;
  variant_id: string | null;
  updated_at: Date | string;
};

function isObjectType(value: string): value is PhysicalSelectionRecord['object'] {
  return value === 'tee' || value === 'hoodie' || value === 'hat';
}

export class PostgresPhysicalSelectionRepository
  implements PhysicalSelectionRepository, SizeSelectionRepository
{
  constructor(private readonly sql: SqlExecutor) {}

  async selectObjectAndAdvance(transition: ObjectSelectionTransition): Promise<void> {
    const rows = await this.sql.query<TransitionRow>(
      `WITH advanced AS (
         UPDATE experiences
         SET stage = $3,
             updated_at = $6
         WHERE id = $1
           AND stage = $2
           AND expires_at > $6
         RETURNING id
       ), persisted AS (
         INSERT INTO experience_physical_selection (
           experience_id,
           object_type,
           product_slug,
           updated_at
         )
         SELECT id, $4, $5, $6
         FROM advanced
         RETURNING experience_id
       )
       SELECT experience_id FROM persisted`,
      [
        transition.experienceId,
        transition.expectedStage,
        transition.nextStage,
        transition.object,
        transition.productSlug,
        transition.updatedAt,
      ],
    );

    if (rows.length !== 1) {
      throw new Error('Physical selection stage conflict');
    }
  }

  async findByExperienceId(experienceId: string): Promise<PhysicalSelectionRecord | null> {
    const rows = await this.sql.query<PhysicalSelectionRow>(
      `SELECT
         experience_id,
         object_type,
         product_slug,
         size_code,
         color_code,
         color_label,
         color_swatch,
         variant_id,
         updated_at
       FROM experience_physical_selection
       WHERE experience_id = $1
       LIMIT 1`,
      [experienceId],
    );
    const row = rows[0];
    if (!row) return null;
    if (!isObjectType(row.object_type)) {
      throw new Error('Stored physical object is invalid');
    }

    return {
      experienceId: row.experience_id,
      object: row.object_type,
      productSlug: row.product_slug,
      sizeCode: row.size_code,
      colorCode: row.color_code,
      colorLabel: row.color_label,
      colorSwatch: row.color_swatch,
      variantId: row.variant_id,
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }

  async confirmSizeAndAdvance(transition: SizeSelectionTransition): Promise<void> {
    const rows = await this.sql.query<TransitionRow>(
      `WITH advanced AS (
         UPDATE experiences
         SET stage = $3,
             updated_at = $5
         WHERE id = $1
           AND stage = $2
           AND expires_at > $5
         RETURNING id
       ), persisted AS (
         UPDATE experience_physical_selection AS selection
         SET size_code = $4,
             updated_at = $5
         FROM advanced
         WHERE selection.experience_id = advanced.id
           AND selection.size_code IS NULL
         RETURNING selection.experience_id
       )
       SELECT experience_id FROM persisted`,
      [
        transition.experienceId,
        transition.expectedStage,
        transition.nextStage,
        transition.sizeCode,
        transition.updatedAt,
      ],
    );

    if (rows.length !== 1) {
      throw new Error('Physical selection stage conflict');
    }
  }
}
