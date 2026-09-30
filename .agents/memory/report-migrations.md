---
name: Additive report migrations
description: Why report target columns must support legacy records during Publish.
---
Keep newly introduced report target IDs nullable for legacy records; enforce valid IDs for new reports at the API boundary.

**Why:** Publish uses the development schema, not a data-backfill script. Adding a required column without a default to populated reports triggered a truncation prompt. Startup migration code also restored the constraint after a successful schema push.

**How to apply:** Preserve existing report identities rather than forcing truncation or inventing target defaults. Verify the actual database after workflow reconciliation, not only the schema push result; check existing startup migration code for conflicting constraints.