# ISSUED ONCE — Issuance Ritual Full Demo Design

Status: OWNER-APPROVED CONCEPT, implementation pending written-spec review
Branch: `ui/issuance-ritual-full-demo-v1`
Base: production release `674ca48769619bc4664653caddd5f5b9545d1576`
Date: 2026-09-07

## 1. Purpose

Build a complete, isolated, end-to-end customer demo of ISSUED ONCE at the level of detail expected from a senior product/design engineering team after roughly 100+ hours of focused work.

This is not a homepage mockup and not a visual skin. It is a full product experience prototype covering discovery, curiosity formation, interview, physical selection, contact, verification, shipping, commitment, simulated checkout, issue creation, issue tracking, recovery, support, repeat purchase, legal/store pages, error states, mobile behavior, keyboard behavior, reduced motion, and reset/replay tooling.

The demo exists for one reason: let the owner physically experience the entire proposed customer journey before any production UI is merged or finalized.

## 2. Core Product Psychology

### 2.1 Primary rule

**Mystery of the design. Certainty of the rules.**

The design is the only meaningful unknown. Everything else must be concrete:

- what the buyer is purchasing;
- what choices they control;
- what choices they surrender;
- what the seven answers do;
- what is physically produced;
- whether a design repeats;
- what size/color/object will be made;
- price and discount state;
- shipping destination;
- return/store/contact information;
- order/issue status after purchase.

The experience must create an information gap, not general confusion.

### 2.2 Desired emotional sequence

The journey should deliberately move through these states:

1. **Interruption** — the first screen is visually unusual enough to stop scanning.
2. **Comprehension** — within seconds, the buyer understands that the design is hidden before purchase.
3. **Curiosity** — the buyer understands exactly what remains unknown.
4. **Control** — object, size, base color, price, policy and shipping are explicit.
5. **Investment** — seven personal answers make the future issue feel increasingly specific to the buyer.
6. **Commitment** — the issue ledger makes the transaction feel like issuing a one-time artifact, not adding a generic item to cart.
7. **Ownership** — immediately after simulated purchase, the issue number becomes the customer’s persistent object of attention.
8. **Anticipation** — tracking keeps the design hidden while making production progress concrete.

### 2.3 What the experience must never do

- No fake countdowns.
- No fake “X people viewing” indicators.
- No fake low-stock warnings.
- No roulette/casino mechanics.
- No manipulative near-miss animations.
- No arbitrary “mystery box” visual language.
- No vague filler copy written only to sound premium.
- No product artwork preview.
- No disguised product silhouette that accidentally reveals artwork.
- No AI blob/particle cliché.
- No generic glassmorphism dashboard language.
- No card-grid SaaS feel.
- No provider/payment actions in the demo.

## 3. Brand Interaction Language

### 3.1 Product metaphor

The site behaves like an **issuance terminal crossed with an editorial fashion publication**.

Every meaningful customer action updates an issuance record. The buyer should feel that something is being locked into a permanent, one-time physical object.

### 3.2 Persistent issue ledger

Once the customer starts, a subtle ledger becomes a persistent structural element.

Example:

```text
ISSUE     #482731
ANSWERS   3 / 7
OBJECT    —
SIZE      —
BASE      —
DESIGN    LOCKED
RUN       1 / 1
```

The ledger is not a game score. It is a transaction record.

On desktop it may sit as a narrow fixed rail or edge register. On mobile it becomes a compact top/bottom status strip that expands on tap.

### 3.3 Locking grammar

When a step completes, the interface should communicate permanence through motion and typography:

- answer text does not remain theatrically exposed;
- the current answer contracts/fades from the interaction surface;
- the ledger increments;
- the completed step changes to `LOCKED`;
- next step enters with a short mechanical transition;
- no celebratory confetti or game reward animation.

Suggested timing:

- button press response: 70–100 ms;
- data-lock visual response: 220–320 ms;
- outgoing panel transition: 300–420 ms;
- incoming panel transition: 420–560 ms;
- ledger increment: 180–260 ms;
- no single standard transition longer than ~700 ms during forms.

### 3.4 Motion easing

Use restrained custom curves rather than default browser ease everywhere.

Primary entrance:
`cubic-bezier(.22,.8,.22,1)`

Mechanical lock:
`cubic-bezier(.7,0,.3,1)`

