# ISSUED ONCE — Design Control + Manual Production Design Design

Date: 2026-08-21
Status: OWNER APPROVED
Branch: `feat/mystery-foundation`

## Goal

Make the complete paid-Issue design workflow operable in automatic, manual, or hybrid mode from Owner OS, with global defaults and per-Issue overrides, auditable raw-answer reveal, manual artwork upload, AI candidate generation/regeneration with feedback, owner approval/rejection, and configurable manufacturing handoff while preserving a safe manual production-charge default.

## Core policy model

Nothing important is hardcoded. Owner OS stores versioned global defaults and permits a per-Issue override.

Design mode values:

- `AUTO`: AI design worker may create candidates automatically when provider runtime is ready.
- `MANUAL`: no AI generation is required; paid Issues wait for owner/manual artwork.
- `HYBRID`: AI may generate candidates, while manual upload/replacement remains available.

Additional configurable policies:

- `approvalRequired`: whether artwork must receive explicit owner approval before manufacturing draft eligibility.
- `rejectBehavior`: `AUTO_REGENERATE` or `WAIT_FOR_OWNER`.
- `manualUploadApproval`: `REQUIRE_APPROVAL` or `AUTO_APPROVE`.
- `answerRevealDefault`: launch-safe default `HIDDEN_UNTIL_REVEALED`; optional `VISIBLE` global mode with per-Issue override.
- `manufacturingHandoff`: launch-safe default `WAIT_FOR_OWNER`; optional `AUTO_CREATE_DRAFT_AFTER_APPROVAL`.
- `factoryConfirmation`: launch-safe default `WAIT_FOR_OWNER`; the existing environment kill switch remains an independent mandatory production safety boundary even if future policy allows automation.

Global changes affect future processing decisions, not already-frozen artwork/manufacturing truth. Per-Issue overrides are auditable and take precedence over global defaults.

## Paid-Issue behavior

A signed paid payment event still reserves exactly one Issue. Design dispatch becomes policy-aware:

- AUTO/HYBRID with valid OpenAI + Blob runtime: enqueue AI design work.
- AUTO/HYBRID without design-provider runtime: keep the Issue safely actionable in Owner OS; do not mark the commercial order failed merely because AI is unavailable.
- MANUAL: do not enqueue AI generation; expose the Issue in Designer as awaiting manual work.

Manual processing must allow an Issue to move from paid/received into the existing design-review/approval lifecycle without an OpenAI API key.

## Raw-answer reveal

Raw questionnaire answers remain encrypted at rest.

Safe default behavior:

- Owner OS shows question metadata/prompts but masks raw answers.
- Owner must click `REVEAL ANSWERS` for the Issue to decrypt/show them.
- Every reveal records actor, Issue ID, timestamp, reason/context, and safe metadata in Owner OS audit.
- Per-Issue policy may override the global reveal behavior.
- No raw answers enter audit metadata, logs, URLs, provider metadata, or candidate safe summaries.

The automatic design worker can continue decrypting answers through its existing privileged server-side path without making them visible in Owner OS.

## Candidate history

Every AI-generated or manually uploaded artwork is a candidate/version. Candidate sources expand to include:

- `AUTOMATIC`
- `OWNER_REGENERATE`
- `OWNER_REINTERPRET`
- `OWNER_UPLOAD`

Candidate history preserves:

- candidate ID
- generation key/version
- source
- optional encrypted design brief
- artwork storage reference
- MIME type/byte count/dimensions
- provider/model or `MANUAL` provenance
- optional safe summary
- selected state
- created timestamp
- review decision metadata through audit/events

Only one candidate can be selected for an Issue at a time.

## Manual artwork upload

Owner OS Designer provides `UPLOAD ARTWORK` even when OpenAI is absent.

Requirements:

- owner-authenticated route only
- PNG production artwork in the first version; validation remains compatible with the existing artwork quality gate
- strict byte-size and dimension bounds
- private Vercel Blob storage
- Issue/design-job binding before candidate creation
- candidate source `OWNER_UPLOAD`
- optional auto-approval according to effective policy
- otherwise transition to normal `REVIEW`

Uploading a new candidate must never silently overwrite candidate history.

## AI generation and feedback-aware rejection

Existing AI generation remains available when configured.

Owner may reject using:

