import Link from 'next/link';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';

export default function ShippingPage() {
  return (
    <MerchantPageShell
      kicker="DELIVERY / AFTER THE ISSUE"
      title="Delivery follows your Issue."
      intro="ISSUED ONCE is personalized and made to order. Manufacturing and shipping start after a verified purchase and the necessary design review."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>WHERE WE DELIVER</p>
        <h2>Destination comes before payment.</h2>
        <p>Enter a full delivery address during the order journey. Some destinations or product combinations may not be serviceable by the production and delivery network. We may contact you if the chosen destination cannot be fulfilled; where we cannot complete the order, we will arrange the appropriate cancellation or refund.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>PRODUCTION / TRANSIT</p>
        <h2>Made first. Shipped second.</h2>
        <p>Production, dispatch and transit are separate stages. Actual timing varies with product availability, destination, carrier and customs. We do not promise a fixed delivery date without a confirmed estimate for your order. Ask <Link className={styles.inlineLink} href="/contact">support</Link> for a destination-specific estimate before purchase if timing is important.</p>
        <p>After a verified order, use your Issue Code on Status to follow progress. Tracking appears when the shipment information becomes available.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>PRICE / CHARGES</p>
        <h2>Check the payable amount before confirming.</h2>
        <p>Your selected product and quoted order price appear before checkout. Review the amount on the hosted payment page before authorizing payment; contact support rather than paying if it differs unexpectedly. Any separately applicable delivery charges should be disclosed before you authorize payment.</p>
        <p>Import duties, local taxes or customs charges may be assessed by destination authorities and may not be included in our product quote. Such charges depend on local rules; contact support if you need clarification before ordering.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.sectionLabel}>DELIVERY PROBLEMS</p>
        <h2>Something wrong? Keep the Issue Code.</h2>
        <p>For a missing, damaged, delayed or incorrectly delivered piece, contact us with the Issue Code and relevant evidence. We will investigate and provide the remedy required by the circumstances and applicable consumer law.</p>
        <p>See <Link className={styles.inlineLink} href="/returns">cancellations and refunds</Link> for the personalized-goods policy.</p>
      </section>
    </MerchantPageShell>
  );
}