Subtle hover/response:
`cubic-bezier(.2,.7,.2,1)`

Motion must feel physical, not bouncy.

## 4. Visual System

### 4.1 Palette

Base near-black: `#0c0a08`
Primary cream: `#eee4d5`
Muted cream: roughly 46–58% opacity depending on size
Hairline: roughly 10–15% cream opacity
Signal amber: `#d49a70`
Danger: warm high-contrast red/orange around `#ff8c7a`

No gradients as decorative UI surfaces. Radial light falloff is allowed only for material/presence simulation.

### 4.2 Typography

Two roles only:

1. Oversized editorial display typography for major product statements and question prompts.
2. Small technical/register typography for status, issue metadata, indices, prices, labels and policy navigation.

Avoid a third “marketing paragraph” style becoming dominant.

Display text must remain readable at 320px width without horizontal overflow. Long words use controlled responsive sizing and emergency wrapping only where necessary.

### 4.3 Material layer

Subtle film/grain texture may sit across public customer surfaces.

The effect must:

- remain below content readability threshold;
- never create moiré on mobile;
- never reduce text contrast;
- be disabled/reduced under low-power/reduced-motion paths if needed.

### 4.4 Hidden physical presence

A recurring abstract physical presence suggests that an object exists without revealing artwork.

Behavior:

- reacts gently to pointer proximity;
- appears to avoid direct inspection;
- may reveal edge light, surface distortion, registration-like marks or a shadow boundary;
- must never look like a product render with hidden blur over it;
- must not imply a specific printed graphic.

On touch devices, pointer avoidance is replaced by slow ambient drift tied lightly to scroll position.

## 5. Homepage / Discovery Experience

### 5.1 First viewport

Goal: comprehension within seconds.

Primary statement:

**YOU DON’T SEE THE DESIGN.**

Secondary plain-language line:

**That is the product.**

The first viewport should immediately make the absence intentional rather than broken.

A small rule strip introduces certainty:

`7 ANSWERS → 1 DESIGN → PRINTED ONCE`

Primary action:

`START ISSUE`

Secondary route:

`HOW IT WORKS`

### 5.2 Scroll choreography

Scroll should reveal the contract in a sequence, not a generic marketing page.

Suggested sequence:

1. `YOU DON’T SEE THE DESIGN.`
2. `7 ANSWERS.`
3. `1 DESIGN.`
4. `PRINTED ONCE.`
5. `YOU CHOOSE THE OBJECT.`
6. `YOU CHOOSE THE SIZE.`
7. `YOU CHOOSE THE BASE.`
8. `EVERYTHING ELSE STAYS HIDDEN.`
9. current issue number / availability state;
10. `YOU SEE IT WHEN IT’S YOURS.`
11. `START ISSUE`.

The sequence must avoid vague metaphor. Every statement should reduce uncertainty except the intentionally hidden design.

### 5.3 Current issue register

A current issue number appears as a central visual anchor, e.g. `#482731`.

It may perform a short digit-settle animation when first entering view or when explicitly interacted with, but it must settle deterministically rather than constantly scramble.

Associated facts:

- `DESIGN / UNSEEN`
- `RUN / 1 OF 1`
- `STATUS / AVAILABLE`

No fake “only one left” language. The one-of-one property is intrinsic to the design, not temporary inventory pressure.

### 5.4 Footer

Plain navigation:

- Privacy
- Store Info
- Contact
- Terms
- Returns
- Start Issue

No poetic substitutions for legal/store navigation.

## 6. Interview Experience

### 6.1 Use real canonical questions

The full demo must use the existing seven real questions from `src/domain/experience/questions.ts`:

1. “So tell me. What’s your favourite book?”
2. “Where would you disappear to for a week?”
3. “Pick a time. Which one feels most like you?”
4. “What do people usually get wrong about you?”
5. “What’s a song you never skip?”
6. “What’s something you’d never wear, no matter who made it?”
7. “Last one. Tell me something completely random about you.”

No invented demo questions.

### 6.2 Layout

Each question is nearly full-screen.

The active question contains:

- question number `01 / 07`;
- large prompt;
- input or choice group;
- restrained `CONTINUE` action;
- persistent issue ledger.

No extra motivational paragraph beneath each question.

### 6.3 Answer behavior

Text questions:

