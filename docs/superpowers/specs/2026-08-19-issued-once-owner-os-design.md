# ISSUED ONCE — Owner OS Control Plane Design

Date: 2026-08-19
Status: approved design, written-spec review required before implementation planning
Branch: `feat/mystery-foundation`

## 1. Purpose

ISSUED ONCE needs one private owner control plane that sits above the entire commercial system without becoming a bypass around its safety rules.

The existing `/ops` room is the foundation. It already authenticates the owner and exposes bounded artwork review and Printful draft/confirmation operations. This design expands `/ops` into **ISSUED ONCE Owner OS** rather than creating a second admin application.

Owner OS must let the owner understand and manually assist every important part of the business:

- storefront and live commercial status
- sales and payment truth
- customer/Issue state
- Question Vault and sellable catalog controls
- designer queue, briefs, generations and approval
- Printful draft/manufacturing/shipment state
- support and notifications
- provider/readiness health
- failure recovery
- sensitive-data access when genuinely necessary
- immutable audit history of owner actions

The canonical identity remains the **Issue**, not email, name, provider order ID, or artwork filename.

## 2. Goals

1. Give the owner one place to see the operational truth of ISSUED ONCE.
2. Make every paid Issue traceable from payment through delivery.
3. Let the owner intervene manually when automation fails or produces poor output.
4. Keep raw private data hidden by default and reveal it only for a specific operational need.
5. Preserve every existing payment, design and manufacturing fail-closed gate.
6. Provide live commercial statistics without turning an analytics product into the source of financial truth.
7. Make failures recoverable with contextual actions rather than arbitrary database/status editing.
8. Keep the architecture viable at very large scale through cursor pagination, bounded queries, event-derived aggregates and replaceable read models.

## 3. Non-goals

Owner OS will not:

- let the browser connect directly to Neon or provider credentials
- provide a generic SQL/data editor
- provide a generic “change order status” control
- allow manual creation of paid truth
- bypass Safepay webhook authentication
- manufacture an unpaid/refunded/pre-production-exception Issue
- bypass artwork approval
- bypass `PRINTFUL_ALLOW_CONFIRM`
- remove the typed per-Issue production confirmation
- expose raw answers, email, phone or shipping address in list views
- make historical orders change when catalog/question configuration changes
- replace provider dashboards for provider-specific legal/account administration

## 4. Architectural choice

### Chosen approach: extend `/ops` into one first-party Owner OS

```text
OWNER BROWSER
     |
     v
/ops authenticated session
     |
     v
Owner OS server APIs
     |
     +--> read models / statistics
     +--> Issue service
     +--> payment service
     +--> design service
     +--> manufacturing service
     +--> notification/support services
     +--> catalog/question configuration services
     +--> provider readiness services
     |
     v
Neon + Safepay + OpenAI + Vercel Blob/Queue + Resend + Printful
```

The browser never receives server secrets and never writes provider/database state directly. Manual actions call the same domain services and state machines used by automation.

A separate admin app was rejected because it would duplicate authentication and control logic. A third-party analytics/admin product was rejected because it would be a weak fit for sensitive design/manufacturing recovery and would create another privileged data surface.

## 5. Owner authentication and session

The existing `/ops` session remains the entry point.

Initial production supports one OWNER identity. Multi-user staff roles are deliberately deferred until another human actually needs privileged access.

Requirements:

- high-entropy `INTERNAL_OPERATIONS_TOKEN`
- server-side verification
- HttpOnly, Secure, SameSite session cookie
- `/ops` and all `/ops/api/*` routes deny unauthenticated access
- `noindex, nofollow`
- no secret value returned to browser
- session logout/expiry supported
- every privileged write records an audit event

Future role expansion must build on explicit permissions; it must not weaken the OWNER model by sharing one permanent browser token among employees.

## 6. Owner OS information architecture

The Owner OS navigation has these domains:

