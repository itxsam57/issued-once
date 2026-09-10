# ISSUED ONCE Strix Hard-Mode Rules of Engagement

Authorized defensive assessment. Scope is only the checked-out ISSUED ONCE source tree at the pinned commit.

## Hard scope boundary
- Do not attack, probe, crawl, fuzz, enumerate, or send crafted requests to any external hostname or IP.
- Do not contact Safepay, Printful, Resend, Hostinger, Neon, GitHub APIs, Gmail, OpenAI, or any other provider from security tools.
- Do not create payments, refunds, manufacturing orders, emails, DNS changes, deployments, or production data.
- Do not use or exfiltrate credentials, tokens, or secrets from git history or files.
- The Docker sandbox has no outbound internet by design. Treat network failures to external hosts as intentional scope enforcement.

## Required attack coverage
Prioritize reproducible application vulnerabilities: broken auth/BOLA/IDOR, broken function-level authorization, session fixation/rotation flaws, CSRF, XSS, injection, SSRF primitives, open redirects and host-header/origin trust, webhook signature bypass/replay/idempotency, OTP enumeration/rate-limit bypass, race/TOCTOU/stale-response cross-record leaks, file-upload/parser abuse, cache/privacy leaks, mass assignment, path traversal, business-logic/payment-state bypass, refund state corruption, and cross-customer data exposure.

Use white-box source evidence plus working local PoCs where possible. A suspicion without a reproducible PoC is not a validated vulnerability. Report exact file/line and exploit preconditions. Do not auto-fix source code.