- large, comfortable textarea;
- character entry must feel immediate with no animated lag;
- focus state is clear but not neon;
- Cmd/Ctrl+Enter may continue when valid;
- Enter itself remains normal textarea behavior.

Choice question:

- large touch-friendly rows;
- whole row clickable;
- keyboard/radio semantics preserved;
- selection communicates immediately through type/border/register changes.

### 6.4 Progress

After each successful local submission in the demo:

- the current answer is stored only in local in-memory/session demo state;
- answer content is not echoed back publicly;
- ledger increments from `ANSWERS 1/7` onward;
- completed position briefly shows `LOCKED`;
- next question arrives.

### 6.5 Errors

Prototype controls must allow intentional simulation of:

- save failure;
- transient retry;
- stale session/reset.

When save failure is simulated:

- answer remains in field;
- status reads `NOT SAVED / TRY AGAIN`;
- danger color has strong contrast on dark background;
- continue remains available;
- no data loss animation.

## 7. Interview Completion

After question seven:

**WE HAVE ENOUGH.**

Below it, only the current ledger and `UNLOCK FORM` action.

No extra interpretation prose.

Transition into physical selection should feel like a sealed record opening a new section of the issuance document.

## 8. Physical Object Selection

Heading:

**CHOOSE THE OBJECT.**

Options:

- `01 TEE`
- `02 CAP`
- `03 TOTE`

No artwork preview.

A neutral outline/silhouette may be used only if it improves physical comprehension and does not imply a graphic.

Selected object updates the ledger immediately but is not permanent until `LOCK FORM` is activated.

Error simulation must support “selection unavailable” and retry while preserving selection.

## 9. Size Selection

Heading:

**YOUR SIZE.**

Tee sizes use current logical catalog:

- XS
- S
- M
- L
- XL
- 2XL

The prototype should show measurements where available and clearly distinguish code vs human label.

When a size is selected, a single plain warning may appear:

`Check this carefully. This is the size we’ll make.`

No mystery language here.

Cap/tote behavior follows actual app rules: only relevant sizing controls appear.

## 10. Base Color Selection

Heading:

**YOUR BASE.**

Tee colors:

- Bone
- Black
- Ash
- Navy
- Forest

Swatches should be physically large enough to evaluate and must show names. Color alone must never be the only indicator of selection.

Selection updates the ledger after lock.

## 11. Contact Verification

At this point the visual language deliberately becomes quieter and more functional.

Heading:

**YOUR EMAIL.**

States:

- fresh email;
- known verified email;
- request code;
- code sent;
- invalid code;
- expired code;
- retry/re-send;
- success.

The full demo uses fake/local verification state only.

Prototype controls allow one-click simulation of common OTP failures.

No provider requests occur.

## 12. Shipping

Heading:

**WHERE SHOULD WE SEND IT?**

Fields mirror the actual app:

- Name
- Address
- City
- Province/state/region
- Postal code
- Country
- Phone

Requirements:

- proper labels;
- keyboard order;
- native autocomplete attributes where appropriate;
- mobile-friendly controls;
- visible field-level validation;
- summary-level error for simulated provider/server failure;
- retry preserves all entered information.

No cinematic transition while the customer is filling logistics information.

## 13. Commitment / Purchase Decision

### 13.1 Main principle

This screen removes ambiguity before the simulated payment handoff.

It looks like an issuance certificate / final ledger.

### 13.2 Content

Example:

```text
ISSUE #482731

ANSWERS          7 / 7 LOCKED
OBJECT           TEE
SIZE             M
BASE             BONE
DESIGN           HIDDEN
PRODUCTION RUN   1
REPEAT           NEVER

PRICE            [REAL QUOTE IN PRODUCT / FIXTURE PRICE IN DEMO]
```

Primary explicit statement:

**YOU WILL NOT SEE THE DESIGN BEFORE PURCHASE.**

This statement must appear close to the final action.

### 13.3 Referral

Referral code entry supports demo states:

- idle;
- checking;
- applied;
- invalid;
- service unavailable;
- retry.

Discount math must visibly reconcile gross, referral, and final values.

### 13.4 Policy access

Store Info, Contact, Terms and Returns remain visible and usable from the commitment screen without losing prototype progress.

### 13.5 Final action

Button:

`ISSUE MINE`

Prototype click does not call Safepay or any payment provider.

Instead it routes through a local simulated checkout state.