1. **Home**
2. **Issues**
3. **Designer**
4. **Manufacturing**
5. **Sales**
6. **Customers**
7. **Support**
8. **Website**
9. **System**
10. **Audit**

The UI stays visually related to ISSUED ONCE — editorial, restrained, high-information — but the private control plane prioritizes operational clarity over mystery.

## 7. Home — live business pulse

Home answers “what requires attention now?” before showing vanity metrics.

### Primary attention counters

- payment exceptions
- design failures
- artwork awaiting owner review
- missing factory mappings
- Printful draft failures
- drafts awaiting deliberate confirmation
- fulfillment exceptions
- failed notifications
- open support requests

### Live commercial counters

- paid orders today / 7d / 30d / lifetime
- gross paid revenue
- refunded amount
- failed/exception payment count
- average order value
- paid Issues
- in design
- in production
- in transit
- delivered

### Activity stream

The stream is derived from canonical Issue/payment/design/manufacturing/notification/support events, for example:

- `IO-A7K2-4Q8P / PAYMENT RECEIVED`
- `IO-K2M8-P91R / ARTWORK READY`
- `IO-F8K2-NR31 / PRINTFUL DRAFT CREATED`
- `IO-9X2Q-MP77 / SHIPPED`

It must be cursor-paginated. The browser never downloads the complete event history.

## 8. Issues — canonical operational ledger

The Issue ledger is the central operating view.

### Search

Exact/prefix search may resolve:

- Issue Code
- Safepay provider reference
- Printful order ID
- tracking number
- verified contact lookup hash derived from an owner-entered email
- normalized phone lookup only if a privacy-preserving lookup representation is explicitly added

Raw email/phone are not indexed as plaintext.

### Filters

- payment state
- Issue state
- object type
- design state
- manufacturing state
- support-open flag
- payment-exception flag
- date range
- country

### Issue detail

One Issue detail page composes:

#### Identity
- Issue Code
- internal Issue ID (quiet/internal only)
- created/updated timestamps
- current lifecycle state
- payment-exception overlay

#### Physical truth
- Tee/Cap/Tote
- logical product SKU
- size
- color
- retail amount/currency

#### Payment
- provider
- frozen amount/currency
- provider reference
- paid/refunded/exception state
- relevant verified provider-event timestamps

#### Design
- assigned question identities/families
- design job state
- encrypted brief presence
- generated artwork via short-lived signed URL
- dimensions/model/provider
- QA checks
- approval history

#### Manufacturing
- mapped Printful variant
- mapped placement
- manufacturing job state
- provider order ID
- provider status
- tracking
- shipment/delivery timestamps

#### Support/notification
- notification delivery states
- support cases

#### Timeline
A chronological canonical event stream across all subsystems.

## 9. Sensitive-data reveal model

Private data is **masked by default**.

Potential reveals are scoped to one Issue and one category:

- verified email
- phone
- shipping address
- original seven answers
- structured private design brief
- support-message plaintext

A reveal requires:

1. valid owner session
2. explicit action on one Issue
3. a short human reason selected/entered
4. server-side decrypt at the narrow boundary
5. no caching
6. an `OPS_PRIVATE_REVEAL` audit event containing category, Issue ID, timestamp and reason — never the revealed plaintext

Bulk export of decrypted private customer data is not part of this design.

## 10. Designer Studio

Designer Studio gives the owner a manual override without breaking Issue identity.

### Queues

- WAITING
- INTERPRETING
- GENERATING
- REVIEW
- APPROVED
- FAILED
- EXCEPTION/BLOCKED

### Review view

For one Issue:

- artwork preview using short-lived signed Blob URL
- form/size/base color
- source dimensions
- model/provider
- structured design brief
- design rationale/signals
- deterministic QA results
- question families

Raw answers remain behind the explicit sensitive-data reveal gate.

### Actions

