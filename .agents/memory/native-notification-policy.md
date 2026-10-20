---
name: Native notification permission policy
description: User requires OS-only notification controls for RentZilla.
---

RentZilla must use iOS/Android notification authorization as the sole source of truth. Do not add master or per-category in-app notification switches. Settings should display live device authorization and link to native settings. Android categories belong in system notification channels, not custom switches.

**Why:** The user explicitly corrected this architecture and forbade a duplicate notification permission system.

**How to apply:** Request native permission only after an explicit Enable Notifications action following an explanation; never repeatedly prompt denied users. Refresh displayed status on screen focus and app resume. Preserve unrelated functionality and UI. Ordinary in-app audio preferences are not notification authorization.

Keep the legacy notification-preferences response object available to older installed clients, even though new clients use native settings only.

**Why:** Removing response fields before installed mobile versions retire can crash their Settings render despite a successful API response. Backend and app-store releases do not update together.

**How to apply:** Preserve read compatibility without re-enabling retired writes or treating legacy preferences as OS permission. Apply this compatibility check to future API field removals.
