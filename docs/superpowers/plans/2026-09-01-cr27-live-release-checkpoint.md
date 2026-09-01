# CR-27 Production Live Release Checkpoint

Date: 2026-09-01
Verified integration head: `6b64b3b000cff18db2ac27b8c5494b0c72670211`
Verified integration tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
Live release wrapper: `28ff7deb6b1fe7578c271131f1655fc46898cefd`
Live release tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
Actual Hostinger-linked branch: `release/hostinger-v2-candidate-20260824`

## Result

CR-27 has completed its owner-approved core migration, exact-release deployment, and strict security/cache proof. The deployed wrapper is a forward-only child of the previously live Hostinger head and points to the exact verified integration tree, so the production application bytes are identical to the verified `6b64b3b0...` runtime tree while preserving Hostinger's already-selected branch and environment.

CR-27 is not a claim that the store is fully consumer-ready. Fresh live tests exposed separate owner-controlled production-readiness gates: no ACTIVE production catalog, unavailable Safepay runtime, unavailable Printful webhook runtime, and an absent GitHub QA operations token for the full support persistence proof. Canonical-domain cutover is also still separately gated.

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

## Live findings and owner gates

| Surface | Fresh evidence | Root cause / gate |
|---|---|---|
| Physical selection | `/api/experience/object` returned HTTP 500 after seven successful answers | Schema is present and correct, but production has zero catalog rows and zero ACTIVE publications. Production catalog authority correctly refuses boot/default commercial truth. Owner must publish/activate a real production catalog before rerunning the physical smoke. |
| Safepay webhook + payment create | HTTP 503 | `DATABASE_URL` is healthy; payment runtime is unavailable before signature/state checks. Owner must inspect/configure the required Safepay runtime values in Hostinger. No real charge is authorized by this checkpoint. |
| Printful webhook | HTTP 503 | Manufacturing webhook runtime is unavailable before signature validation. Owner must inspect/configure Printful webhook runtime values in Hostinger. Production manufacturing confirmation remains disabled and separately gated. |
| Live support persistence proof | Exact release health PASS, then QA stopped with `INTERNAL_OPERATIONS_TOKEN is required` | GitHub Actions does not currently have the QA operations token. This is not evidence that the deployed support API failed. Owner may add the token as a GitHub Actions secret to automate the full persistence proof; never paste it into chat. |
| Canonical domain | Not cut over | Separate explicit owner gate; no DNS/domain mutation was performed. |

## What is proven versus still pending

Proven now:

- migration 0036 production schema gate;
- exact verified integration tree deployed through the actual existing Hostinger-linked branch;
- no force update and no Hostinger selected-branch/environment change;
- exact live release identity;
- strict security/cache boundary.

Still owner-gated:

- publish/activate the production catalog;
- inspect/configure Safepay runtime values;
- inspect/configure Printful webhook runtime values;
- optionally add `INTERNAL_OPERATIONS_TOKEN` to GitHub Actions for full support persistence QA;
- canonical-domain cutover;
- all previously separate real-charge/refund/Printful-confirmation/referral/merchant-identity gates.

No real Safepay charge/refund, Printful production confirmation, referral migration, creator outreach, secret rotation, or canonical-domain cutover was performed in this cycle.