## 14. Simulated Checkout

The full demo includes a clearly marked **DEMO CHECKOUT** surface so the owner can test the entire handoff feel without a provider.

States:

- opening checkout;
- payment details placeholder shell;
- payment success;
- payment failure;
- retry;
- cancelled/returned;
- pending.

No real card fields are requested. The demo provides explicit buttons such as:

- `SIMULATE SUCCESS`
- `SIMULATE FAILURE`
- `SIMULATE PENDING`
- `CANCEL`

These are owner-test controls, visually separated from the proposed customer UI.

## 15. Issue Creation / Success

Successful simulation transitions to:

**#482731 IS YOURS.**

The issue number becomes the dominant persistent object.

The design remains hidden.

Initial timeline:

1. Payment — Confirmed
2. Design — Pending
3. Production — Pending
4. Shipped — Pending
5. Delivered — Pending

The owner-test controls can advance the issue through states to inspect every screen.

## 16. Payment Pending

Dedicated pending state must feel intentional, not broken.

It shows:

- issue/payment reference;
- clear pending status;
- what the customer should do next;
- route back to issue lookup/status;
- no repeated checkout action that could accidentally create duplicate attempts in production logic.

Demo lets the owner resolve pending → confirmed/failed locally.

## 17. Issue Status Experience

### 17.1 Timeline

The status page uses a vertical production record, not generic ecommerce cards.

Possible statuses:

- PAYMENT / CONFIRMED
- DESIGN / PENDING
- DESIGN / LOCKED
- PRODUCTION / QUEUED
- PRODUCTION / IN PROGRESS
- SHIPPED
- DELIVERED

The design itself remains unseen before the real product context allows reveal.

### 17.2 Status language

Status copy must be operational and concrete.

Avoid poetic euphemisms when customers need certainty.

## 18. Issue Recovery

Recovery should feel secure and boring in the best way.

Heading:

**FIND YOUR ISSUE.**

Use the existing recovery mechanism and content constraints, but restyle into the issuance system.

States:

- empty;
- invalid input;
- not found;
- verification needed;
- recovered;
- server unavailable;
- retry.

Never expose private answers.

## 19. Issue Support

Support page should preserve issue context and let the customer submit a concern without visual clutter.

Requirements:

- readable textarea at 320px width;
- submit button can never be overlapped or obscured;
- reference/receipt response after successful demo submission;
- simulated failure preserves text;
- keyboard and screen-reader semantics intact.

## 20. Repeat Customer Experience

The full demo must include the real repeat-choice branch.

The experience makes the distinction clear between:

- beginning another issue using prior profile/context where the real product allows it;
- starting fresh.

It must not imply that a prior design can be repeated.

The one-of-one design rule remains visually explicit.

## 21. Store / Legal Pages

The following receive the same visual system but remain information-first:

- Store Info
- Contact
- Terms
- Returns

Rules:

- no giant headline that breaks words at mobile widths;
- body reading width ~60–75 characters where practical;
- real navigation labels;
- clear back/start links;
- no hidden legal content behind decorative interactions;
- no invented merchant facts.

## 22. Prototype Navigation Model

The demo should behave like a real application, not a slideshow.

Preferred implementation:

- real React/Next routes under an isolated preview namespace where practical;
- local demo state persisted in `sessionStorage` so refresh/back/forward can be tested;
- no production API writes;
- all simulated responses originate from local fixtures/state machine;
- URL reflects major stages so browser navigation has meaning.

Potential namespace:

`/__demo__/issuance-ritual/...`

Routes may include:

- `/__demo__/issuance-ritual`
- `/__demo__/issuance-ritual/begin`
- `/__demo__/issuance-ritual/checkout`
- `/__demo__/issuance-ritual/payment/pending`
- `/__demo__/issuance-ritual/issue`
- `/__demo__/issuance-ritual/recovery`
- `/__demo__/issuance-ritual/support`
- `/__demo__/issuance-ritual/store-info`
- `/__demo__/issuance-ritual/contact`
- `/__demo__/issuance-ritual/terms`
- `/__demo__/issuance-ritual/returns`

The implementation plan may choose a smaller route set if it preserves real browser semantics.

## 23. Demo Control Surface

Owner-only demo controls are required so every branch can be tested without real providers.

