# RentZilla

Punjab's #1 mobile rental marketplace built with Expo + Express + PostgreSQL.

## What it is

A full-stack mobile app where users can:
- **Rent**: Browse and book cars, agricultural equipment (tractors, harvesters, rotavators), and local services (plumbers, electricians, beauty)
- **List & Earn**: Providers post listings and manage bookings via dashboard
- **Chat**: Real-time messaging between customers and providers
- **Review**: Star ratings and written reviews after completed bookings
- **Favourites**: Save listings to a personal favourites list
- **Notifications**: In-app notification centre with unread badge
- **Ride-Booking (Cars tab)**: Uber-style ride booking with fare estimation, real-time status tracking, and a driver mode for providers
- **Wallet System**: Customer wallet (top-up via UPI/card/net banking, transaction history); Provider wallet (auto-credited on job completion after 15% platform commission, instant UPI payout, weekly payout scheduler, payout history)
- **Gold Membership**: One-time ₹2.49 lifetime purchase from wallet; 4% automatic discount on every booking; gold badge in wallet + profile; admin analytics dashboard with member count, revenue, savings given

- **Social Auth**: Google Sign-In (via expo-auth-session OAuth) and Apple Sign-In (iOS only, via expo-apple-authentication) with smart account linking and new-user profile completion flow

Punjab-specific UX: "Sat Sri Akal" greeting, INR (₹) pricing, Punjab India location context, Ludhiana/Amritsar/Patiala cities.

## Architecture

### Monorepo (pnpm workspaces)
- `artifacts/mobile` — Expo React Native app (web + iOS + Android)
- `artifacts/api-server` — Express 5 API server with Drizzle ORM
- `lib/db` — Shared PostgreSQL schema (Drizzle) + client
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-spec` — OpenAPI specification

### Database
- PostgreSQL (Replit-managed)
- Tables: `users`, `listings`, `bookings`, `reviews`, `chats`, `messages`, `notifications`, `favorites`, `driver_profiles`, `driver_status`, `driver_locations`, `otps`, `rides`, `blocked_users`, `reports`, `emergency_contacts`, `issues`, `otp_codes`, `provider_documents`
- Seed data: `pnpm --filter @workspace/api-server exec tsx src/seed.ts`

### Auth
- **Primary**: Email + password (bcryptjs, 10 rounds)
- **Secondary**: Phone-based (legacy, no OTP in MVP)
- Token: base64-encoded `userId:timestamp` stored in AsyncStorage
- Backend decodes token in `authMiddleware` in `artifacts/api-server/src/routes/users.ts`
- Unauthenticated users redirect to `/sign-in`

## Mobile App Structure

```
artifacts/mobile/app/
  _layout.tsx          — Root layout (fonts, providers, QueryClient)
  sign-in.tsx          — Email+password sign-in screen
  sign-up.tsx          — Full registration form (firstName, lastName, email, mobile, password, role, T&C)
  auth.tsx             — Legacy phone login screen
  (tabs)/
    _layout.tsx        — Classic Tab layout (Feather icons)
    index.tsx          — Home (listings, category pills, drawer trigger, notification bell)
    search.tsx         — Search with price filters
    bookings.tsx       — Booking history
    favorites.tsx      — Saved favourites list
    cars.tsx           — Cars tab: ride-booking (rider view) + driver panel (provider view)
    dashboard.tsx      — Provider dashboard (hidden for customers)
    messages.tsx       — Chat list
    profile.tsx        — User profile + edit
  listing/[id].tsx     — Listing detail + booking flow
  booking/[id].tsx     — Booking detail + review flow
  chat/[id].tsx        — Chat conversation
  add-listing.tsx      — New listing form (providers only)
  provider/[id].tsx    — Provider public profile

artifacts/mobile/components/
  SideDrawer.tsx       — Animated slide-in side drawer with menu + logout
  NotificationBell.tsx — Bell icon with unread badge + dropdown panel
  ListingCard.tsx      — Listing preview card
  CategoryPill.tsx     — Category filter pill
  StarRating.tsx       — Star rating display
  ErrorBoundary.tsx    — Error boundary wrapper
```

## API Routes

```
POST /api/auth/register    — Email + password sign-up
POST /api/auth/login       — Email + password OR phone login
POST /api/auth/logout      — Server-side logout

