# ISSUED ONCE — Issuance Ritual Interaction & Motion Matrix

Companion to `2026-09-07-issued-once-issuance-ritual-full-demo-design.md`.

This document removes implementation ambiguity from the approved full-demo design. Where this matrix is more specific than the main design document, this matrix controls the demo behavior.

## 1. Locked Copy Corrections

The landing hero secondary line is **not** “That is the product.”

Use:

**THE DESIGN STAYS HIDDEN UNTIL AFTER PURCHASE.**

The landing rule strip is:

`7 ANSWERS → 1 DESIGN → PRINTED ONCE`

The scroll sequence must not say “everything else stays hidden.” Use:

**THE DESIGN STAYS HIDDEN.**

This keeps the information gap confined to the design and does not imply uncertainty about product, price, shipping, policies or process.

## 2. Locked Demo Architecture

The demo namespace is fixed:

`/__demo__/issuance-ritual`

Major routes are fixed as:

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

The demo uses a reducer/state-machine with `sessionStorage` persistence. Reload, back and forward must have meaningful behavior.

No demo state is posted to production APIs.

## 3. Locked Ledger Placement

Desktop >= 1024px:

- fixed right-edge ledger rail;
- width target 180–220px depending on viewport;
- vertically centered in interaction stages;
- collapses to minimal issue-number/status mode on merchant/legal pages;
- never overlays primary form controls.

Tablet 768–1023px:

- compact sticky top register under the page header;
- horizontally scroll-free;
- two-line maximum collapsed state.

Mobile < 768px:

- sticky compact top ledger;
- visible issue number + current stage + progress;
- tap expands a bottom sheet with full ledger;
- bottom sheet has proper dialog semantics, close control and focus return;
- must not cover focused text inputs when the virtual keyboard is open.

## 4. Locked Price Behavior

The demo does not invent a new commercial price.

The commitment screen must derive its displayed demo quote from the repository’s existing local/test catalog or quote fixture for the selected object/variant. If multiple existing fixture paths exist, the implementation plan must choose the fixture already used by browser tests.

The UI labels the owner-test payment surface `DEMO CHECKOUT`, but the customer-facing commitment ledger renders the fixture quote exactly as the actual UI would render a real frozen quote.

No new business price constant is introduced just for visual design.

## 5. Locked Object Visualization

Do **not** show tee/cap/tote silhouettes on the object-selection stage in v1.

Object selection is typographic and structural only:

`01 TEE`
`02 CAP`
`03 TOTE`

Reason: the physical object is already understandable from its name, and silhouettes risk moving the design language toward generic ecommerce cards.

## 6. Hidden Presence Interaction

Purpose: suggest an existing physical object while frustrating visual inspection of the hidden design.

It is decorative only and never clickable.

### Desktop behavior

- default opacity: 0.48–0.68 depending on section;
- pointer-response radius: ~260–340 CSS px;
- maximum translation away from pointer: 18–28px;
- maximum rotation change: 2.5deg;
- response smoothing: 160–240ms equivalent low-pass feel;
- no sudden acceleration;
- when pointer exits radius, return over 450–650ms;
- pointer layer is `pointer-events:none`.

### Scroll behavior

- presence drifts by no more than 4–6% of its size across a viewport-height scroll interval;
- surface light may shift 6–12%;
- no full parallax background movement;
- design-identifying detail is impossible because no artwork asset exists in the demo.

### Mobile

- no pointer logic;
- ambient drift loop 8–14 seconds, alternate direction;
- scroll offset adds only subtle 6–14px displacement;
- disabled under `prefers-reduced-motion`.

## 7. Landing Interaction Matrix

### Hero load

0ms:
- page near-black is immediately present; no white flash.

40–120ms:
- brand/status register resolves.

120–320ms:
- hero line mask/reveal begins.

320–620ms:
- main statement reaches final position/opacity.

450–850ms:
- secondary explicit line appears.

650–1000ms:
- rule strip appears.

No entrance sequence may block `START ISSUE`; the action is interactive as soon as hydration allows.

### Scroll progress

- 2px top progress line on desktop/tablet;
- 1px on mobile;
- signal amber;
- direct scroll ratio, no spring lag;
- hidden on form routes where it adds no value.

### Statement reveals

- initial opacity ~0.12–0.18;
- translate Y 28–44px;
- becomes full contrast at 20–35% viewport intersection;
- duration 650–900ms;
- one-way reveal; scrolling back does not repeatedly replay dramatic entrances.

### Issue number settle

- issue number is deterministic for the demo session;
- first reveal may settle digits for 280–420ms;
- explicit click may replay a shorter 180–260ms settle;
- hover alone does not constantly scramble the number;
- the final number never changes inside a session.

## 8. Button Grammar

Primary text actions use underline/hairline mechanics rather than filled pills except where a strong final commit action benefits from a filled state.

