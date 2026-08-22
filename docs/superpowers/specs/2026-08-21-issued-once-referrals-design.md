# ISSUED ONCE — Creator Referrals Design

Date: 2026-08-21
Status: OWNER APPROVED
Branch: `feat/mystery-foundation`

## Goal

Add a native creator referral system that can attribute visits and coupon codes, apply customer discounts before the immutable checkout quote is frozen, count only server-verified paid sales, maintain creator reward balances, email creators when qualified sales occur, and support manual payouts without hardcoding creator economics or payout details.

## Principles

- Referral economics are configurable in Owner OS; no creator percentages, discounts, thresholds, or payout cadence are hardcoded.
- Browser redirects never create referral credit. A referral conversion exists only after authenticated provider payment truth marks the payment attempt paid.
- One order may have at most one referral attribution. Discount stacking is not supported in the first version.
- Existing quotes, payment attempts, Issues, and referral earnings remain immutable snapshots when future referral settings change.
- Questionnaire answers, customer email, shipping data, and creator payout details never enter public referral URLs or provider metadata.
- Creator notifications disclose sale/reward/balance facts but no buyer identity or private questionnaire content.
- Refunds/reversals must reverse creator earnings idempotently.

## Creator configuration

Owner OS can create, edit, pause, and inspect creators with:

- creator display name
- creator email
- unique referral code
- generated referral URL `/r/<code>`
- customer discount mode: `PERCENT` or `FIXED`
- customer discount value
- creator reward mode: `PERCENT` or `FIXED`
- creator reward value
- payout cadence: `MONTHLY` or `THRESHOLD`
- threshold amount when cadence is `THRESHOLD`
- attribution window in days
- active/paused status

The creator email is private operational data and is encrypted at rest. A normalized one-way email hash may be stored for self-referral detection and lookup.

## Attribution

A visitor may arrive through `/r/<code>`. The server validates the active code and stores an opaque referral-attribution cookie containing only a signed attribution identifier, never creator email or payout information.

At the commitment/payment stage the customer may also enter a referral/coupon code manually. A valid explicit code replaces an earlier link attribution before the final discounted quote is created. Once checkout starts, referral attribution is frozen for that payment attempt.

Self-referrals are blocked when the verified customer email hash matches the creator email hash. Invalid, paused, expired, or self-referral codes do not alter the quote.

## Discount truth

The canonical product catalog remains the gross retail-price source. Referral discount application occurs server-side before the quote is frozen.

A referral-aware quote snapshot records:

- gross amount
- discount amount
- final payable amount
- currency
- referral attribution ID
- creator ID
- referral-code version/rules snapshot

The final payable amount must remain positive and within owner-configured discount bounds. Safepay receives only the final frozen payment amount and opaque payment identifiers.

## Conversion and balance ledger

A signed provider `PAID` event creates at most one referral conversion for the paid payment attempt.

The conversion snapshots:

- creator ID
- referral code/rule version
- payment attempt ID
- Issue ID once reserved
- gross amount
- discount amount
- paid amount
- reward amount
- currency
- conversion timestamp
- state

Reward states:

- `PENDING`: paid sale exists but is not yet eligible for payout
- `AVAILABLE`: fulfillment has reached the configured safe eligibility point; launch default is delivered without refund
- `REVERSED`: corresponding payment was refunded/reversed
- `PAID_OUT`: included in a completed creator payout

The ledger is append-safe/idempotent; duplicate Safepay events, queue retries, and duplicate fulfillment events must not double-count a sale or reward.

## Creator email notification

After a new paid referral conversion is successfully recorded, enqueue one idempotent creator notification. The message communicates that someone bought through the creator's link/code and states the reward from this sale plus current pending/available balance. It contains no customer identity, shipping data, questionnaire answers, or artwork.

A refund/reversal may send a concise balance-adjustment notification.

## Manual payouts

The first version does not automate bank/card/wallet transfers.

When a creator is eligible by monthly cadence or threshold, Owner OS shows the payable balance. The creator can submit payout details through a private, tokenized payout-request path. Payout details are encrypted with the existing private-payload encryption boundary and never stored in plaintext columns.

Owner OS can:

- list payout requests
- reveal payout details through an explicit audited owner action
- record payout amount and transfer/reference text
- mark a payout `PAID`
- clear or retire payout details after settlement

A payout cannot include `PENDING`, `REVERSED`, or already-paid rewards.

## Owner OS

Add a `REFERRALS` section with:

- creator create/edit/pause
- copy referral link/code
- discount/reward/cadence controls
- conversion counts and gross/net referred sales
- pending, available, reversed, and paid balances
- referral conversion ledger
- payout request queue and settlement action
- refund/reversal visibility

All creator configuration changes and payout actions are Owner OS audited.

## Failure and abuse controls

- unique normalized referral codes
- signed attribution cookie
- server-side discount calculation
- one referral attribution per frozen quote/payment attempt
- self-referral protection using hashed verified email identity
- no credit until signed payment truth
- no duplicate conversion for provider replay
- refund reverses the matching reward exactly once
- payout amount cannot exceed available ledger balance
- creator payout details encrypted at rest and revealed only through audited owner action
- paused creator codes cannot create new discounted quotes

## Acceptance criteria

1. Active creator link attribution survives the public flow without exposing creator private data.
2. Manual referral code can replace link attribution before checkout.
3. Invalid/paused/self-referral codes cannot reduce price.
4. Discount is computed server-side and frozen in the quote/payment snapshot.
5. Safepay signed `PAID` creates exactly one conversion/reward.
6. Duplicate payment webhook does not create a duplicate conversion or email.
7. Refund reverses reward exactly once.
8. Creator receives an idempotent sale notification with no buyer PII.
9. Owner OS shows creator rules, sales, balances, and payout readiness.
10. Payout details are encrypted and reveal is audited.
11. Manual payout settlement moves only available earnings to paid-out state.
12. Existing non-referral orders continue unchanged.
