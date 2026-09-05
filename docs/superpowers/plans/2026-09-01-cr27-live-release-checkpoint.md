# CR-27 Production Live Release Checkpoint

Date: 2026-09-01
Verified integration head: `6b64b3b000cff18db2ac27b8c5494b0c72670211`
Verified integration tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
Live release wrapper: `28ff7deb6b1fe7578c271131f1655fc46898cefd`
Live release tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
Actual Hostinger-linked branch: `release/hostinger-v2-candidate-20260824`

## Result

CR-27 has completed its owner-approved core migration, exact-release deployment, strict security/cache proof, and corrected non-OTP live boundary proof. The deployed wrapper is a forward-only child of the previously live Hostinger head and points to the exact verified integration tree, so the production application bytes are identical to the verified `6b64b3b0...` runtime tree while preserving Hostinger's already-selected branch and environment.

CR-27 is not a claim that the store is fully consumer-ready. Fresh live tests exposed separate owner-controlled production-readiness gates: no ACTIVE production catalog, fail-closed unavailable Safepay runtime, fail-closed unavailable Printful webhook runtime, and an absent GitHub QA operations token for the full support persistence proof. Canonical-domain cutover is also still separately gated.

## Migration 0036

- Approved scope: only `db/migrations/0036_durable_artwork_objects.sql`.
- Runner: `ops/cr-27-0036-runner-v2-20260901` at `2c7da6528dfde7f5c87e6585fbe578bfc7c83bf8`.
- Workflow run: `33508570582`.
- Successful migration rerun job: `99911484696`.
- Preflight: `issues=present artwork_objects=present-compatible`.
- Postflight: `artwork_objects=already-compatible index=present`.
- The runner executed only the two validated idempotent statements from migration 0036. It did not newly create the table because the schema was already compatible.
- Referral migrations `0029`, `0034`, and `0035` remain untouched.

## Hostinger branch lineage correction

The prior continuation record incorrectly treated `release/hostinger-v10-candidate-20260825` as Hostinger-linked. Fresh live health returned `da03726503e1308a8703db0ced94941ae2be9582`; repository history and branch inspection proved that SHA belonged to `release/hostinger-v2-candidate-20260824`, which earlier governance had explicitly named as the Hostinger-linked branch. The v10 branch was a combined release candidate, not the selected deployment source.

The previously live v2 head `da037265...` was three commits ahead of verified runtime `6b64b3b0...`, with only Hostinger 0036 helper/workflow/build-hook changes. A forward-only wrapper commit was therefore created:

- wrapper: `28ff7deb6b1fe7578c271131f1655fc46898cefd`
- parent: `da03726503e1308a8703db0ced94941ae2be9582`
- wrapper tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
- verified runtime tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
- tree identity: PASS
- ref update: non-force fast-forward of the already-selected v2 branch
- Hostinger selected branch changed: no
- Hostinger environment changed: no

## Exact live identity

Multiple independent jobs observed the same live release identity:

- Hostinger Live Boundary Audit run `33525915578` reached `LIVE_RELEASE_HEALTH_PASS provider=hostinger release=28ff7deb6b1fe7578c271131f1655fc46898cefd version=0.1.0`.
- Hostinger Temporary Release Proof run `33525915658` reached the same exact release before its physical-form finding.
- Live support rerun job `99919493724` reached the same exact release before its GitHub QA token gate.
- Strict header rerun job `99920257942` reached the same exact release.
- Isolated corrected-boundary proof run `33527773379`, job `99922906669`, reached the same exact release and completed the full non-OTP boundary audit.

## Security and cache proof

Strict header run `33526755370`, successful rerun job `99920257942`:

`LIVE_SECURITY_HEADER_PASS bare-home exact-baseline no-powered-by no-store no-s-maxage`

This proves the required bare-home security header baseline, no `x-powered-by`, `no-store`, and absence of `s-maxage` on the exact live release.

## Read-only production diagnostics

Because the connected Neon project-scoped adapter still rejects its declared camelCase arguments before SQL reaches Neon, an isolated GitHub Actions diagnostic used the already-authorized `DATABASE_URL` secret and SELECT-only SQL.

- branch: `ops/cr27-live-readonly-diagnostics-20260901`
- head: `ef6a9bb86b65333b85508ac4682ed96f96352479`
- run: `33526598947`
- job: `99918918445`
- writes: none
- `experiences`: present
- `experience_physical_selection`: present
- `ops_website_config_versions`: present
- `payment_attempts`: present
- production catalog rows: `0`
- ACTIVE production catalog rows: `0`
- physical-selection constraint includes TOTE: yes

## Corrected fail-closed live boundary proof

The first exact-live boundary run `33525915578` was useful RED evidence: it reached the correct Hostinger release but the harness still assumed Safepay and Printful were configured. It therefore expected `401`, `401`, and `409` from Safepay webhook, Printful webhook, and payment-create respectively, while the deployed routes correctly returned provider-unavailable `503` responses before request-specific authentication/state checks.

