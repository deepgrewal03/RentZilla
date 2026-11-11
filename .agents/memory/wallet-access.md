---
name: Wallet access policy
description: Customer and dual-role wallet access and safe collection/disbursement boundaries.
---

Customer-only users must have an Add Money wallet but must not see or use Instant Payout or Weekly Auto. Users who are also providers may have provider payout controls.

**Why:** The user explicitly requested this separation after customers were routed to an earnings screen with no Add Money action.

**How to apply:** Enforce provider eligibility on the server as well as in navigation; don't use the active UI mode alone as proof of provider eligibility.

Do not equate Razorpay payment-gateway integration with provider bank payouts, or locally stored payment references with gateway-authorized reusable tokens.

**Why:** Gateway collections do not send funds to provider bank accounts. Local ledger changes without a disbursement integration can remove wallet funds without paying anyone.

**How to apply:** Keep unsupported payouts fail-closed without deducting balances. Clearly describe any checkout selection requiring gateway re-entry/authentication.
