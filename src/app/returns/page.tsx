import Link from 'next/link';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';

export default function ReturnsPage() {
  return (
    <MerchantPageShell
      kicker="RETURNS / WHEN SOMETHING IS WRONG"
      title="Personalized does not mean remedy-free."
      intro="The work is made for one Issue, so change-of-mind rules can differ. Damage, defects, wrong goods, duplicates, and failed fulfillment are different."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>PERSONALIZED / MADE-TO-ORDER</p>
        <h2>Change of mind can be restricted where the law allows it.</h2>
        <p>
          Because each Issue is personalized or made-to-order, ordinary change-of-mind cancellation or return rights may be limited once personalized production has started, where applicable law permits that limitation.
        </p>
        <p>This does not remove mandatory consumer rights or remedies that cannot legally be excluded.</p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>REMEDIES</p>
        <h2>Damaged, defective, materially wrong, duplicate, or unfulfillable orders need a real resolution.</h2>
        <p>
          If the item arrives damaged or defective, is materially different from the confirmed physical form, is duplicated, or cannot be fulfilled, contact support with the Issue Code and enough evidence to understand the problem.
        </p>
        <p>Depending on the verified circumstances and applicable rights, the remedy may be replacement, correction, cancellation, refund, or another appropriate resolution.</p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>REFUND TRUTH</p>
        <h2>A refund is not declared from a browser screen.</h2>
        <p>
          Refund status is reconciled from the configured payment provider. We do not promise an automated refund path that has not been proven with the live provider.
        </p>
        <p>Start with the <Link className={styles.inlineLink} href="/contact">contact route</Link> and include the Issue Code.</p>
      </section>
    </MerchantPageShell>
  );
}
