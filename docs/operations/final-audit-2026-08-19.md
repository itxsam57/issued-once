# ISSUED ONCE — Final Hardening Audit Checkpoint

Date: 2026-08-19
Branch: `feat/mystery-foundation`
Migration head: `0027_issue_prefix_search_indexes.sql`
Governor state: `WAIT_EXTERNAL`

This file is an execution checkpoint, not a production-ready claim. The canonical migration source is `db/migrations/README.md` plus `db/migrations/CURRENT`; the canonical launch decision is `docs/operations/production-launch-gate.md`.

## Code-side hardening present in the current source

- full interview → form → size → colour → OTP → encrypted shipping → commitment → Safepay journey
- persistent balanced seven-question assignment from the Question Vault
- one-hour commitment quote window
- exact minor-unit internal money with Safepay major-unit adapter conversion
- signed Safepay webhook authentication, merchant matching and monotonic PAID/REFUNDED state
- webhook replay recovery when provider-event persistence succeeds before money-state transition
- payment initialization and reused-checkout stage recovery before any checkout URL is shown to the customer
- canonical Issue identity and signed-refund quarantine to `EXCEPTION`
- private canonical artwork storage with bounded owner/factory reads
- source-pixel and sampled Printful placement gates
- Printful external-Issue-Code lookup before draft creation for retry recovery
- explicit owner-only draft confirmation with Issue-state recheck immediately before factory charge
- durable design and notification queue declarations
- shipment/delivery notification recovery on provider-event retries
- one active owner control plane (`/ops`); duplicate legacy internal commerce paths are decommissioned
- private `/ops` launch-readiness ledger
- Owner OS Home, Issues, Designer, Manufacturing, Sales, Customers, Support, Website, System and Audit modules
- currency-safe long-window commercial metric buckets and delivered projection
- bounded operational, Issue-ledger, country-filter and trigram prefix-search indexes
- append-only Owner OS audit/private notes and design-candidate history
- versioned Owner OS website/catalog configuration

## Database hardening chain

The required schema is the complete ordered chain through:

`db/migrations/CURRENT -> 0027_issue_prefix_search_indexes.sql`

The later migrations add:

- `0014`–`0019`: refund truth, frozen payment snapshots, Issue lifecycle enforcement, financial-exception overlay, contradictory provider-money quarantine and timeline projection
- `0020`–`0022`: Owner OS audit/private notes, design candidates/rework guard and versioned website configuration
- `0023`–`0025`: incremental commercial metrics, scale indexes and delivered projection
- `0026`–`0027`: Issue-ledger/country indexes plus `pg_trgm` prefix search for Issue/provider/tracking identifiers

Migrations `0020`–`0027` were exercised on isolated Neon proof branches recorded in the migration manifest and those temporary branches were deleted. The connected production/default Neon database remains **not migrated**.

## Verification evidence

Last fully executable CI baseline:

- commit `c0260b64f10dea9c2cb6c937a42c2d37cbc18c4f`
- 96/96 unit tests passed
- TypeScript check passed
- Next.js production build passed

That baseline predates substantial commercial and Owner OS work and therefore is **not** current-head verification.

Fresh current-head GitHub Actions attempts on 2026-08-19 again failed before workflow step 1 existed. The current CI and Browser QA jobs returned `steps: null`, so they provide runner/account infrastructure evidence only, not an application pass or failure.

Vercel's GitHub status continues to report a deployment/build rate limit, and the connected Vercel integration does not currently expose the historical `issued-once` project. No exact-head Vercel compiler/deployment result is claimed.

## External gates still requiring observed evidence

- executable current-head unit/typecheck/lint/build/browser verification
- Vercel project visibility, successful deployment and queue registration
- guarded production Neon migration approval/application after exact-head code verification
- Safepay sandbox signed payment/refund/exception proof
- Resend real OTP/milestone/support delivery proof
- OpenAI deployed model-access and design-generation proof
- private Blob signed-read proof in the deployed environment
- exact sampled Printful variant/placement mapping for every sellable variant
- one real Printful draft with `PRINTFUL_ALLOW_CONFIRM` disabled
- Printful signed fulfillment webhook proof

## Safety state

Do not enable `PRINTFUL_ALLOW_CONFIRM=true` merely because this audit checkpoint exists. Do not migrate the production database merely because isolated branches passed. Do not infer payment from a browser redirect. Do not mark the branch production-green until the exact release head has executable evidence for every launch gate.
