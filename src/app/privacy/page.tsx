import Link from 'next/link';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';
import { readPublicMerchant } from '@/brand/publicMerchant';

export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const merchant = readPublicMerchant();
  return (
    <MerchantPageShell
      kicker="PRIVACY / YOUR ISSUE"
      title="Privacy belongs to your Issue."
      intro="Effective 30 October 2026. We use the details needed to create, verify, deliver and support your personalized order, without publishing your answers."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>WHAT WE RECEIVE</p>
        <h2>The information you give us.</h2>
        <p>We process your seven questionnaire answers, selected product, size and color, verified email, delivery name and shipping address, and any support messages or images you send. We also hold an Issue Code, payment/order status, design and fulfillment records, and limited technical security and session information.</p>
        <p>Our hosted payment checkout handles payment-card entry. We keep the order amount and payment status or reference needed to reconcile an order, not the full card number.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>WHY WE USE IT</p>
        <h2>To make the piece, and keep your order safe.</h2>
        <p>We use answers to interpret and create your design; contact and delivery details to verify, fulfill and update your order; transaction records to resolve payments and refunds; and security information to prevent fraud, misuse and duplicate orders. We handle support requests and meet applicable record-keeping obligations.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>WHO SEES WHAT</p>
        <h2>Only what is needed for the job.</h2>
        <p>Information may be processed by our checkout, email, design-processing, hosting, and production/delivery services where needed to carry out the order. A delivery partner needs the recipient and address, not your seven private answers. Payment and fulfillment providers operate under their own applicable privacy terms.</p>
        <p>Authorized store operators may access order, design and support details when needed to fulfill or resolve an Issue. We do not publish customers’ answers or sell them as a product.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>SECURITY / RETENTION</p>
        <h2>Access is limited; records are not kept without purpose.</h2>
        <p>Private answers and customer contact or delivery information are protected in storage, with access limited to the order workflow. No internet service can guarantee absolute security.</p>
        <p>Short-lived verification and security records expire or are cleaned up according to their operational purpose. Order, payment, fulfillment and support records may need to be kept longer for delivery, disputes, legal obligations and fraud prevention. We do not publish a made-up universal deletion deadline: contact us for the retention applicable to your specific data.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>YOUR CHOICES</p>
        <h2>Ask about, correct or remove your information.</h2>
        <p>You can request access, correction or deletion of personal information, or raise a privacy concern, subject to identity verification and any legal or order-record retention requirements. Include your Issue Code when available, but never send an OTP or payment secret.</p>
        <p>Use our <Link className={styles.inlineLink} href="/contact">contact page</Link>{merchant.supportEmail ? <> or email {merchant.supportEmail}</> : null}. See our <Link className={styles.inlineLink} href="/cookies">cookies notice</Link> for essential session cookies.</p>
      </section>
    </MerchantPageShell>
  );
}