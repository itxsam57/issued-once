import { describe, expect, test, vi } from 'vitest';
import { ISSUED_ONCE_BOOT_CATALOG_JSON } from '@/server/physical/bootCatalog';
import { PostgresIssuedOnceCatalogGateway } from '@/server/physical/PostgresIssuedOnceCatalogGateway';

describe('PostgresIssuedOnceCatalogGateway production authority', () => {
  test('refuses to sell boot variants when no owner-published ACTIVE catalog exists', async () => {
    const sql = {
      query: vi.fn().mockResolvedValue([]),
    };
    const catalog = new PostgresIssuedOnceCatalogGateway(
      ISSUED_ONCE_BOOT_CATALOG_JSON,
      sql,
    );

    await expect(catalog.listVariants('io-tee', 'USD')).rejects.toThrow(/owner-published|active catalog/i);
  });

  test('uses the owner-published ACTIVE catalog as commercial truth', async () => {
    const activeCatalog = JSON.parse(ISSUED_ONCE_BOOT_CATALOG_JSON);
    activeCatalog.products.tee.variants = [
      {
        id: 'owner-published-tee',
        size: 'M',
        colorName: 'Black',
        colorSwatch: '#171713',
        amountMinor: 9900,
        available: true,
      },
    ];
    const sql = {
      query: vi.fn().mockResolvedValue([{ payload: activeCatalog }]),
    };
    const catalog = new PostgresIssuedOnceCatalogGateway(
      ISSUED_ONCE_BOOT_CATALOG_JSON,
      sql,
    );

    await expect(catalog.listVariants('io-tee', 'USD')).resolves.toEqual([
      expect.objectContaining({ id: 'owner-published-tee', amountMinor: 9900 }),
    ]);
  });
});
