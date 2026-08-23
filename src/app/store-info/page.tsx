import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';
import {
  formatPublicMoney,
  getPublicCatalogSummary,
  readPublicMerchant,
} from '@/brand/publicMerchant';

export const dynamic = 'force-dynamic';

export default async function StoreInfoPage() {
  const merchant = readPublicMerchant();
  const catalog = await getPublicCatalogSummary().catch(() => null);

  return (
    <MerchantPageShell
      kicker="STORE INFO / WHAT IS KNOWN"
      title="What you are actually buying."
      intro="A physical piece with its form settled before payment, and its final artwork deliberately left for the interpretation that follows."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>THE PROCESS</p>
        <h2>Seven answers. One physical piece.</h2>
        <p>
          You answer seven prompts. Those answers become private creative material for one personalized piece. The available physical forms can include a tee, hat or cap, and tote, depending on the current catalog.
        </p>
        <p>
          Before payment, you confirm the physical form, the available size where one applies, the color, the final payable amount, and the shipping destination. The final artwork is not previewed before purchase by design.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>CURRENT FORMS / PRICE</p>
        <h2>The number comes from the live catalog.</h2>
        {catalog && catalog.products.length > 0 ? (
          <div className={styles.priceList} aria-label="Current starting prices">
            {catalog.products.map((product) => (
              <div className={styles.priceRow} key={product.objectType}>
                <span>{product.objectType.toUpperCase()} / {product.sellableVariants} SELLABLE VARIANT{product.sellableVariants === 1 ? '' : 'S'}</span>
                <strong>{formatPublicMoney(product.startingAmountMinor, catalog.currency)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.notice}>
            Current catalog pricing could not be read here. The payable amount is still shown and frozen before checkout; no fallback price is invented on this page.
          </p>
        )}
        <p>Prices can change for future sessions. A quote already created for a session keeps its frozen amount and does not change when the catalog changes later.</p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>MAKING / DELIVERY</p>
        <h2>Personalized, then manufactured.</h2>
        <p>
          A personalized design can be created through our configured automated or manual design process and reviewed under our production controls. Manufacturing and fulfillment are performed through the configured manufacturing partner after the paid order is accepted for production.
        </p>
        <p>
          Delivery estimates are estimates rather than guarantees. Tracking and status are tied to the Issue Code created for the order.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>MERCHANT RECORD</p>
        <h2>Who stands behind the store.</h2>
        {merchant.ready ? (
          <div className={styles.identity}>
            <div className={styles.identityRow}><span>TRADING NAME</span><strong>{merchant.name}</strong></div>
            <div className={styles.identityRow}><span>BUSINESS LOCATION</span><strong>{merchant.location}</strong></div>
            <div className={styles.identityRow}><span>SUPPORT</span><strong>{merchant.supportEmail}</strong></div>
            {merchant.supportPhone ? <div className={styles.identityRow}><span>PHONE</span><strong>{merchant.supportPhone}</strong></div> : null}
            {merchant.legalEntity ? <div className={styles.identityRow}><span>LEGAL / REGISTRATION</span><strong>{merchant.legalEntity}</strong></div> : null}
          </div>
        ) : (
          <p className={styles.notice}>
            Public merchant disclosure is not fully configured. No country, address, company registration or legal entity is substituted or guessed.
          </p>
        )}
      </section>
    </MerchantPageShell>
  );
}