Controls must be visually and semantically separated from customer UI, e.g. collapsible `DEMO CONTROLS` rail.

Capabilities:

- reset demo;
- jump to stage;
- simulate save failure;
- simulate object/size/base failure;
- simulate OTP invalid/expired/unavailable;
- simulate shipping failure;
- simulate referral success/failure;
- simulate checkout success/failure/pending/cancel;
- advance issue production state;
- simulate support failure/success;
- toggle returning-customer path;
- toggle reduced-motion preview helper where technically feasible.

The demo controls must never be included in production promotion without deliberate removal.

## 24. Sound / Haptics

Default: no sound.

Do not rely on browser audio for sophistication.

Optional mobile haptic behavior is not part of the web demo because browser support is inconsistent and it could feel gimmicky.

Physicality must come from visual timing, state permanence, typography and interaction response.

## 25. Hover / Pointer Details

Desktop pointer interactions may include:

- restrained light-follow response;
- hidden-presence avoidance;
- index/ledger row emphasis;
- button gap/underline response;
- product option line movement;
- issue number digit settle on explicit hover/click.

No custom cursor that harms usability.

No element should move away from the pointer if it is itself clickable.

## 26. Scroll Behavior

The landing page may use scroll-linked reveals, but application forms should not require scrolling tricks to progress.

No scroll-jacking.

No forced wheel snapping.

No full-page parallax that causes motion sickness.

The landing experience remains usable if JavaScript animation APIs are unavailable.

## 27. Responsive Targets

Mandatory physical layouts:

- 320 × 568 class viewport
- 360/375px mobile
- Pixel 7 class viewport
- 768px tablet portrait
- 1024px tablet/compact desktop
- 1440 × 1000 desktop
- ~1920px large desktop

Acceptance rules:

- zero horizontal document overflow;
- no inaccessible offscreen controls;
- no hover-only action;
- no giant unbreakable uppercase words;
- forms remain one-handed usable where reasonable;
- fixed ledgers do not cover inputs or browser keyboard area;
- safe-area insets considered on mobile.

## 28. Accessibility

The demo must be built as if it could ship.

Requirements:

- semantic headings;
- proper labels/fieldsets/radios;
- visible focus states;
- keyboard complete journey;
- no keyboard trap;
- escape closes appropriate overlays only;
- live regions only for meaningful status updates;
- minimum touch target around 44px where practical;
- high-contrast error states;
- color never sole state indicator;
- `prefers-reduced-motion` disables nonessential movement;
- reading order matches visual order;
- decorative layers `aria-hidden`/pointer-events none.

## 29. Performance

No large animation framework unless implementation evidence proves it materially simplifies behavior without harming bundle/runtime.

Preferred stack:

- CSS transforms/opacity;
- IntersectionObserver;
- requestAnimationFrame only for lightweight pointer response;
- React state for product flow;
- no continuous expensive layout reads in scroll handlers;
- passive scroll listeners when used;
- avoid large image/video backgrounds.

Target feel: 60fps on a normal midrange modern phone for core transitions.

## 30. Copy Governance

This build introduces a strict copy rule:

**No invented vague copy may enter the customer path simply to make the brand sound mysterious.**

Every line must do at least one of:

- explain the rule;
- ask for information;
- confirm a choice;
- show status;
- reduce purchase risk;
- communicate the intentional design mystery;
- provide legal/store/support information.

If a line cannot justify itself under one of those roles, delete it.

The actual seven existing questions are preserved.

Final production copy remains owner-reviewable; the demo should use direct, concrete language that reflects the approved “mystery of design, certainty of rules” strategy.

## 31. Data / Privacy Rules for Demo

- no external analytics required for owner preview;
- no real email sent;
- no real OTP generated;
- no real shipping stored server-side;
- no payment provider call;
- no Printful call;
- no order/manufacturing creation;
- no production referral mutation;
- no private answer upload;
- local demo state should be trivially resettable.

## 32. Isolation Rules

The demo must not alter:

- production branch;
- Hostinger selected branch;
- production domain;
- production env vars;
- database schema;
- provider credentials;
- Safepay integration;
- Printful integration;
- catalog publication state;
- manufacturing behavior;
- Owner OS behavior.

No merge or deployment to production until explicit owner approval after physical testing.

## 33. Engineering Structure

Preferred component boundaries:

