import { randomUUID } from 'node:crypto';
import {
  normalizeShippingCountryCode,
  shippingAddressRequirements,
} from '@/domain/shipping/addressRequirements';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { ContactRepository } from '@/server/contact/ContactRepository';
import type {
  ShippingAddress,
  ShippingRepository,
} from './ShippingRepository';

function clean(value: string, max: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeAddress(input: ShippingAddress): ShippingAddress {
  const countryCode = normalizeShippingCountryCode(input.countryCode);
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Shipping country is invalid');

  const address: ShippingAddress = {
    recipientName: clean(input.recipientName, 120),
    line1: clean(input.line1, 180),
    line2: clean(input.line2, 180),
    city: clean(input.city, 120),
    region: clean(input.region, 120),
    postalCode: clean(input.postalCode, 40),
    countryCode,
    phone: clean(input.phone, 40),
  };
  const requirements = shippingAddressRequirements(countryCode);

  if (
    !address.recipientName ||
    !address.line1 ||
    !address.city ||
    !address.postalCode ||
    (requirements.regionRequired && !address.region)
  ) {
    throw new Error('Shipping address is incomplete');
  }
  return address;
}

export class ShippingService {
  constructor(
    private readonly experiences: ExperienceRepository,
    private readonly contacts: ContactRepository,
    private readonly shipping: ShippingRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save(input: {
    experienceToken: string;
    address: ShippingAddress;
  }): Promise<{ saved: true }> {
    const experience = await this.experiences.findBySessionHash(
      hashSessionToken(input.experienceToken),
    );
    if (!experience) throw new Error('Experience not found');
    if (experience.stage === 'CHECKOUT_STARTED') {
      throw new Error('Shipping is locked after checkout starts');
    }
    if (experience.stage !== 'COMMITMENT_READY') {
      throw new Error('Shipping is not available at this experience stage');
    }

    const contact = await this.contacts.findVerifiedByExperienceId(experience.id);
    if (!contact) throw new Error('Verified contact is required before shipping');

    const address = normalizeAddress(input.address);
    const existing = await this.shipping.findByExperienceId(experience.id);
    const now = this.now();
    await this.shipping.upsert({
      id: existing?.id ?? randomUUID(),
      experienceId: experience.id,
      contactId: contact.id,
      countryCode: address.countryCode,
      encryptedAddress: await encryptPrivatePayload(address),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    return { saved: true };
  }
}