- approve artwork
- reject artwork with reason
- retry failed design
- re-interpret answers
- edit a copy of the structured brief
- generate a new candidate from an owner-edited brief
- compare candidate generations
- choose one candidate as the active production artwork

Every generation is versioned. Regeneration never overwrites the historical artifact record.

Approved artwork cannot be replaced silently after a Printful draft exists. Changing it after draft creation requires cancel/reconcile/recreate according to safe provider state.

## 11. Manufacturing Control

Manufacturing view shows:

- manufacturing eligibility
- exact logical form/size/color
- sampled Printful mapping
- placement dimensions/DPI
- artwork dimensions
- draft provider order
- current Printful status
- tracking
- verified fulfillment events
- exception reason

### Allowed contextual actions

- create Printful draft
- retry failed draft safely using Issue Code external-ID recovery
- inspect existing draft
- cancel/reconcile when provider state allows
- retry a recoverable provider operation
- quarantine for investigation
- open mapping details
- deliberate production confirmation

### Production confirmation remains unchanged

Owner OS cannot bypass:

1. authenticated owner session
2. Issue still in `MANUFACTURING_DRAFT`
3. design still approved/current
4. no blocking pre-production payment exception
5. `PRINTFUL_ALLOW_CONFIRM=true`
6. exact typed phrase `CONFIRM <Issue Code>`
7. last-moment server reload of current Issue state

No generic status editor is allowed.

## 12. Sales and analytics

Canonical sales statistics come from ISSUED ONCE payment/Issue records, not a third-party analytics tool.

### Metrics

- gross paid revenue
- refunds
- net-after-refund gross sales view (not accounting profit)
- paid order count
- average order value
- payment success/failure/exception rate
- Tee vs Cap vs Tote sales
- size/color distribution
- country distribution
- time-to-design
- design approval/rejection/regeneration rate
- time design-approved → factory draft
- production → shipped
- shipped → delivered
- support rate per order

### Funnel

Where evidence exists, the system reports:

`experience started → seven answers complete → form → size/color → email verified → shipping saved → checkout started → paid`

Funnel definitions are fixed/versioned so dashboard percentages do not silently change meaning.

### Scale model

Operational tables remain OLTP truth. Dashboard metrics use bounded aggregate queries initially and may move to event-derived daily/hourly rollup tables as volume grows.

At scale:

- no full-table browser loads
- cursor pagination, not deep OFFSET pagination
- aggregate read models by time bucket
- indexes aligned to operational filters
- heavy historical analytics can move to a separate warehouse without changing canonical Issue/payment truth

## 13. Customers

Customers remain a convenience grouping, not a replacement for Issue identity.

A customer view may group Issues by verified contact lookup hash and show:

- Issue count
- paid/refunded order history
- current deliveries
- support history
- lifetime paid amount

PII remains masked until explicitly revealed for one operational task.

No password/account system is introduced.

## 14. Support Desk

Support Desk provides:

- OPEN / CLOSED queues
- Issue Code
- support message
- current Issue/payment/design/manufacturing state
- verified reply address through reveal/delivery boundary
- internal owner notes
- timeline

Owner can:

- reply using the configured support mail path
- close/reopen case
- add an internal note
- navigate directly to Issue detail
- retry a failed support delivery when safe

Support never receives raw questionnaire answers automatically.

## 15. Website control

Owner OS also controls current sellable configuration without making historical Issues mutable.

### Retail catalog

Owner can manage future-sale configuration:

- sellable/paused product forms
- logical variants
- retail prices
- availability
- color labels/swatches
- size labels/measurements

Changes are versioned. Existing quotes/payment attempts/Issues preserve their frozen values.

A variant cannot be activated for real sale unless readiness confirms its required Printful mapping when manufacturing is enabled.

### Question Vault

Owner can manage future experience assignment:

- activate/retire a question
- adjust selection weight within safe bounds
- add a new version of a question
- inspect family coverage and usage
- see completion/skip/design-usefulness statistics when enough data exists

