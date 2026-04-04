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
- `artifacts/api-server/src/routes/notifications.ts` — Notifications CRUD
- `artifacts/api-server/src/routes/favorites.ts` — Favorites toggle + list
- `artifacts/mobile/context/AuthContext.tsx` — Auth state (loginWithEmail, loginWithPhone, register, logout)
- `artifacts/mobile/components/SideDrawer.tsx` — Slide-in navigation drawer
- `artifacts/mobile/components/NotificationBell.tsx` — Notification bell + panel
- `lib/db/src/schema/` — All Drizzle table definitions
