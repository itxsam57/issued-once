# ISSUED ONCE — Final Hardening Audit Checkpoint

Date: 2026-08-19
Branch: `feat/mystery-foundation`

This file is an execution checkpoint, not a production-ready claim.

Code-side hardening completed in the current audit includes:

- full interview → form → size → colour → OTP → encrypted shipping → commitment → Safepay journey
- one-hour commitment quote window
- exact minor-unit internal money with Safepay major-unit adapter conversion
- signed Safepay webhook authentication, merchant matching and monotonic PAID/REFUNDED state
- webhook replay recovery when provider-event persistence succeeds before money-state transition
- payment initialization recovery before any checkout URL is shown to the customer
- canonical Issue identity and signed-refund quarantine to `EXCEPTION`
- private canonical artwork storage with bounded owner/factory reads
- source-pixel and sampled Printful placement gates
- Printful external-Issue-Code lookup before draft creation for retry recovery
- explicit owner-only draft confirmation with Issue-state recheck immediately before factory charge
- durable design and notification queue declarations
- shipment/delivery notification recovery on provider-event retries
- one active owner control plane (`/ops`); duplicate legacy internal routes are decommissioned
- private `/ops` launch-readiness ledger
- refund database state migration `0014_payment_refunds.sql`

External gates remain evidence gates until proven on the real accounts:

- executable GitHub CI/typecheck/build/browser runner
- Vercel project visibility/environment/queue registration
- production Neon migration approval/application
- Safepay sandbox signed payment proof
- Resend real OTP/milestone delivery proof
- OpenAI account model access and generation proof
- private Blob signed-read proof in deployed environment
- exact sampled Printful variant/placement mapping for every sellable variant
- Printful draft import and signed fulfillment webhook proof

Do not enable `PRINTFUL_ALLOW_CONFIRM=true` merely because this audit checkpoint exists.
