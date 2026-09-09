import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';
import { readPublicMerchant } from '@/brand/publicMerchant';

export const dynamic = 'force-dynamic';

export default function StoreInfoPage() {
  const merchant = readPublicMerchant();

  return (
    <MerchantPageShell
      kicker="STORE INFO / THE DEAL"
      title="You choose the form. The interpretation stays hidden."
      intro="Seven answers become one piece made for you. You know the physical details and the total before you pay. The design stays unseen until it arrives."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>HOW IT WORKS</p>
        <h2>Seven answers. One issue.</h2>
        <p>
          Answer seven prompts, then choose the physical form: tee, cap, or tote. Pick a size where one applies, choose the color, add the delivery destination, and see the total before checkout.
        </p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>WHAT STAYS HIDDEN</p>
        <h2>The design is the reveal.</h2>
        <p>
          There is no design preview before purchase. Your answers shape the piece, but the final visual stays unseen until the item arrives. That is the point of ISSUED ONCE.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>BEFORE YOU PAY</p>
        <h2>You know the physical part.</h2>
        <div className={styles.identity} aria-label="What is known before payment">
          <div className={styles.identityRow}><span>FORM</span><strong>TEE / CAP / TOTE</strong></div>
          <div className={styles.identityRow}><span>SIZE</span><strong>SHOWN WHEN REQUIRED</strong></div>
          <div className={styles.identityRow}><span>COLOR</span><strong>CHOSEN BY YOU</strong></div>
          <div className={styles.identityRow}><span>PRICE</span><strong>SHOWN BEFORE CHECKOUT</strong></div>
          <div className={styles.identityRow}><span>DELIVERY</span><strong>ENTERED BEFORE PAYMENT</strong></div>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>AFTER YOU BUY</p>
        <h2>Your Issue Code follows it.</h2>
        <p>
          You get an Issue Code for the order. Use it on Status to check progress and tracking when available, and include it if you contact support.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>SELLER / SUPPORT</p>
        <h2>The essentials.</h2>
        {merchant.ready ? (
          <div className={styles.identity}>
            <div className={styles.identityRow}><span>NAME</span><strong>{merchant.name}</strong></div>
            <div className={styles.identityRow}><span>LOCATION</span><strong>{merchant.location}</strong></div>
            <div className={styles.identityRow}><span>SUPPORT</span><strong>{merchant.supportEmail}</strong></div>
            {merchant.supportPhone ? <div className={styles.identityRow}><span>PHONE</span><strong>{merchant.supportPhone}</strong></div> : null}
            {merchant.legalEntity ? <div className={styles.identityRow}><span>LEGAL NAME</span><strong>{merchant.legalEntity}</strong></div> : null}
          </div>
        ) : (
          <p className={styles.notice}>Seller details are temporarily unavailable here. Use the Contact page for support.</p>
        )}
      </section>
    </MerchantPageShell>
  );
}