The correction was proven without changing production:

- isolated proof PR `#78`, head `3eb74d7223c7acf6d61d59dbc513fd51b52b69d7`, targeted the already-deployed Hostinger branch and was intentionally closed unmerged;
- isolated GREEN run `33527773379`, job `99922906669`, verified exact release `28ff7deb6b1fe7578c271131f1655fc46898cefd`;
- Safepay webhook was accepted as unavailable only for HTTP `503` with exact JSON error `Payment webhook is unavailable`;
- Printful webhook was accepted as unavailable only for HTTP `503` with exact JSON error `Manufacturing webhook is unavailable`;
- payment creation was accepted as unavailable only for HTTP `503` with exact JSON error `Payment is unavailable`;
- arbitrary `500`/`503` responses remain failures;
- `/api/shipping` returned the expected `409` in the same customer session, proving the database-backed runtime path reached Postgres rather than failing from a global `DATABASE_URL` outage;
- the corrected harness finished with `LIVE_NON_OTP_BOUNDARY_AUDIT_PASS`.

Only the proven harness correction was then integrated through PR `#79`, head `cab9dc6ab8557fc57186c1c18687cec4de61c4fb`, merge `3398a55399b747553bbce9d0bf9bdf820e5d4e14`. Exact-head CI run `33528245008` and Browser QA run `33528245001` passed. Post-merge CI run `33528600109` / job `99925681096` passed unit tests, typecheck, lint and production build; post-merge Browser QA run `33528600181` / job `99925681708` passed.

This proof does not configure either provider and does not authorize a real Safepay charge/refund or Printful production confirmation. It proves only that the current unconfigured-provider state fails closed with the intended privacy-safe response contracts.

## Live findings and owner gates

| Surface | Fresh evidence | Root cause / gate |
|---|---|---|
| Physical selection | `/api/experience/object` returned HTTP 500 after seven successful answers | Schema is present and correct, but production has zero catalog rows and zero ACTIVE publications. Production catalog authority correctly refuses boot/default commercial truth. Owner must publish/activate a real production catalog before rerunning the physical smoke. |
| Safepay webhook + payment create | Exact fail-closed HTTP 503 contracts proven in run `33527773379` | Database-backed shipping reaches Postgres, while payment runtime remains intentionally unavailable until owner-configured Safepay runtime values exist. No real charge is authorized by this checkpoint. |
| Printful webhook | Exact fail-closed HTTP 503 contract proven in run `33527773379` | Manufacturing webhook runtime remains intentionally unavailable until owner-configured Printful webhook runtime values exist. Production manufacturing confirmation remains disabled and separately gated. |
| Live support persistence proof | Exact release health PASS, then QA stopped with `INTERNAL_OPERATIONS_TOKEN is required` | GitHub Actions does not currently have the QA operations token. This is not evidence that the deployed support API failed. Owner may add the token as a GitHub Actions secret to automate the full persistence proof; never paste it into chat. |
| Canonical domain | Not cut over | Separate explicit owner gate; no DNS/domain mutation was performed. |

## What is proven versus still pending

Proven now:

- migration 0036 production schema gate;
- exact verified integration tree deployed through the actual existing Hostinger-linked branch;
- no force update and no Hostinger selected-branch/environment change;
- exact live release identity;
- strict security/cache boundary;
- corrected non-OTP live boundary audit, including strict exact-body fail-closed provider-unavailable contracts;
- corrected live-boundary harness integrated with exact-head and post-merge CI/Browser QA green.

Still owner-gated:

- publish/activate the production catalog;
- inspect/configure Safepay runtime values;
- inspect/configure Printful webhook runtime values;
- optionally add `INTERNAL_OPERATIONS_TOKEN` to GitHub Actions for full support persistence QA;
- canonical-domain cutover;
- all previously separate real-charge/refund/Printful-confirmation/referral/merchant-identity gates.

No real Safepay charge/refund, Printful production confirmation, referral migration, creator outreach, secret rotation, or canonical-domain cutover was performed in this cycle.

## 2026-09-05 descendant reconciliation — consumer-readiness finish v4

This section supersedes only the stale current-state claims above; the 2026-09-01 evidence remains historical proof of that deployment cycle.

### Reconciled repository and deployment identity

- Engineering integration after PR #88: `4ea10081cb0de2f5de49eb46f973649a5fba3a51`, tree `409710dac112739ca8dc787c1e2b7db552b86188`.
- Hostinger-linked release after the Owner catalog-publication fix: `909d84832b345ecd05b03ec30ad06e5c32000908`, tree `409710dac112739ca8dc787c1e2b7db552b86188`.
- Those two refs were byte-identical when the fresh live proofs below ran.
- Finish-v4 PR #89 subsequently merged warning-free verification hygiene as `845f9740573d50ba33e5359e73166245c26add18`, tree `76feab88d9dad9c4d5fbe9800630243f14210145`.
- Therefore the newest engineering integration is no longer byte-identical to the currently deployed Hostinger release. No Hostinger branch/environment mutation was performed in finish-v4. Deployment of the newest verified integration remains a production/owner gate.