Past experiences retain their persisted prompt snapshots and question versions.

### Storefront operational controls

Owner OS may show:

- current public catalog version
- current Question Vault version/state
- checkout/payment environment
- storefront/deployment health

It will not initially become a free-form page builder. Public editorial copy remains code-reviewed until there is a demonstrated need for a CMS.

## 16. System and provider health

The existing readiness service expands into a System page.

### Neon
- connectivity
- expected migration head
- migration mismatch/block state

### Safepay
- sandbox/production mode
- configuration state
- most recent authenticated payment-event time
- recent failure/exception count

### OpenAI
- configured interpretation/image models
- account model-access checks
- recent design success/failure counts

### Blob
- private storage/signing readiness

### Vercel Queue
- expected design/notification consumer configuration
- recent queued/failed work where observable

### Resend
- configuration state
- recent delivery failures from ISSUED ONCE records

### Printful
- account/store access
- mapping coverage for sellable variants
- signed webhook configuration
- factory kill switch SAFE/ARMED state

Provider health is descriptive. It cannot silently switch production modes.

## 17. Attention Required / recovery system

Owner OS derives a prioritized attention queue from explicit conditions, for example:

- paid payment without canonical Issue
- payment exception/refund
- design FAILED
- design stuck beyond lease threshold
- artwork QA failure
- missing factory map
- manufacturing FAILED
- provider order mismatch
- shipment/order failure
- notification FAILED
- support OPEN beyond response threshold

Each problem exposes only contextual recovery actions.

Examples:

- `RESUME ISSUE CREATION`
- `REQUEUE DESIGN`
- `REGENERATE`
- `REQUEUE NOTIFICATION`
- `RETRY PRINTFUL DRAFT`
- `QUARANTINE`
- `OPEN SUPPORT CASE`

There is no generic “set state to X” control.

Recovery actions must be idempotent or explicitly reconciliation-only.

## 18. Audit log

Add a canonical owner audit stream.

Examples:

- login/logout/session events where practical
- private-data reveal
- catalog change
- question activation/version/weight change
- design retry/reinterpret/regeneration
- design approval/rejection
- Printful draft action
- production confirmation attempt/result
- support close/reopen/reply
- manual notification retry
- quarantine/recovery action

Audit records contain:

- audit ID
- owner actor type (`OWNER` initially)
- action type
- Issue ID when relevant
- target type/ID
- safe metadata
- reason when required
- timestamp

Audit metadata must never contain raw answers, full address, email plaintext, payment secrets, API keys or decrypted support text.

Audit events are append-only from application behavior.

## 19. Proposed data additions

Implementation planning may introduce forward migrations for:

- `ops_audit_events`
- `ops_internal_notes`
- versioned catalog configuration if moving retail config from environment JSON into Neon
- Question Vault operational statistics/read models
- dashboard aggregate buckets if required by volume
- design candidate/version history for regeneration/selection

Existing canonical tables remain the source of historical order truth.

Schema changes must be forward migrations; historical migration files are not rewritten.

## 20. API boundaries

Owner endpoints live only under `/ops/api/*`.

Suggested read domains:

- `/ops/api/dashboard`
- `/ops/api/issues`
- `/ops/api/issues/:id`
- `/ops/api/designer`
- `/ops/api/manufacturing`
- `/ops/api/sales`
- `/ops/api/customers`
- `/ops/api/support`
- `/ops/api/website/catalog`
- `/ops/api/website/questions`
- `/ops/api/system/readiness`
- `/ops/api/audit`

Suggested write domains are capability-specific, for example:

- design approve/reject/retry/reinterpret/regenerate/select
- manufacturing create-draft/retry/quarantine/confirm
- support note/close/reopen/reply
- notification retry
- catalog publish/version
- question activate/retire/version/weight
- private-data reveal

No generic CRUD endpoint exposes unrestricted tables.

## 21. Error handling

Read failures show a bounded unavailable state for that module rather than crashing the entire Owner OS.

