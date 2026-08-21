import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';
import { readPublicMerchant } from '@/brand/publicMerchant';

export const dynamic = 'force-dynamic';

export default function ContactPage() {
  const merchant = readPublicMerchant();

  return (
    <MerchantPageShell
      kicker="CONTACT / A HUMAN ROUTE"
      title="If something needs sorting, bring the Issue Code."
      intro="We keep support tied to the order rather than turning a private creative session into a public customer profile."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>SUPPORT</p>
        <h2>A direct way back in.</h2>
        {merchant.supportEmail ? (
          <div className={styles.identity}>
            <div className={styles.identityRow}>
              <span>EMAIL</span>
              <strong><a className={styles.inlineLink} href={`mailto:${merchant.supportEmail}`}>{merchant.supportEmail}</a></strong>
            </div>
            {merchant.supportPhone ? (
              <div className={styles.identityRow}>
                <span>PHONE</span>
                <strong>{merchant.supportPhone}</strong>
              </div>
            ) : null}
          </div>
        ) : (
          <p className={styles.notice}>The public support address is not configured yet. No placeholder address is being shown.</p>
        )}
        <p>Include the Issue Code when you have one. Do not send passwords, OTPs, payment secrets, or unnecessary private answers.</p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>BUSINESS LOCATION</p>
        <h2>Where the merchant is based.</h2>
        {merchant.location ? (
          <div className={styles.identity}>
            <div className={styles.identityRow}><span>TRADING NAME</span><strong>{merchant.name ?? 'NOT CONFIGURED'}</strong></div>
            <div className={styles.identityRow}><span>LOCATION</span><strong>{merchant.location}</strong></div>
            {merchant.legalEntity ? <div className={styles.identityRow}><span>LEGAL / REGISTRATION</span><strong>{merchant.legalEntity}</strong></div> : null}
          </div>
        ) : (
          <p className={styles.notice}>The public business location is not configured. No foreign office, domicile or registration is invented in its place.</p>
        )}
      </section>
    </MerchantPageShell>
  );
}