GET  /api/listings         — All listings (optional ?category= filter)
GET  /api/listings/:id     — Listing detail
POST /api/listings         — Create listing (provider auth required)
PUT  /api/listings/:id     — Update listing

GET  /api/bookings         — User's bookings
POST /api/bookings         — Create booking
GET  /api/bookings/:id     — Booking detail
PUT  /api/bookings/:id/status — Update status

GET  /api/notifications    — User's notifications
POST /api/notifications    — Create notification
PUT  /api/notifications/:id/read — Mark as read
PUT  /api/notifications/read-all — Mark all read

GET  /api/favorites        — User's favourite listings (enriched)
POST /api/favorites        — Toggle favourite (add/remove)
GET  /api/favorites/check/:listingId — Check if favourited

GET  /api/reviews/:listingId — Listing reviews
POST /api/reviews          — Submit review

GET  /api/chats            — User's chat threads
GET  /api/chats/:id        — Chat messages
POST /api/chats/:id/messages — Send message

PATCH /api/rides/driver/status    — Driver go online/offline
POST  /api/rides/driver/location  — Driver GPS update (every 4s)
GET   /api/rides/driver/requests  — Pending ride requests for driver
GET   /api/rides/driver/active    — Driver's active ride
POST  /api/rides/request          — Rider requests a ride
POST  /api/rides/estimate         — Get fare/distance/time estimate
GET   /api/rides/active           — Rider's active ride (with driver location)
PATCH /api/rides/:id/accept       — Driver accepts ride (atomic, prevents double-accept)
PATCH /api/rides/:id/start        — Driver starts trip
PATCH /api/rides/:id/end          — Driver ends trip
PATCH /api/rides/:id/cancel       — Rider cancels ride
GET   /api/rides/history          — Ride history for user
```

## Design System

- Primary: `#E8742A` (warm orange)
- Background: `#0F1F3D` (deep navy)
- Stars/Accent: `#F5C842` (gold)
- Font: Inter (400/500/600/700)
- Bottom tabs: Feather icons (6 tabs for providers, 5 for customers)

## Key Files

- `artifacts/api-server/src/routes/auth.ts` — Auth routes (email+password + phone)
- `artifacts/api-server/src/routes/bookings.ts` — Booking CRUD + state machine + idempotency + atomic complete-job
- `artifacts/api-server/src/lib/bookingStateMachine.ts` — validateTransition / transitionBooking (CAS UPDATE + audit log)
- `artifacts/api-server/src/routes/notifications.ts` — Notifications CRUD
- `artifacts/api-server/src/routes/favorites.ts` — Favorites toggle + list
- `artifacts/mobile/context/AuthContext.tsx` — Auth state (loginWithEmail, loginWithPhone, register, logout)
- `artifacts/mobile/app/listing/[id].tsx` — Listing detail + booking flow (PUNJAB_CITIES check, success banner)
- `artifacts/mobile/app/(tabs)/settings.tsx` — Settings screen (CORRECT file; NOT app/settings.tsx)
- `artifacts/mobile/components/SideDrawer.tsx` — Slide-in navigation drawer
- `artifacts/mobile/components/NotificationBell.tsx` — Notification bell + panel
- `lib/db/src/schema/` — All Drizzle table definitions

## Booking System Notes

- **Idempotency:** `POST /bookings` with `idempotencyKey` field stores key in `idempotency_keys` table. Replay returns the same booking with `_idempotent: true` (HTTP 200). Fix: ORM query used on replay path — NOT raw SQL (raw SQL produces snake_case keys that break `enrichBooking`).
- **State machine:** Only valid transitions allowed (see `TRANSITIONS` map in `bookingStateMachine.ts`). Invalid transitions return HTTP 422. Terminal state: `closed`. Every transition is audit-logged to `booking_transition_log`.
- **Role guards:** Only providers/admins can confirm bookings. Only admins can close/refund.
- **Atomic complete-job:** `PUT /bookings/:id` with `status: completed` runs customer debit + provider credit in a single SQL transaction with idempotency via `payment_event_logs`.

## Bug Fixes Applied (session Apr 10 2026)

