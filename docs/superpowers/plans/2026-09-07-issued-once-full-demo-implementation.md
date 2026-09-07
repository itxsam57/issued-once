# ISSUED ONCE Full Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete standalone interactive ISSUED ONCE demo that lets the owner test the sealed-issue customer experience end to end without production/provider calls.

**Architecture:** Single self-contained HTML application for immediate owner review, with hash-routed screens, persistent demo state in localStorage, a reusable issuance ledger, a concealed-material visual system, deterministic motion, error simulation controls, and no external network dependencies. The standalone demo mirrors the intended production interaction language but is explicitly isolated from production business logic.

**Tech Stack:** HTML5, CSS custom properties, inline SVG, vanilla JavaScript, localStorage, hash routing, progressive enhancement, reduced-motion media query.

**Spec:** `docs/superpowers/specs/2026-09-07-issued-once-issuance-ritual-full-demo-design.md` and `docs/superpowers/specs/2026-09-07-issued-once-issuance-ritual-interaction-matrix.md`

## Global Constraints

- Mystery of the design. Certainty of the rules.
- No marketing filler copy or invented luxury prose.
- The seven questions must match the canonical repository questions exactly.
- No real OTP, payment, shipping, Printful, Safepay, provider, database, manufacturing, or production calls.
- No product artwork preview.
- Use issue number, ledger state, motion, material response, and locking interactions to create curiosity.
- Forms/logistics are intentionally calm and functional.
- Support keyboard operation, 320px mobile, desktop, reduced motion, and state persistence.
- Demo-only failure controls must be visually separate from the customer UI.

---

### Task 1: Contract test harness

**Files:**
- Create: `/mnt/data/issued-once-full-demo-check.py`
- Test target: `/mnt/data/issued-once-full-demo.html`

**Interfaces:**
- Consumes: final standalone HTML artifact.
- Produces: deterministic checks for required routes, canonical questions, selectable products/sizes/colors, checkout simulation, issue/recovery/support/repeat states, reduced-motion CSS, and forbidden vague copy.

- [ ] **Step 1:** Write checks before the demo exists.
- [ ] **Step 2:** Run checks and confirm RED because the artifact does not exist.
- [ ] **Step 3:** Keep the checker unchanged while implementing Tasks 2–9.
- [ ] **Step 4:** Run checker after implementation and require PASS.

### Task 2: Sealed landing + material system

**Files:**
- Create: `/mnt/data/issued-once-full-demo.html`

**Interfaces:**
- Produces: `routeHome()`, concealed material visual, cursor/touch response, issue register, `BEGIN` transition, legal/footer navigation.

- [ ] **Step 1:** Implement a near-black editorial landing with minimal copy.
- [ ] **Step 2:** Add concealed textile/material presence using CSS/SVG only.
- [ ] **Step 3:** Add pointer-proximity avoidance, inspection light, grain, issue-number settle, scroll progress, magnetic primary action.
- [ ] **Step 4:** Add reduced-motion substitutions.

### Task 3: Issuance shell + persistent ledger

**Interfaces:**
- Produces: `DemoState`, `saveState()`, `resetState()`, `renderLedger()`, `navigate(route)`, stage transitions.

- [ ] **Step 1:** Add hash routing and localStorage persistence.
- [ ] **Step 2:** Build desktop rail and mobile expandable ledger.
- [ ] **Step 3:** Add lock transition grammar and keyboard-safe focus management.

### Task 4: Canonical seven-question ritual

**Interfaces:**
- Consumes: canonical questions from repository spec.
- Produces: question stages 1–7, choice semantics for question 3, answer persistence, failure/retry simulation.

- [ ] **Step 1:** Render exact questions.
- [ ] **Step 2:** Add text/choice input behavior and Ctrl/Cmd+Enter.
- [ ] **Step 3:** Add mechanical lock transition and ledger increment.
- [ ] **Step 4:** Add simulated save failure preserving answer.

### Task 5: Object, size, and base selection

**Interfaces:**
- Produces: TEE/CAP/TOTE selection, XS–2XL tee sizes, visual base selection using Bone/Black/Ash/Navy/Forest, ledger updates.

- [ ] **Step 1:** Build low-light specimen object selector with no artwork.
- [ ] **Step 2:** Build functional size stage with measurements panel behavior.
- [ ] **Step 3:** Build large tactile base-color fields with material-light response.
- [ ] **Step 4:** Add lock/retry states.

### Task 6: Contact, OTP, and shipping

**Interfaces:**
- Produces: email entry, known/new state, fake OTP `123456`, invalid/expired/resend states, shipping validation, preserve-on-failure behavior.

- [ ] **Step 1:** Build calm email stage.
- [ ] **Step 2:** Build six-digit OTP interaction and demo failure modes.
- [ ] **Step 3:** Build shipping fields with labels, autocomplete semantics, validation and mobile behavior.

### Task 7: Commitment + simulated checkout

**Interfaces:**
- Produces: final issuance ledger, referral simulation, explicit hidden-design disclosure, checkout simulator success/failure/pending/cancel.

- [ ] **Step 1:** Build final issuance certificate.
- [ ] **Step 2:** Add demo quote/referral math and error states.
- [ ] **Step 3:** Build simulated checkout without card inputs.
- [ ] **Step 4:** Route outcomes to issued/pending/failure states.

### Task 8: Post-purchase product system

**Interfaces:**
- Produces: issue confirmation, status timeline, demo status advancement, recovery, support, repeat-customer flow.

- [ ] **Step 1:** Build `ISSUED` confirmation seal.
- [ ] **Step 2:** Build vertical issue-production record with status advancement controls.
- [ ] **Step 3:** Build recovery with fake verified-email path.
- [ ] **Step 4:** Build support form and local reference generation.
- [ ] **Step 5:** Build repeat issue history and new-issue reset path.

### Task 9: Utility/legal surfaces + demo lab

**Interfaces:**
- Produces: Store Info, Contact, Terms, Returns layouts; separate LAB control drawer for forcing states/failures/resetting demo.

- [ ] **Step 1:** Build restrained utility/legal layouts without marketing prose.
- [ ] **Step 2:** Build LAB panel separate from customer UI.
- [ ] **Step 3:** Add direct jump controls for owner testing.

### Task 10: Verification and handoff

- [ ] **Step 1:** Run `/mnt/data/issued-once-full-demo-check.py` and require PASS.
- [ ] **Step 2:** Scan artifact for forbidden marketing filler and external network calls.
- [ ] **Step 3:** Verify responsive CSS includes <=720px and <=380px behavior.
- [ ] **Step 4:** Verify reduced-motion path.
- [ ] **Step 5:** Provide direct sandbox link for owner testing.