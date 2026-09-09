import { MerchantPageShell } from '@/app/MerchantPageShell';
import styles from '@/app/merchant.module.css';

export default function CookiesPage() {
  return (
    <MerchantPageShell
      kicker="COOKIES / BROWSER CONTINUITY"
      title="Only what the Issue needs to keep its place."
      intro="ISSUED ONCE currently uses strictly necessary first-party cookies for the order journey and its security."
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>WHY THEY EXIST</p>
        <h2>Your unfinished Issue can survive a return visit.</h2>
        <p>
          A secure session cookie connects this browser to the Issue progress you already saved. It lets us offer to continue an unfinished Issue instead of silently losing your place.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>VERIFICATION</p>
        <h2>Short-lived continuity can reduce unnecessary repeat verification.</h2>
        <p>
          A separate secure cookie may briefly remember that this browser already completed contact verification in the same order chain. It does not contain the verification code itself.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>CONSENT</p>
        <h2>No optional tracking means no fake consent banner.</h2>
        <p>
          We do not currently set advertising or analytics cookies on the ISSUED ONCE site. The cookies described here are strictly necessary for requested order and security functions, so the site does not show an accept-all prompt for them.
        </p>
        <p>
          If optional analytics, advertising, or similar non-essential cookies are introduced later, they must stay off until the required choice is collected.
        </p>
      </section>
    </MerchantPageShell>
  );
}