- quick reason codes such as `TOO_BUSY`, `TOO_LITERAL`, `WEAK_CONCEPT`, `WRONG_MOOD`, `TYPOGRAPHY`, `PLACEMENT`, `NOT_WEARABLE`, `OTHER`
- optional custom instruction text

The rejection record is audited. For regeneration/reinterpretation, the custom instruction plus normalized reason codes are injected into the next private design brief/generation request, without changing the original seven customer answers.

Effective reject policy decides whether rejection automatically enqueues the next generation or waits for the owner to click `REGENERATE`/`REINTERPRET`.

## Approval behavior

When `approvalRequired=true`, manufacturing cannot use artwork until the selected candidate has passed the existing production quality gate and explicit Owner OS approval.

When `approvalRequired=false`, a successfully generated/uploaded candidate may become approved automatically only through the same server-side quality gate; bypassing quality validation is never permitted.

Manual-upload auto-approval still runs the production quality gate.

Owner can always override an individual Issue back to manual review before manufacturing begins.

## Manufacturing handoff

Approval and production charge remain separate boundaries.

Launch-safe default:

1. candidate selected
2. candidate approved
3. Owner OS displays `SEND TO MANUFACTURING`
4. owner action creates/reconciles one unconfirmed Printful draft
5. Printful file readiness is verified
6. owner separately types the existing exact Issue confirmation phrase while the independent `PRINTFUL_ALLOW_CONFIRM=true` kill switch is armed
7. provider confirmation must return exact order ID and `pending`

If `manufacturingHandoff=AUTO_CREATE_DRAFT_AFTER_APPROVAL`, approval may enqueue/create only the unconfirmed draft. It must never bypass the production-charge safety gate.

`factoryConfirmation` may be represented as a configurable policy for future operation, but production confirmation still requires the independent environment kill switch, owner authentication, last-moment state reload, valid selected approved artwork, remote Printful draft/file readiness, and exact Issue confirmation phrase. The policy alone can never charge Printful.

## Owner OS Designer UX

Global Design Settings:

- Design mode selector: AUTO / MANUAL / HYBRID
- Approval required toggle
- Reject behavior selector
- Manual upload approval selector
- Answer reveal default selector
- Manufacturing handoff selector
- Factory confirmation policy display/control with prominent kill-switch status

Per-Issue Designer:

- effective policy summary and override controls
- masked/revealed questionnaire section
- `REVEAL ANSWERS` audited action
- current candidate large preview
- candidate/version history
- `UPLOAD ARTWORK`
- `APPROVE`
- `REJECT`
- quick reject reason controls
- custom feedback/instruction field
- `REGENERATE`
- `REINTERPRET`
- `SELECT CANDIDATE`
- `SEND TO MANUFACTURING` when eligible
- clear display of AI runtime unavailable vs manual workflow ready

## Failure behavior

- Missing OpenAI API never blocks manual design mode.
- Missing Blob runtime blocks both AI persistence and manual artwork upload, and Owner OS must show the exact readiness problem.
- Rejection never deletes candidate history.
- Regeneration cannot proceed after manufacturing has started.
- Manual upload cannot proceed after manufacturing has started.
- Candidate selection/approval is idempotent and forbidden once provider manufacturing state makes replacement unsafe.
- Refund/cancel races keep existing fail-closed payment/manufacturing protections.

## Acceptance criteria

1. Global AUTO/MANUAL/HYBRID mode is editable and audited.
2. Any Issue can override the global policy.
3. MANUAL mode produces a usable Designer queue item without OpenAI.
4. Answers are hidden by default and reveal is audited.
5. Manual PNG upload creates a private candidate/version and survives refresh.
6. Manual upload may require approval or auto-approve according to effective policy, but always runs quality validation.
7. AI candidate generation remains functional when configured.
8. Reject captures quick reasons + optional instructions.
9. Auto-regenerate and wait-for-owner modes both work.
10. Candidate history is preserved across regeneration, reinterpretation, upload, selection, and approval.
11. Manufacturing consumes only the selected eligible artwork.
12. Approval may auto-create only a Printful draft when configured; launch default waits for owner.
13. No configuration can bypass the independent production kill switch and exact owner confirmation phrase.
14. Owner OS/browser tests cover desktop and mobile interaction states.
