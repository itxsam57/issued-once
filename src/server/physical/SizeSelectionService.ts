import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { CatalogGateway } from './CatalogGateway';
import type { SizeSelectionRepository } from './PhysicalSelectionRepository';

type SizeSelectionServiceDependencies = {
  experienceRepository: Pick<ExperienceRepository, 'findBySessionHash'>;
  physicalRepository: SizeSelectionRepository;
  catalog: CatalogGateway;
  currency: string;
  now?: () => Date;
};

export type AvailableBaseColor = {
  code: string;
  label: string;
  swatch?: string;
};

export class SizeSelectionService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: SizeSelectionServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async confirm(input: { sessionToken: string; sizeCode: string }): Promise<{
    colors: AvailableBaseColor[];
  }> {
    const experience = await this.dependencies.experienceRepository.findBySessionHash(
      hashSessionToken(input.sessionToken),
    );
    if (!experience) throw new Error('Experience not found');
    if (experience.stage !== 'OBJECT_SELECTED') {
      throw new Error('Size selection is not unlocked');
    }

    const physical = await this.dependencies.physicalRepository.findByExperienceId(experience.id);
    if (!physical) throw new Error('Physical selection not found');

    const sizeCode = input.sizeCode.trim();
    if (!sizeCode) throw new Error('Selected size is unavailable');

    const variants = await this.dependencies.catalog.listVariants(
      physical.productSlug,
      this.dependencies.currency,
    );
    const matching = variants.filter(
      (variant) => variant.available && variant.size === sizeCode,
    );
    if (matching.length === 0) throw new Error('Selected size is unavailable');

    const seen = new Set<string>();
    const colors: AvailableBaseColor[] = [];
    for (const variant of matching) {
      const colorName = variant.colorName.trim();
      if (!colorName || seen.has(colorName)) continue;
      seen.add(colorName);
      colors.push({
        code: colorName,
        label: colorName,
        ...(variant.colorSwatch ? { swatch: variant.colorSwatch } : {}),
      });
    }

    if (colors.length === 0) throw new Error('No available base colors');

    await this.dependencies.physicalRepository.confirmSizeAndAdvance({
      experienceId: experience.id,
      expectedStage: 'OBJECT_SELECTED',
      nextStage: 'SIZE_CONFIRMED',
      sizeCode,
      updatedAt: this.now(),
    });

    return { colors };
  }
}
