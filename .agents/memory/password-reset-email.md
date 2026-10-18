---
name: Password-reset email provider
description: Why password-reset delivery uses connected Gmail rather than SMTP.
---

Keep Gmail as the password-reset email provider, using the connected Google authorization rather than reverting to SMTP.

**Why:** The user chose to keep Gmail instead of switching to Resend. SMTP authentication repeatedly returned 535, including after an App Password replacement, whitespace normalization, and the user's Google security review. The user then authorized the Gmail connection.

**How to apply:** Troubleshoot connector authorization for reset delivery rather than repeating SMTP credential requests. A healthy connection is not proof of delivered mail; obtain confirmation for a real test recipient before sending. Never automatically retry a Gmail send with an uncertain result.
