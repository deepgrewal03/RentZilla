# RentZilla

Punjab's #1 mobile rental marketplace built with Expo + Express + PostgreSQL.

## What it is

A full-stack mobile app where users can:
- **Rent**: Browse and book cars, agricultural equipment (tractors, harvesters, rotavators), and local services (plumbers, electricians, beauty)
- **List & Earn**: Providers post listings and manage bookings via dashboard
- **Chat**: Real-time messaging between customers and providers
- **Review**: Star ratings and written reviews after completed bookings

Punjab-specific UX: "Sat Sri Akal" greeting, INR (₹) pricing, Punjab India location context, Ludhiana/Amritsar/Patiala cities.

## Architecture

### Monorepo (pnpm workspaces)
- `artifacts/mobile` — Expo React Native app (web + iOS + Android)
- `artifacts/api-server` — Express 5 API server with Drizzle ORM
- `lib/db` — Shared PostgreSQL schema (Drizzle) + client
- `lib/api-client-react` — Generated React Query hooks (from OpenAPI spec)
- `lib/api-spec` — OpenAPI specification

### Database
- PostgreSQL (Replit-managed)
- Tables: `users`, `listings`, `bookings`, `reviews`, `chats`, `messages`
- Schema push: `pnpm --filter @workspace/db run push`
- Seed data: `pnpm --filter @workspace/api-server exec tsx src/seed.ts`

### Auth
- Phone-based login (no OTP in MVP)
- Token: base64-encoded `userId:timestamp` stored in AsyncStorage
- Backend decodes token in `authMiddleware` in `artifacts/api-server/src/routes/users.ts`

## Mobile App Structure

```
artifacts/mobile/app/
  _layout.tsx          — Root layout (fonts, providers, QueryClient)
  auth.tsx             — Login/register screen
  (tabs)/
    _layout.tsx        — Classic Tab layout (Feather icons)
    index.tsx          — Home (listings browse, category pills)
    search.tsx         — Search with price filters
    bookings.tsx       — Booking history
    dashboard.tsx      — Provider dashboard (hidden for customers)
    messages.tsx       — Chat list
    profile.tsx        — User profile + edit
  listing/[id].tsx     — Listing detail + booking flow
  booking/[id].tsx     — Booking detail + review flow
  chat/[id].tsx        — Real-time chat screen
  add-listing.tsx      — Create listing modal (providers only)
  provider/[id].tsx    — Provider public profile
```

## Design
- **Primary**: Warm orange `#E8742A`
- **Brand background**: Deep navy `#0F1F3D`
- **Stars/gold**: `#F5C842`
- **Font**: Inter (400/500/600/700) via `@expo-google-fonts/inter`
- Colors defined in `artifacts/mobile/constants/colors.ts`

## Running

- **API Server**: `pnpm --filter @workspace/api-server run dev` → port 8080
- **Mobile app**: `pnpm --filter @workspace/mobile run dev` → Expo web + QR for native

## API Endpoints

- `POST /api/auth/login` — Phone + name + role login/register
- `GET/POST /api/listings` — Browse and create listings
- `GET/PUT/DELETE /api/listings/:id` — Listing CRUD
- `GET/POST /api/bookings` — Bookings list and create
- `GET/PUT /api/bookings/:id` — Booking detail and status update
- `GET/POST /api/reviews` — Reviews by listing or provider
- `GET /api/chats` — User's chat list
- `POST /api/chats/start` — Start a new chat
- `GET/POST /api/chats/:chatId/messages` — Chat messages
- `GET/PUT /api/users/me` — Current user profile