### Fresh live evidence on release `909d8483...`

- Hostinger Live Boundary Audit run `33918092912`, job `101169838141`: PASS on exact release `909d84832b345ecd05b03ec30ad06e5c32000908`.
- Live support proof run `33918093008`, job `101169838613`: exact-release health PASS, pre-paid support fail-closed PASS, and authenticated Resend delivery canary accepted. The earlier `INTERNAL_OPERATIONS_TOKEN` GitHub Actions blocker is therefore resolved. This canary does not replace CR-11's paid customer request -> Owner desk -> Owner reply proof.
- Temporary production smoke run `33918092923`, job `101169837569`: all seven real customer answer POSTs returned HTTP 200 and form unlock was reached. Physical form locking then failed closed because there was no ACTIVE production catalog. This is fresh production evidence for CR-01 and not a physical-selection implementation regression.
- Owner-approved catalog activation run `33918244323`, job `101170313072`: Owner authentication and website read succeeded; the audited boot catalog exposed 34 logical sellable variants. Publication was rejected with HTTP 409 because `PRINTFUL_VARIANT_MAP_JSON` is absent. No catalog publication occurred.
- That same activation run reported database ready, merchant disclosure ready, audited catalog ready, durable storage ready and Resend configured, while production privacy keys, ACTIVE catalog authority, Safepay runtime, and Printful API/mapping/signed-webhook configuration remained missing.
- A separate read-only Playwright audit on the exact live release verified `/store-info`, `/contact`, `/terms`, and `/returns` returned HTTP 200, rendered expected headings without mobile horizontal overflow, and displayed configured merchant/contact disclosure instead of fallback placeholders. Engineering cannot independently attest the factual truth of merchant/legal values; that owner-attestation gate remains.

### Updated owner/provider gates

The stale `INTERNAL_OPERATIONS_TOKEN` gate above is resolved. Current gates are:

- deploy the newest verified engineering integration after owner approval for the production mutation;
- configure production privacy V1/V2 encryption keys plus the identity-HMAC key without exposing them in chat;
- configure Safepay production runtime values and obtain the row-specific signed/real provider proofs; no real charge/refund is authorized by this checkpoint;
- configure Printful API, exact variant mapping, and signed-webhook runtime values before publishing a sellable catalog; no manufacturing confirmation is authorized by this checkpoint;
- publish/activate an owner-authorized catalog only after exact factory mapping validation succeeds;
- owner attestation that configured public merchant/legal disclosure is factually truthful;
- canonical-domain cutover remains separately unapproved;
- real payment/refund/factory/tracking/support/recovery proofs remain row-specific owner/provider evidence, including CR-28's complete two-customer commercial cycle.

No real Safepay charge/refund, Printful production confirmation, production catalog publication, secret rotation, referral activation, canonical-domain cutover, or other irreversible provider action occurred in finish-v4.

### CR-23 finish-v4 read audit and provider-independent Owner reads

- Isolated read-only proof branch `test/cr23-live-owner-read-20260905` was never deployed and is not production authority; its workflow pinned `EXPECTED_RELEASE_ID=909d84832b345ecd05b03ec30ad06e5c32000908` so the proof could not mistake the audit branch for the live release.
- Final audit run `33941209257`, job `101238878633`, passed exact-release health, authenticated Owner session creation, required read APIs, Issue pagination (`limit=2` with non-repeating adjacent cursors), and browser navigation across all 11 rooms with `overflow=0`.
- The deployed Manufacturing GET returned exact safe `503 Manufacturing queue unavailable`. Root cause was code-side eager construction of `createManufacturingService()`, which required absent Printful mutation configuration before `listQueue()` could query Postgres. Referrals also returned exact launch-disabled 503 because referral migrations remain intentionally deferred; this is governed by CR-30 and is not a CR-23 consumer launch blocker.
- TDD RED reproduced the Manufacturing coupling. A sibling static audit then reproduced Support construction requiring absent Resend reply configuration even for a read-only list; production currently has Resend, but the architecture was regression-prone.
- Clean fix PR #90 head `078013785e40beb47f6305131061cff6c5ae3b5a` defers Printful construction until draft/confirm and Resend gateway construction until reply send. Local full gate: 234 test files / 692 tests, typecheck, lint with zero warnings, production build, and 44/44 Browser QA passed. Exact-head CI `33941405484` / `101239440795` passed. Merge: `18c5dd08464352f1b75588473868b0f8a79dfcb6`, tree `e2c3cacc9e6546a7af806ffea75a778e6c9c21d1`. Post-merge CI `33941570876` / `101239909593` and Browser QA `33941570872` / `101239909604` both passed on the exact merge.
- No Hostinger/provider/environment mutation occurred. The live release remains `909d84832b345ecd05b03ec30ad06e5c32000908`, so exact-current-head live reproof after deployment remains an owner gate.
