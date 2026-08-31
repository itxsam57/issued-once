import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { CatalogGateway, CatalogVariant } from './CatalogGateway';
import { IssuedOnceCatalogGateway } from './IssuedOnceCatalogGateway';

type ActiveRow = { payload: unknown };

export class PostgresIssuedOnceCatalogGateway implements CatalogGateway {
  private readonly base: IssuedOnceCatalogGateway;

  constructor(serializedFallback: string, private readonly sql: SqlExecutor) {
    this.base = new IssuedOnceCatalogGateway(serializedFallback);
  }

  productSlug(objectType: string) { return this.base.productSlug(objectType); }
  currency() { return this.base.currency(); }

  async listVariants(productSlug: string, currency: string): Promise<readonly CatalogVariant[]> {
    const rows = await this.sql.query<ActiveRow>(
      `SELECT payload FROM ops_website_config_versions WHERE config_type='CATALOG' AND status='ACTIVE' ORDER BY version DESC LIMIT 1`,
    );
    if (!rows[0]) throw new Error('No owner-published ACTIVE catalog is available for commerce');
    const serialized = typeof rows[0].payload === 'string' ? rows[0].payload : JSON.stringify(rows[0].payload);
    const active = new IssuedOnceCatalogGateway(serialized);
    if (active.currency() !== this.base.currency()) throw new Error('Published catalog currency must match boot catalog currency');
    return active.listVariants(productSlug, currency);
  }
}
