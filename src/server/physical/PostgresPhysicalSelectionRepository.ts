import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ObjectSelectionTransition,
  PhysicalSelectionRepository,
} from './PhysicalSelectionRepository';

type TransitionRow = {
  experience_id: string;
};

export class PostgresPhysicalSelectionRepository implements PhysicalSelectionRepository {
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
}
