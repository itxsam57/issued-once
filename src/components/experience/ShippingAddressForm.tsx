'use client';

import { FormEvent, useState } from 'react';
import type { ShippingAddress } from '@/server/shipping/ShippingRepository';
import styles from './shipping-address.module.css';

const COUNTRIES = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'],
  ['DE', 'Germany'], ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'], ['NL', 'Netherlands'],
  ['BE', 'Belgium'], ['IE', 'Ireland'], ['PT', 'Portugal'], ['AT', 'Austria'], ['SE', 'Sweden'],
  ['NO', 'Norway'], ['DK', 'Denmark'], ['FI', 'Finland'], ['CH', 'Switzerland'], ['PL', 'Poland'],
  ['CZ', 'Czechia'], ['GR', 'Greece'], ['RO', 'Romania'], ['HU', 'Hungary'], ['HR', 'Croatia'],
  ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['QA', 'Qatar'], ['KW', 'Kuwait'],
  ['PK', 'Pakistan'], ['IN', 'India'], ['SG', 'Singapore'], ['MY', 'Malaysia'], ['JP', 'Japan'],
  ['KR', 'South Korea'], ['NZ', 'New Zealand'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['ZA', 'South Africa'],
] as const;

type Props = { onSubmit: (address: ShippingAddress) => Promise<void> };

export function ShippingAddressForm({ onSubmit }: Props) {
  const [country, setCountry] = useState('');
  const [otherCountry, setOtherCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const countryCode = country === 'OTHER' ? otherCountry.trim().toUpperCase() : country;
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      setError('Use the two-letter country code for your destination.');
      return;
    }
    const address: ShippingAddress = {
      recipientName: String(form.get('recipientName') ?? ''),
      line1: String(form.get('line1') ?? ''),
      line2: String(form.get('line2') ?? ''),
      city: String(form.get('city') ?? ''),
      region: String(form.get('region') ?? ''),
      postalCode: String(form.get('postalCode') ?? ''),
      countryCode,
      phone: String(form.get('phone') ?? ''),
    };
    setBusy(true);
    setError(null);
    try {
      await onSubmit(address);
    } catch {
      setError('That address could not be saved yet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.stage} aria-labelledby="shipping-heading">
      <p className={styles.signal}>ISSUE / DESTINATION</p>
      <h1 id="shipping-heading">Where does it go?</h1>
      <form className={styles.form} onSubmit={submit}>
        <label className={`${styles.field} ${styles.wide}`}><span>Name</span><input name="recipientName" autoComplete="name" required /></label>
        <label className={`${styles.field} ${styles.wide}`}><span>Address</span><input name="line1" autoComplete="address-line1" required /></label>
        <label className={`${styles.field} ${styles.wide}`}><span>Address line 2 <em>optional</em></span><input name="line2" autoComplete="address-line2" /></label>
        <label className={styles.field}><span>City</span><input name="city" autoComplete="address-level2" required /></label>
        <label className={styles.field}><span>State / region <em>if needed</em></span><input name="region" autoComplete="address-level1" /></label>
        <label className={styles.field}><span>Postal code</span><input name="postalCode" autoComplete="postal-code" required /></label>
        <label className={styles.field}>
          <span>Country</span>
          <select aria-label="Country" value={country} onChange={(event) => setCountry(event.target.value)} required>
            <option value="" disabled>Select</option>
            {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            <option value="OTHER">Other</option>
          </select>
        </label>
        {country === 'OTHER' ? (
          <label className={styles.field}><span>Country code</span><input aria-label="Country code" value={otherCountry} onChange={(event) => setOtherCountry(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} placeholder="XX" required /></label>
        ) : null}
        <label className={`${styles.field} ${styles.wide}`}><span>Phone <em>only if the carrier needs it</em></span><input name="phone" autoComplete="tel" inputMode="tel" /></label>
        <p className={styles.note}>This is used to get your issue to you. It stays private.</p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" disabled={busy || !country}>{busy ? 'SAVING' : 'USE THIS ADDRESS'}</button>
      </form>
    </section>
  );
}
