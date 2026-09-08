# ISSUED ONCE Final Production UI Design

**Status:** OWNER APPROVED — derived from the owner-supplied `ISSUED ONCE — FINAL UI IMPLEMENTATION HANDOFF` received 2026-09-08.

**Goal:** Put the existing production ISSUED ONCE customer experience into the approved cream editorial ritual UI without changing product, payment, fulfillment, privacy, catalog, or provider semantics.

## Authority and precedence

1. Latest reachable integration state and merged repository history.
2. `.engineering/CONTINUATION.json` and referenced consumer-readiness ledgers.
3. Existing backend/domain/provider contracts and tests.
4. This owner-approved presentation spec.
5. The supplied standalone reference HTML and supplied object imagery as visual/interaction references only.

The standalone reference still contains an older dark global palette. The owner-approved handoff explicitly supersedes that conflict: the main site is cream `#F3EEE6`; only object inspection cards remain dark.

## Non-negotiable product semantics

- Generated artwork is never visible before purchase, including hidden DOM, metadata, URLs, alt text, payloads, or hover states.
- One design / one owner / one time remains unchanged.
- No fake issue allocation, issue movement, purchase activity, availability, or social proof.
- Existing OTP, shipping, quote, payment, referral, recovery, support, status, database, Printful, and Safepay contracts remain authoritative.
- No pricing, policy, merchant/legal, catalog publication, manufacturing, or provider behavior changes are part of this UI work.
- Printful production confirmation stays disabled and UI QA never creates a real charge or manufacturing action.
## Visual system

```css
--bg: #F3EEE6;
--ink: #11100E;
--muted: rgba(17,16,14,.58);
--faint: rgba(17,16,14,.22);
--line: rgba(17,16,14,.16);
--line2: rgba(17,16,14,.30);
--signal: #9B6B47;
--danger: #9E3E32;
--ok: #4F7554;
--max: 1320px;
--pad: clamp(20px, 4vw, 58px);
--serif: Georgia, "Times New Roman", serif;
--sans: Arial, Helvetica, sans-serif;
```

Header is fixed, 64px, translucent cream with a thin rule. Ritual content is capped at 1020px and reserves a 210px right ledger on desktop; at <=900px the ledger is 184px; at <=720px it becomes a mobile bottom-sheet control and ritual right padding disappears.

Homepage never shows the ritual ledger. Its exact editorial sequence is:
- `A piece of your mind.` / italic `Issued for you.`
- `7` / `questions are enough.`
- `1` / `design.`
- `1 / 1` / `exists once.`
- current-issue presentation with `HIDDEN / 1 / 1 / AVAILABLE`
- `BEGIN.`
## Truthful issue presentation

Production currently allocates the actual eight-character `IO-XXXX-XXXX` Issue Code only after verified payment truth. There is no pre-payment public issue reservation allocator in the customer flow.

Therefore this UI must not invent the demo's pre-purchase number. Before payment, presentation may say `ISSUE / NOT YET` or use a neutral non-number placeholder; after issue creation, customer status uses the real server-issued code. Number-scramble motion is allowed only when a genuine underlying number/value changes.

## Question ritual and ledger

Keep the seven production questions exactly as currently assigned by the canonical question source. Render one at a time, huge serif prompt, minimal input, `01 / 07`, deliberate continue/save feedback, keyboard semantics, and reduced-motion support.

The progressive ledger appears after START and only reveals established truth. Presentation rows are:
- ISSUE
- ANSWERS
- OBJECT
- SIZE
- BASE
- DESIGN
- RUN

Before payment, ISSUE is explicitly unissued/not-yet rather than a fabricated code. ANSWERS may show truthful progress such as `3 / 7`; object/size/base rows appear only after the corresponding production handler succeeds. Design and run stay hidden/pending until real downstream truth exists.

## Object inspection selector

Desktop gallery is exactly three equal columns, 16px gaps, 380px card height in the 1020px ritual lane. At <=900px cards are 300px high. At <=720px they are one column and 240px high.
Object cards use the deliberate dark exception: `#100c09` with cream foreground. Selection never changes card geometry; unselected cards fade to roughly `.58` opacity.

The selected card cycles on repeated activation:
1. FORM
2. MATERIAL
3. TECHNICAL
4. DISPLAY
5. FORM

Mode rail values are 25%, 50%, 75%, 100%. Pointer-capable devices get restrained tilt/light and a scan line. Touch and keyboard activation are first-class, and `prefers-reduced-motion` removes non-essential motion.

Use only the supplied form-study assets:
- `asset-form-{tee,cap,tote}.jpg`
- `asset-macro-{tee,cap,tote}.jpg`
- `asset-tech-{tee,cap,tote}.jpg`
- `asset-museum-{tee,cap,tote}.jpg`

These images are physical/form studies and never customer-generated artwork. Alt text describes the physical study only.

## Downstream customer flow

Size, base color, contact/OTP, shipping, referral, commitment, checkout handoff, payment-pending, issued/status, recovery, support, repeat-order, store info, contact, terms, and returns inherit the cream editorial system while retaining their current handlers, fields, errors, accessibility, and provider-backed values.

Catalog display always renders sizes/colors/prices from the current production domain data returned by the existing routes. No UI-only hardcoded variant or price becomes commercial truth.
## Motion, responsive, and accessibility

Motion is quiet and physical: section reveal, real-value issue scramble, pointer inspection light, restrained tilt, selection scan, save/lock transition, and short page entrance. No bounce, overshoot, carousels, or motion required for comprehension.

Required widths: 1440, 1024, 768, 390, and 360. There must be zero page-level horizontal overflow. At <=720px, header height is 58px, issue header value hides, utilities reduce, ritual becomes full width, forms collapse to one column, cursor light is disabled, and object cards stack.

Preserve semantic buttons/links/labels, radio semantics, keyboard navigation, visible focus, tap targets, live/error announcements, contrast, and reduced-motion behavior.

## Acceptance evidence

Fresh evidence is required before production promotion:
- computed root/background value equals `#F3EEE6`;
- homepage copy/order and no-home-ledger contract;
- object asset, geometry, cycle, keyboard/touch, no-growth contract;
- existing automated unit/integration suite remains green;
- customer Browser QA is green at desktop/mobile;
- direct hard-test covers every reachable customer button and the tee/cap/tote catalog path;
- size/color options observed are the real route responses;
- contact/OTP, shipping, referral, checkout handoff, pending/status/recovery/support/repeat and merchant pages are exercised without real payment or manufacturing side effects;
- no console errors and no page-level overflow at required widths;
- keyboard-only and reduced-motion passes are recorded;
- missing/failure provider states are tested with mocks/fixtures;
- no hidden design/artwork data leaks into pre-purchase DOM or network-visible presentation.
