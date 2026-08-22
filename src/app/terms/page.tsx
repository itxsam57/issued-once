import Link from 'next/link';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';

export default function TermsPage() {
  return (
    <MerchantPageShell
      kicker="TERMS / THE AGREEMENT"
      title="The physical facts are known. The interpretation is not."
      intro="These terms describe the purchase without pretending the mystery part is something else."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>WHAT YOU BUY</p>
        <h2>A selected form and a personalized creation process.</h2>
        <p>
          You select and confirm the physical form, available size where applicable, color, final payable amount, and shipping destination. The purchase includes the personalized creation process rather than previewing the final artwork before payment.
        </p>
        <p>A design may be produced through configured automated tools, manual work, or a combination of both under our production controls.</p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>YOUR DETAILS</p>
        <h2>Accurate contact and delivery information is required.</h2>
        <p>You are responsible for giving a reachable contact method and a complete delivery address, including required phone and province, state or region information where requested by the fulfillment flow.</p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>PAYMENT / FULFILLMENT</p>
        <h2>Payment truth comes from the configured payment provider.</h2>
        <p>Opening or returning from a checkout page does not by itself prove payment. An order advances only after authenticated payment-provider truth is recorded.</p>
        <p>Manufacturing and shipping estimates are estimates, not guarantees. Provider availability, destination, customs, carrier events, and production exceptions can affect delivery.</p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>LIMITS / RIGHTS</p>
        <h2>We can refuse material we cannot responsibly make.</h2>
        <p>Abusive, unlawful, prohibited, unsafe, or technically unfulfillable submissions may be refused, cancelled, or refunded as appropriate.</p>
        <p>Nothing in these terms removes mandatory consumer rights that apply to you under applicable law. Where those rights give you a stronger remedy, those rights control.</p>
        <p>For an order-specific question, use the Issue Code and the <Link className={styles.inlineLink} href="/contact">contact route</Link>.</p>
      </section>
    </MerchantPageShell>
  );
}
