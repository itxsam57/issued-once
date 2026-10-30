# ISSUED ONCE — Live Safepay sandbox journey verification

Date: 2026-10-30

Deployed release: `1f357bef2260d06142ea2b12af02931e80d28ee8`
Domain: `https://issuedonce.shop`
Purpose: verify the merchant-review journey using controlled sandbox data, **without a real financial transaction**.

## Direct live evidence (PASS)

- Fresh browser/customer completed seven different questionnaire slots: `POST /api/experience/answer` returned HTTP 200 seven times.
- Selected TEE / M / Bone: `/api/experience/object`, `/api/experience/size` and `/api/experience/base` returned HTTP 200.
- Contact challenge sent a **real** email to the merchant-controlled `support@issuedonce.shop` mailbox. Hostinger Mail received the message from `notify@issuedonce.shop` with subject `Your ISSUED ONCE code`; the real six-digit OTP was verified by `POST /api/contact/verify-otp` HTTP 200. No OTP value is stored in this report.
- Synthetic QA destination saved by `POST /api/shipping` HTTP 200. No production fulfillment was authorized.
- Customer commitment displayed TEE / M / Bone and **$32.00**, consistent with the production ACTIVE catalog.
- `POST /api/payments/create` returned **HTTP 200**. The resulting hosted checkout URL was checked in memory: hostname **sandbox.api.getsafepay.com**, environment **sandbox**; browser navigated to official **Safepay Checkout**.
- Without a completed payment, `GET /api/issue/status` returned HTTP 200 with `found: false`. The application did not falsely create a paid Issue.

## Incomplete evidence / blocker

- Hosted Safepay sandbox checkout loaded, showing order details and a `Pay $32.00` button. In the controlled headless-browser session, the button stayed **disabled**. The browser exposed contact email/phone inputs but no usable card-entry inputs. Attempts to click the disabled payment button did not submit a payment.
- The Safepay merchant sandbox dashboard redirected to a login screen. The session was not authenticated, so gateway configuration, enabled card methods and provider-side logs could **not** be inspected.
- Do **not** infer a product defect or a definitive provider root cause from this observation: a browser rendering limitation, merchant sandbox-method settings, or Safepay-hosted UI may all explain it. The app's checkout creation **did** succeed.
- Therefore **no successful sandbox card payment**, **no signed payment webhook confirmation**, **no canonical paid Issue**, and **no completed order confirmation** were proven. CR-06/07/08 and CR-28 remain incomplete under their existing evidence rules.
- Live Owner OS was separately opened and still requires the Owner key. Owner manual design, mixed-price publishing, referral creator journey and paid-Issue visibility remain unverified in this session.

## Safe next verification path

1. Sign in to the existing Safepay **sandbox** dashboard in the authenticated workstation browser. Check payment method availability and tracker records for the controlled QA attempts. Do not copy API secrets into the chat, logs or source control.
2. Complete a **sandbox-only** card transaction using a Safepay-documented test card. Confirm whether the Pay button becomes enabled with normal browser interaction and which checkout fields are available.
3. Verify signed webhook/Reporter truth, exact amount/currency, idempotency and one canonical Issue. Check customer return/status/confirmation and Owner Issues/Designer views. Browser return alone is never paid truth.
4. Recheck GitHub Actions support canary's reported Hostinger token mismatch under the existing owner-approved secret-sync process.
5. Owner must attest merchant address, policy/legal identity, delivery estimates, and refund timings before submitting the Safepay recording.

## Safety and outcome

- Actual Safepay production charge/refund: **none**.
- Sandbox card payment: **not completed**.
- Printful manufacturing confirmation: **off / not performed**.
- Actual customer shipment: **none**.
- Owner credentials, OTP, raw answers, address, provider tokens, and checkout query parameters: **not included**.
- Release/no-go decision for Safepay final screen-recording: **NO-GO** pending the provider payment completion and truthful merchant-policy attestation.
