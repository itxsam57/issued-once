import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  CheckoutStateRepository,
  CheckoutStateTransition,
} from './CheckoutStartService';

type TransitionRow = {
  experience_id: string;
};

export class PostgresCheckoutStateRepository implements CheckoutStateRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async advance(transition: CheckoutStateTransition): Promise<void> {
    const rows = await this.sql.query<TransitionRow>(
      `UPDATE experiences
       SET stage = $3,
           updated_at = $4
       WHERE id = $1
         AND stage = $2
         AND expires_at > $4
       RETURNING id AS experience_id`,
      [
        transition.experienceId,
        transition.expectedStage,
        transition.nextStage,
        transition.updatedAt,
      ],
    );

    if (rows.length !== 1) {
      throw new Error('Checkout state conflict');
    }
  }
}
