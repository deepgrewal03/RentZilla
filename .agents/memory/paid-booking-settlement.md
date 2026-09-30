---
name: Paid booking settlement
description: The collection and payout boundary for Razorpay-funded bookings and later provider charges.
---

For a Razorpay-paid booking, verified capture is the single customer collection event. Job completion may release the provider earning and retain platform commission, but it must never debit the customer wallet for the same booked amount.

**Why:** Treating completion as another customer charge creates a double-payment risk and can also block a legitimately prepaid job when the customer wallet is empty.

An external checkout order is only an intent. Unpaid bookings remain cancellable; if a payment is captured after cancellation, persist it as refund-pending and reconcile a full provider-confirmed refund before closing the local state.

**Why:** Webhook delays and crashes can put local booking state behind Razorpay. Treating a missing or cancelled local target as a generic verification failure can strand collected customer funds.

**How to apply:** Serialize booking/order transitions, recover orphan captures from trusted provider metadata, retry refund-pending records in the background, and handle provider-added post-payment charges through a separate customer-approved payment rather than mutating the paid invoice.