Write failures:

- return a safe human-readable error
- preserve current domain state
- create audit/recovery evidence where appropriate
- never pretend success because a provider request was attempted

Provider ambiguity follows existing recovery rules:

- Safepay payment truth comes only from authenticated provider evidence
- Printful draft ambiguity resolves by public Issue Code/external ID before creating again
- irreversible confirmation remains owner-gated

## 22. Performance and scale

The Owner OS must be safe for very high cardinality even though launch volume is small.

Rules:

- every list is bounded and cursor-paginated
- search uses indexed exact/prefix identities
- no “load all Issues” endpoint
- no decryption in list queries
- sensitive decrypt occurs only after single-Issue authorization
- artwork URLs are signed only for records currently visible/reviewed
- expensive sales analytics use aggregate/read models
- provider calls are never made for every row in a list render
- background reconciliation can be queued rather than holding owner HTTP requests open

## 23. Testing strategy

Implementation is test-first.

### Unit/domain tests

- dashboard metric definitions
- privacy masking/reveal authorization
- audit append behavior
- catalog version freeze
- question version persistence
- design recovery/regeneration state rules
- manufacturing safety invariants
- notification retry idempotency
- contextual recovery eligibility

### Repository tests

- pagination
- search by canonical identifiers
- aggregate correctness
- no plaintext sensitive fields in read models
- append-only audit behavior

### Route/auth tests

- every `/ops/api/*` route denies missing/invalid session
- sensitive reveal requires reason
- writes cannot bypass domain service eligibility
- production confirmation still requires every existing lock

### Browser tests

- owner login
- dashboard navigation
- search/open Issue
- masked sensitive data
- reveal audit flow
- designer review/regeneration
- draft creation
- typed production confirmation disabled until all locks are met
- support workflow
- responsive desktop/tablet/mobile owner layouts

### Scale tests

Use generated datasets to prove bounded pagination/aggregate queries without requiring production customer data.

## 24. Rollout

Owner OS rolls out behind the existing private `/ops` authentication.

Recommended implementation sequence:

1. audit schema/service foundation
2. scalable dashboard/read models
3. Issue ledger/detail/timeline
4. privacy reveal gates
5. Designer Studio recovery/versioning
6. Manufacturing Control expansion
7. support/notifications
8. website catalog/question controls
9. sales/customer analytics
10. system/readiness expansion
11. browser/scale/security verification

Public commerce remains fail-closed while current production gates are unresolved.

## 25. Relationship to the final commercial architecture

Owner OS does not change the approved commercial spine:

```text
ISSUED ONCE storefront
  -> Safepay
  -> canonical Issue
  -> design worker
  -> owner design approval
  -> Printful draft
  -> owner production confirmation
  -> fulfillment/tracking
```

It becomes the controlled human layer above that spine.

Safepay may later be replaced by Stripe or another gateway. Printful may later be replaced or supplemented by another manufacturer. Owner OS must consume provider-independent payment/manufacturing interfaces wherever possible, so those migrations do not require rewriting the control plane.

## 26. Acceptance definition

Owner OS is accepted when the owner can, from one authenticated private interface:

1. see live commercial and operational health
2. find any Issue through safe indexed identities
3. understand its entire payment/design/manufacturing/support timeline
4. reveal private data only deliberately and with an audit record
5. manually recover failed design/notification/factory work through safe contextual actions
6. review/regenerate/select/approve artwork
7. create and inspect a Printful draft
8. confirm production only through all existing irreversible gates
9. see sales/customer/manufacturing/designer statistics
10. manage future-sale catalog and Question Vault configuration without mutating historical Issues
11. see provider/readiness problems before they affect a paid customer
12. audit every meaningful owner action

The Owner OS is not considered complete until executable unit, typecheck, production-build and browser verification run against the exact implementation head. Platform/account throttling is recorded as external evidence, never interpreted as a green build.