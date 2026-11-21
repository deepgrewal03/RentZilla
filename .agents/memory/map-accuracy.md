---
name: Map accuracy
description: Address precision and road-route safety requirements for RentZilla.
---

Preserve Google's complete formatted address rather than rebuilding a shortened street/city label. Optional house, flat, or building details supplement the address but do not establish a verified coordinate or move the pin.

**Why:** The user requested complete address searches including house numbers. Google does not map every individual house; inventing precision would misdirect pickups.

**How to apply:** Keep exact-pin confirmation available and explain the distinction between written house details and mapped position.

Do not silently substitute straight-line distances for confirmed driving routes or use them to authorize ride booking/fare estimates.

**Why:** A plausible-looking distance can be substantially wrong for an actual road journey. Service failures must remain visible, not look like successful results.

**How to apply:** Fail explicitly when Google denies requests or cannot find a road route; test with failures as well as successful responses.

For equipment/service browsing, use the user's supplied Punjab district/town hierarchy rather than the older search-screen district fallback. Do not assign an ambiguous saved town to whichever district the customer selected.

**Why:** The user supplied the location list for this feature, and some towns occur under more than one district. Guessing would show listings in the wrong area.

**How to apply:** Keep unclear locations visible when no location filter is selected, but require a defensible saved-location match for filtered results. Preserve the original address.