### Hover

- color moves cream → amber in 140–220ms;
- arrow/gap shifts 6–12px;
- underline remains visible;
- no scale bounce.

### Press

- 70–100ms compression response;
- optional translate Y 1px;
- no opacity flicker.

### Disabled

- 28–38% text opacity;
- cursor not-allowed only where meaningful;
- remains readable;
- layout does not shift when enabled.

### Focus visible

- explicit 1–2px outline or high-contrast underline state;
- never remove outline without replacement.

## 9. Interview Question Motion

### Entry

- ledger stage updates first or simultaneously;
- question index enters 120–180ms before prompt completes;
- prompt translates 24–38px and fades in over 420–560ms;
- input appears during last 160–220ms of prompt transition;
- focus moves to text field only after route/stage is stable.

### Answer lock

On valid submit:

1. button enters pending state immediately;
2. input border changes to signal tone for 120–180ms;
3. answer surface clips/contracts vertically by ~8–16px while fading to muted;
4. `01 / 07` briefly becomes `01 / LOCKED`;
5. ledger increments;
6. outgoing stage translates upward 18–28px and fades;
7. next stage enters.

Total target: 520–720ms.

Do not animate the typed text character-by-character after submission.

### Save failure

- no outgoing transition;
- field remains exactly where it is;
- answer is preserved;
- status appears without causing layout jump greater than ~8px;
- danger color;
- optional one-time 2–3px horizontal micro-shift is allowed only if subtle and reduced-motion safe;
- retry button remains usable.

## 10. Choice Question

Choice rows:

- minimum 52px desktop, 56px mobile touch height;
- hairline separators;
- selected row adds signal marker + text contrast;
- radio remains semantic even if visually customized.

Selection response:

- marker enters 120–180ms;
- no background flood animation;
- selection should feel decisive, not playful.

## 11. Interview Complete Transition

When q7 locks:

- ledger reads `ANSWERS 7 / 7`;
- current interaction surface clears;
- `WE HAVE ENOUGH.` enters at large scale;
- a thin horizontal rule draws across 40–65% viewport width over 400–600ms;
- `UNLOCK FORM` appears after ~250ms;
- no explanatory paragraph.

Activating `UNLOCK FORM` uses a controlled split/reveal transition into object selection; target 500–700ms.

## 12. Object Selection

Three rows only.

Hover/focus:

- index stays muted;
- object label shifts signal;
- right-side state changes `—` → `SELECT`.

Selected:

- right-side state `SELECTED`;
- amber rule/marker;
- ledger preview updates immediately but shows `UNLOCKED`/pending distinction until `LOCK FORM`.

Lock:

- selected row compresses into a one-line locked record;
- other rows fade to ~10–15% and leave over 260–360ms;
- ledger changes object to locked;
- size stage enters.

## 13. Size Selection

Sizes are not rendered as generic rounded chips.

Use square/rectangular cells or ledger rows with clear code/label.

- selected size has signal border + `SELECTED` text/iconography;
- measurement detail expands beneath the selected cell/row in 180–260ms;
- expansion uses height/opacity carefully to avoid large content jump;
- `CONFIRM SIZE` becomes enabled without moving position.

If object has no meaningful size selection, the stage shows the fixed physical sizing fact and a confirmation action rather than fake options.

## 14. Base Color Selection

Large tactile swatches.

Each swatch includes:

- actual base color sample;
- explicit color name;
- selected marker.

Hover/focus:

- swatch surface does not zoom dramatically;
- border strengthens;
- label contrast increases.

Selection:

- 160–240ms border/marker response;
- ledger preview updates;
- lock transition 320–480ms.

## 15. Contact / OTP Interaction

This area deliberately sheds most cinematic motion.

### Email

- one clear field;
- no floating labels;
- validation below field;
- `SEND CODE` pending state keeps button width stable.

### OTP

Use one six-digit input or six visually grouped slots backed by one semantic input; implementation plan chooses based on existing component compatibility.

Locked behavior:

- paste entire code works;
- backspace works naturally;
- mobile numeric keyboard requested;
- invalid code uses danger state without shaking the whole page;
- resend/cooldown state is readable and stable.

## 16. Shipping Interaction

No decorative hidden-presence object inside the form viewport.

Validation:

- occurs on submit and on touched invalid fields;
- first invalid field receives focus after submit;
- summary error appears only when useful;
- server-simulated failure leaves every field value intact.

Country select remains native enough to function reliably on mobile.

## 17. Commitment Ledger Motion

This is the highest-intensity transactional screen, but not visually noisy.

Entry sequence:

1. issue number;
2. horizontal rule;
3. ledger rows reveal top-to-bottom at 60–90ms stagger;
4. explicit mystery contract appears;
5. price/referral area;
6. policy links;
7. `ISSUE MINE`.