- `IssuanceDemoShell` — global demo frame, ledger, reset/control rail.
- `IssuanceLedger` — issue metadata/status display.
- `HiddenPresence` — decorative physical-presence behavior only.
- `LandingSequence` — discovery scroll scenes.
- `DemoInterview` — local fixture-backed seven-question flow.
- `DemoObjectSelection` — tee/cap/tote.
- `DemoSizeSelection` — object-aware sizing.
- `DemoBaseSelection` — color choice.
- `DemoContactVerification` — local OTP simulation.
- `DemoShipping` — local address + validation.
- `DemoCommitment` — frozen selection + referral fixture + explicit mystery contract.
- `DemoCheckout` — safe checkout simulations.
- `DemoIssueStatus` — timeline and owner-state controls.
- `DemoRecovery` — local recovery simulation.
- `DemoSupport` — local support simulation.
- `DemoMerchantPageShell` — legal/store/contact presentation.
- `demoState` reducer/state machine — single source of truth for prototype state.
- `demoFixtures` — deterministic fake responses and issue identity.

Avoid one 1,500-line prototype component.

## 34. State Machine

The demo state machine should explicitly model:

`landing`
→ `interview:q1..q7`
→ `interview-complete`
→ `object`
→ `size`
→ `base`
→ `contact`
→ `otp`
→ `shipping`
→ `commitment`
→ `checkout`
→ `payment-pending | payment-failed | issue-created`
→ `issue-status`

Independent routes:

- recovery
- support
- merchant pages
- repeat-choice entry.

Invalid state transitions must fall back safely rather than rendering blank screens.

## 35. Testing Strategy

### 35.1 Unit/component

Test:

- state transitions;
- persistence/reset;
- ledger derivation;
- question progression;
- optional q7 behavior;
- object/size/base validation;
- OTP fixture states;
- shipping validation;
- referral calculation display;
- checkout simulations;
- issue timeline advancement;
- recovery/support state preservation;
- reduced-motion behavior where testable.

### 35.2 Browser

Playwright must physically traverse the full demo on desktop and mobile.

Required journeys:

1. happy path landing → issue created → status;
2. answer-save failure/retry;
3. object/size/base failure/retry;
4. OTP invalid → retry → success;
5. shipping invalid → corrected → success;
6. referral invalid → valid/applied;
7. checkout failure → retry → success;
8. checkout pending → issue/status resolution;
9. repeat-customer path;
10. recovery success/failure;
11. support success/failure;
12. legal/store navigation while preserving demo progress;
13. back/forward/refresh preservation;
14. keyboard-only happy path;
15. reduced-motion journey;
16. 320px overflow/hit-target test;
17. Owner OS visual/behavior isolation regression.

### 35.3 Visual evidence

Capture representative screenshots for:

- landing desktop/mobile;
- question 1;
- q3 choice state;
- interview complete;
- object;
- size;
- color;
- OTP error;
- shipping;
- commitment;
- checkout pending/failure/success;
- issue timeline;
- recovery;
- support;
- terms/returns/store-info.

The owner should be able to inspect the evidence even before opening the live preview.

## 36. Completion Gate

The full demo is not “ready for owner decision” until all of the following are true:

- code resides only on isolated demo branch/preview;
- unit/component tests pass;
- typecheck passes;
- lint passes;
- production build passes;
- browser suite passes desktop/mobile;
- 320px overflow checks pass;
- reduced-motion checks pass;
- keyboard journey passes;
- Owner OS isolation checks pass;
- branch diff contains no backend/provider/payment/catalog/manufacturing/DB behavior changes;
- live preview is directly accessible to owner;
- owner can reset and replay all major states;
- no invented vague copy remains in the customer journey;
- no real provider side effect is possible from the demo.

Even after this gate, there is **no merge and no production update** until explicit owner approval.

## 37. Decision Summary

The previous “secret-motion luxury mystery” experiments are not the final direction.

The approved full-demo direction is:

**ISSUANCE RITUAL**

- mystery is concentrated entirely on the hidden design;
- transaction rules are concrete;
- the interaction language is built around locking an issue record;
- the customer gradually invests through seven real answers;
- physical choices are functional and trustworthy;
- the commitment screen is explicit;
- post-purchase ownership centers on the issue number;
- motion reinforces permanence and physicality rather than decorating pages;
- the complete experience behaves like a real product, not a mockup.
