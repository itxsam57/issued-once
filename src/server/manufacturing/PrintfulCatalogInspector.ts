type Options = {
  token: string;
  storeId?: string;
  fetchImpl?: typeof fetch;
};

type CatalogProduct = {
  id: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  is_discontinued?: boolean;
};

type CatalogVariant = {
  id: number;
  catalog_product_id: number;
  name: string;
  size: string;
  color: string;
  color_code?: string | null;
  color_code2?: string | null;
};

type CatalogProductDetail = {
  techniques?: Array<{ key?: string }>;
  placements?: Array<{ placement?: string; technique?: string }>;
};

type PagedResponse<T> = {
  data?: T[];
  paging?: { total?: number; offset?: number; limit?: number };
};

type MockupArea = {
  placement: string;
  technique: string;
  print_area_width: number;
  print_area_height: number;
  dpi: number;
  restricted_to_variants?: number[] | null;
};

type Target = {
  key: 'tee' | 'hat' | 'tote';
  model: string;
  colors: readonly string[];
  sizes?: readonly string[];
  techniquePriority: readonly string[];
};

const TARGETS: readonly Target[] = [
  { key: 'tee', model: '3001', colors: ['Ash', 'Black', 'Athletic Heather', 'Navy', 'Forest'], sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'], techniquePriority: ['dtg', 'dtfilm'] },
  { key: 'hat', model: '6245CM', colors: ['Stone', 'Black'], techniquePriority: ['dtfilm', 'embroidery'] },
  { key: 'tote', model: 'EC8000', colors: ['Oyster', 'Black'], techniquePriority: ['dtg', 'dtfilm', 'embroidery'] },
];

function normalized(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class PrintfulCatalogInspector {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Options) {
    if (!options.token.trim()) throw new Error('Printful token is required');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.token}`,
      Accept: 'application/json',
    };
    if (this.options.storeId?.trim()) headers['X-PF-Store-Id'] = this.options.storeId.trim();
    return headers;
  }

  private async json<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, { method: 'GET', headers: this.headers(), cache: 'no-store' });
    if (!response.ok) throw new Error(`Printful catalog read failed (${response.status})`);
    return response.json() as Promise<T>;
  }

  private async paged<T>(baseUrl: string): Promise<T[]> {
    const values: T[] = [];
    let offset = 0;
    for (;;) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const payload = await this.json<PagedResponse<T>>(`${baseUrl}${separator}limit=100&offset=${offset}`);
      const page = Array.isArray(payload.data) ? payload.data : [];
      values.push(...page);
      const total = Number(payload?.paging?.total ?? values.length);
      const limit = Number(payload?.paging?.limit ?? 100);
      if (!page.length || values.length >= total) return values;
      offset += Math.max(limit, 1);
    }
  }

  async inspectIssuedOnce() {
    const products = await this.paged<CatalogProduct>('https://api.printful.com/v2/catalog-products');
    const output = [];

    for (const target of TARGETS) {
      const matches = products.filter((product) => !product.is_discontinued && normalized(product.model) === normalized(target.model));
      if (matches.length !== 1) throw new Error(`Expected one active Printful product for ${target.model}, found ${matches.length}`);
      const product = matches[0];
      const detailPayload = await this.json<{ data?: CatalogProductDetail }>(`https://api.printful.com/v2/catalog-products/${product.id}`);
      const detail = detailPayload.data ?? {};
      const variants = await this.paged<CatalogVariant>(`https://api.printful.com/v2/catalog-products/${product.id}/catalog-variants`);
      const areas = await this.paged<MockupArea>(`https://api.printful.com/v2/catalog-products/${product.id}/mockup-styles`);
      const techniqueKeys = (detail.techniques ?? []).map((entry) => String(entry.key ?? '').trim().toLowerCase());
      const chosenTechnique = target.techniquePriority.find((candidate) => techniqueKeys.includes(candidate));
      if (!chosenTechnique) throw new Error(`No approved print technique is available for ${target.model}`);
      const placementRows = (detail.placements ?? []).filter((entry) => String(entry.technique ?? '').toLowerCase() === chosenTechnique);
      const chosenPlacement = placementRows.find((entry) => String(entry.placement ?? '').toLowerCase() === 'front')?.placement ?? placementRows[0]?.placement;
      if (!chosenPlacement) throw new Error(`No ${chosenTechnique} placement is available for ${target.model}`);

      const selectedVariants = variants.filter((variant) =>
        target.colors.includes(variant.color) && (!target.sizes || target.sizes.includes(variant.size)),
      );
      const expectedVariantKeys = target.sizes
        ? target.sizes.flatMap((size) => target.colors.map((color) => `${size}::${color}`))
        : target.colors.map((color) => color);
      const actualVariantKeys = selectedVariants.map((variant) =>
        target.sizes ? `${variant.size}::${variant.color}` : variant.color,
      );
      for (const expectedKey of expectedVariantKeys) {
        const matchesForKey = actualVariantKeys.filter((key) => key === expectedKey).length;
        if (matchesForKey !== 1) {
          throw new Error(`Required Printful variant ${target.model} ${expectedKey} expected once, found ${matchesForKey}`);
        }
      }
      if (selectedVariants.length !== expectedVariantKeys.length) {
        throw new Error(`Required Printful variants for ${target.model} are not one-to-one`);
      }
      const printAreas = areas
        .filter((area) => area.technique === chosenTechnique && area.placement === chosenPlacement)
        .map((area) => ({
          placement: area.placement,
          technique: area.technique,
          widthPx: Math.round(area.print_area_width * area.dpi),
          heightPx: Math.round(area.print_area_height * area.dpi),
          dpi: area.dpi,
          restrictedToVariants: area.restricted_to_variants ?? null,
        }));

      output.push({
        key: target.key,
        product: { id: product.id, name: product.name, brand: product.brand ?? null, model: product.model ?? null },
        chosenTechnique,
        chosenPlacement,
        requiredColors: [...target.colors],
        requiredSizes: target.sizes ? [...target.sizes] : null,
        variants: selectedVariants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          size: variant.size,
          color: variant.color,
          colorCode: variant.color_code ?? null,
          colorCode2: variant.color_code2 ?? null,
        })),
        printAreas,
      });
    }

    return { products: output };
  }
}
