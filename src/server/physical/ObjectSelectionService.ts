import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { CatalogGateway } from './CatalogGateway';
import type { ObjectType, PhysicalSelectionRepository } from './PhysicalSelectionRepository';

type ProductSlugs = Partial<Record<ObjectType, string>>;

type ObjectSelectionServiceDependencies = {
  experienceRepository: Pick<ExperienceRepository, 'findBySessionHash'>;
  physicalRepository: PhysicalSelectionRepository;
  catalog: CatalogGateway;
  productSlugs: ProductSlugs;
  currency: string;
  now?: () => Date;
};

export class ObjectSelectionService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ObjectSelectionServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async select(input: { sessionToken: string; object: ObjectType }): Promise<{
    sizes: Array<{ code: string; label: string }>;
  }> {
    const experience = await this.dependencies.experienceRepository.findBySessionHash(
      hashSessionToken(input.sessionToken),
    );
    if (!experience) throw new Error('Experience not found');
    if (experience.stage !== 'PROFILE_COMPLETE') {
      throw new Error('Physical form is not unlocked');
    }

    const productSlug = this.dependencies.productSlugs[input.object]?.trim();
    if (!productSlug) throw new Error('Physical product is not configured');

    const variants = await this.dependencies.catalog.listVariants(
      productSlug,
      this.dependencies.currency,
    );

    const seen = new Set<string>();
    const sizes: Array<{ code: string; label: string }> = [];
    for (const variant of variants) {
      const size = variant.size.trim();
      if (!variant.available || !size || seen.has(size)) continue;
      seen.add(size);
      sizes.push({ code: size, label: size });
    }

    if (sizes.length === 0) throw new Error('No available sizes');

    await this.dependencies.physicalRepository.selectObjectAndAdvance({
      experienceId: experience.id,
      expectedStage: 'PROFILE_COMPLETE',
      nextStage: 'OBJECT_SELECTED',
      object: input.object,
      productSlug,
      updatedAt: this.now(),
    });

    return { sizes };
  }
}
