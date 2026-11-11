---
name: Secret refresh verification
description: Distinguish stale workspace environments from incorrectly saved payment credentials.
---

After a secure credential update, a shell or even a restarted app workflow may still reflect the workspace compute's previous environment. Do not repeatedly ask the user to resubmit credentials based solely on that observation.

**Why:** During Razorpay setup, repeated secure submissions were followed by test-mode results even after an API workflow restart. Official Replit documentation advises restarting compute to refresh workspace secret environments; production changes require republishing and may have separate overrides.

**How to apply:** If saved-secret presence and user evidence disagree with the loaded mode, ask for a workspace compute restart before drawing a conclusion about the saved pair. Verify only mode and read-only authentication status afterward, never print credentials. Treat deployment configuration separately.