| Fix | File(s) | Impact |
|-----|---------|--------|
| **NetworkGate** — was blocking UI on Android when `isInternetReachable===false` (carrier behaviour); now only blocks on `isConnected===false` | `components/NetworkGate.tsx` | Android users no longer see offline wall during normal browsing |
| **SMTP graceful degradation** — `sendMail` now in try-catch; SMTP `BadCredentials` no longer returns HTTP 500 for forgot-password | `api-server/src/lib/email.ts`, `routes/auth.ts` | `POST /api/auth/forgot-password` returns 200 even when email fails; OTP printed to server log |
| **Register name fix** — `buildUserResponse` now reads both `firstName`+`lastName` and returns computed `name` field | `api-server/src/routes/auth.ts` | New registrations return `name:"First Last"` not `null` |
| **API error logging** — Every failed API call logs method/path/status/body | `mobile/hooks/useApi.ts` | Easier production debugging |
| **Startup health check** — `_layout.tsx` logs API_BASE_URL and health check on launch | `mobile/app/_layout.tsx` | Confirms correct API target in logs |

### SMTP Status (action needed)
- `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`+`SMTP_PASS` secrets are set.
- Gmail rejects login with `535-5.7.8 BadCredentials` — the `SMTP_PASS` secret must be a **Gmail App Password** (not the regular account password).
- To fix: Google Account → Security → 2-Step Verification → App passwords → create one → update `SMTP_PASS` secret.
- OTPs are currently saved to the DB and printed to the server log so admins can manually relay them.

### Expo Version Warnings (non-blocking)
The Expo dev server shows these mismatches — app still runs:
- `@react-native-community/netinfo@12.0.1` (expected 11.4.1)
- `react-native-webview@13.16.1` (expected 13.15.0)
- `expo-apple-authentication@7.0.1` (expected ~8.0.8)
- `expo-auth-session@6.0.3` (expected ~7.0.10)

## Endpoint Health (last checked May 03 2026)
All 30 mobile-facing endpoints returning correctly (no 500s) — full test log in `.local/PLAYSTORE_SUBMISSION.md`.

## Google Play Store Readiness (May 03 2026)

### Changes Made for Play Store
| Fix | File | Detail |
|-----|------|--------|
| RECORD_AUDIO permission conflict removed | `app.json` | Was in both `permissions` and `blockedPermissions`; removed from `permissions` |
| Privacy Policy + Terms link on sign-in | `app/sign-in.tsx` | Required by Play Store; opens `https://rent-organizer.replit.app/privacy` and `/terms` |
| Version bump | `app.json` | 1.0.4 → 1.0.5, versionCode 12 → 13 |
| Promo type mismatch fixed | `api-server/routes/bookings.ts` | DB stores `"percentage"` but code checked `"percent"` — fixed in 3 locations |
| 2FA OTP no longer leaked | `routes/safety.ts`, `email.ts` | Real email sent via `send2FAEmail()`; code not returned in response body |
| OTP demo alert removed | `app/(tabs)/settings.tsx` | Shows "Check your inbox" instead |
| Coming soon items removed | `app/settings.tsx` | 2FA row, Emergency Contact "coming soon", FAQ/Terms/Privacy alerts all fixed |
| Privacy Policy on settings | `app/settings.tsx` | Terms/Privacy open real URLs; other items route to working tabs/settings screen |
| Console.log leaks removed | `app/_layout.tsx` | Two debug logs removed |
| Promo codes added to DB | DB | WELCOME10 (10%), RENT50 (₹50 flat), PUNJAB15 (15%) — all active |
| Test accounts created | DB | customer@rentzilla.in / Customer@123 and provider@rentzilla.in / Provider@123 |
| Provider listings assigned | DB | 3 active equipment listings assigned to provider test account |
| Wallet balances seeded | DB | Customer ₹500, Provider ₹1,200 |

### Play Store Submission Credentials
- Customer: customer@rentzilla.in / Customer@123 (₹500 wallet)
- Provider: provider@rentzilla.in / Provider@123 (₹1,200 wallet, 3 listings)
- Admin: admin@rentzilla.com / Admin@123

### Promo Codes
- WELCOME10 — 10% off (min ₹200)
- RENT50 — ₹50 flat off (min ₹300)
- PUNJAB15 — 15% off (min ₹500)

### Privacy Policy URL
`https://rent-organizer.replit.app/privacy`

### Build Command
`eas build --platform android --profile production`