Total reveal may run ~900–1300ms, but the page is readable/interactable during it.

The explicit line near purchase is fixed:

**YOU WILL NOT SEE THE DESIGN BEFORE PURCHASE.**

No poetic substitute.

## 18. Referral Interaction

Apply code:

- `CHECKING` state in place;
- success inserts discount row and updates final total with a 220–320ms numeric/opacity transition;
- invalid code shows direct status, no red full-page banner;
- service unavailable states retry without blocking checkout at original quote where product behavior allows it.

## 19. Demo Checkout

Owner controls are visibly separated from the customer-design evaluation surface.

Customer shell shows a neutral checkout handoff experience.

A narrow clearly labeled owner panel exposes:

- success;
- failure;
- pending;
- cancel.

These controls must not visually masquerade as real payment options.

Payment success transition:

- final action enters pending;
- 350–550ms terminal-like processing state;
- route changes to issue creation;
- issue number enlarges and becomes the emotional anchor.

Payment failure:

- no lost selection/quote state;
- direct retry action.

## 20. Issue Created / Ownership Moment

Headline:

**#482731 IS YOURS.**

This is the one moment allowed to feel emotionally expansive.

Still no confetti.

Suggested behavior:

- issue number scales from ~92% to 100% over 500–750ms;
- surrounding metadata fades from low contrast to readable;
- timeline rule draws downward;
- `PAYMENT / CONFIRMED` becomes first locked event;
- remaining events render pending.

## 21. Status Timeline Motion

Advancing state via demo control:

- pending node changes to signal tone;
- connecting rule fills over 280–420ms;
- status text changes after rule begins;
- no page reload needed;
- design remains hidden.

Delivered state may expose a future “reveal context” placeholder only if the real product rules define one; the demo must not invent the actual artwork reveal.

## 22. Recovery / Support

Functional, quiet, issuance-branded.

Recovery success:

- issue record appears via 260–380ms fade/translate;
- no answer content displayed.

Support success:

- input area collapses modestly;
- safe reference number appears;
- `COPY REFERENCE` may be provided;
- text is preserved on simulated failure.

## 23. Merchant / Legal Page Motion

Only:

- page entrance opacity/translate < 350ms;
- link hover/focus;
- subtle section rule reveals.

No giant scroll spectacle on Terms/Returns/Contact/Store Info.

Reading takes priority.

## 24. Demo Controls UX

Collapsed by default.

Desktop:
- small fixed tab at lower-left or lower-right, avoiding customer actions;
- opens a narrow utility rail.

Mobile:
- small `DEMO` button in safe-area-aware bottom corner;
- opens full-width bottom sheet.

Controls:

- `RESET`
- `JUMP TO…`
- `FAIL NEXT ANSWER SAVE`
- `FAIL NEXT SELECTION`
- `OTP INVALID`
- `OTP EXPIRED`
- `SHIPPING FAILURE`
- `REFERRAL VALID`
- `REFERRAL INVALID`
- `CHECKOUT SUCCESS`
- `CHECKOUT FAILURE`
- `CHECKOUT PENDING`
- `RETURNING CUSTOMER`
- `ADVANCE ISSUE STATUS`

All effects are deterministic and one-shot where labeled “next.”

## 25. Route / State Resilience

- direct navigation to a later route without prerequisite demo state redirects to the nearest valid stage;
- refresh preserves session state;
- reset clears session state and returns to landing;
- back from commitment returns to shipping while preserving data;
- merchant/legal detours preserve progress and provide a clear route back;
- browser Back from checkout returns to commitment without duplicating local payment attempts;
- pending route reload remains pending until owner demo control resolves it.

## 26. Reduced Motion

When `prefers-reduced-motion: reduce`:

- no hidden-presence drift;
- no scroll-linked parallax;
- no digit scramble;
- no large translate transitions;
- stage changes use short opacity changes <= 150ms or instant state switch;
- ledger updates remain visible through text/state changes;
- all information and flow remain identical.

## 27. Performance Budget

Design target, not a production SLA:

- no continuously animated full-screen canvas;
- no WebGL dependency;
- no video background;
- no animation package unless the implementation plan proves clear value;
- pointer animation modifies transforms/opacity only;
- no synchronous storage writes on every keystroke; debounce or save at meaningful state boundaries;
- landing should remain responsive under CPU-throttled browser QA.

## 28. Self-Review Resolution

This matrix resolves the main spec’s remaining optional language:

- landing explanatory copy is explicit;
- ledger placement is fixed by breakpoint;
- demo route namespace is fixed;
- object silhouettes are rejected;
- demo quote source is existing repository fixture data, not a new invented price;
- stage/motion behaviors have concrete ranges;
- reduced-motion behavior is explicit;
- browser navigation/persistence behavior is explicit.

There are no intentional `TBD` or `TODO` items in the approved design surface.
