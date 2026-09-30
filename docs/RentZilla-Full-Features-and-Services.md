# RentZilla — Complete Features, Workflow, Dependencies & Services

*A rental marketplace for Punjab, India — rent cars, farm equipment (tractors, tools) and services (drivers, repairs) from your phone.*

Version: 24 (iOS build 20, Android versionCode 25) · Android package: `com.rentzilla.app`

---

## 1. The Platform at a Glance

RentZilla is made up of **three applications** working together:

| Part | Tech | Purpose |
|---|---|---|
| **Mobile App (RentZilla)** | Expo / React Native | What customers & providers use on their phones |
| **Admin Panel (RentZilla Admin)** | React + Vite web dashboard | Where the RentZilla team runs the platform |
| **API Server** | Node.js + Express | The brain — enforces all rules, prices & permissions |

Plus a shared **PostgreSQL database** (Drizzle ORM) as the single source of truth.

---

## 2. User Roles

- **Customer** — browses listings, books rentals (hourly/daily), pays via wallet or Razorpay, tracks bookings live.
- **Provider (Owner/Driver)** — lists cars/equipment/services, accepts or rejects requests, earns money, withdraws to bank/UPI.
- **Admin** — verifies KYC documents, sets pricing & commission, resolves disputes, monitors fraud.
- **Both** — one account can switch between Customer and Provider mode anytime.

---

## 3. Mobile App — Full Feature List

### Authentication & Onboarding
- Sign up / sign in with email & password, phone, **Google Sign-In**, and **Apple Sign-In**
- OTP-based forgot/reset password (via email)
- Complete-profile flow after social login (name, DOB, location)
- Role onboarding: become a customer / become a provider

### Main Tabs
- **Home** — hero banners, categories (Cars, Equipment, Services), featured & popular listings
- **Search** — smart universal search across everything
- **Cars** — dedicated vehicle rental tab with filters
- **Bookings** — active and past bookings in one place
- **Messages** — in-app chat inbox
- **Favorites** — saved listings
- **Wallet** — balance, transactions, Razorpay top-ups
- **Dashboard** (providers) — earnings, completed trips, online/offline status
- **Profile & Settings** — user info, language, notifications, privacy

### Booking & Listings
- Listing detail pages with photos, price, owner rating & availability
- Booking flow: **Hourly (time slots)** or **Daily** rental, add-on services (e.g. deep plowing), promo codes
- Live booking status tracking with map (trip navigation / driver live map)
- Providers: add / edit / manage their own listings

### Rides
- Real-time ride requests: providers "Go Online" to receive them
- Live pickup/drop-off tracking with driver location

### Money Features
- **Wallet** with full transaction history
- **Razorpay** payments: UPI, cards, wallet top-ups
- Escrow-style flow: platform holds money until the job completes
- **Provider payouts** — instant UPI payouts (flat fee) plus automatic weekly payouts

### Growth & Gamification
- **Gold Membership** — premium tier with benefits (better wheel odds, perks)
- **Wheel of Fortune** — daily free spin + paid spins, weighted rewards
- **Promo Vault** — stores won/earned discount codes
- **Referral system** — refer-a-friend with progress tracking & rewards

### Trust & Safety
- **Trust verification** — upload Aadhaar / driving licence / insurance documents
- Disputes — open, message & track a dispute for any booking
- Safety tools — emergency contacts, report users, blocking
- Support tickets from within the app

### Experience
- **Two languages**: English & Punjabi
- Custom **sound effects** for bookings, payments & provider alerts (with settings toggles)
- Push notifications (Expo Notifications) for booking updates & messages
- Haptics, blur effects, gradients, custom Inter font

---

## 4. Admin Panel — Full Feature List

- **Dashboard** — revenue, user growth, pending tasks, live activity feed
- **Users & Verification** — user management, KYC document approval/rejection
- **Listings** — moderate rental items
- **Bookings** — global view of all platform transactions
- **Disputes** — resolution center with threaded messages & refunds
- **Fraud Center** — fraud scores, suspicious activity monitoring
- **Pricing & Provider Prices** — commission rates, base fees, price references
- **Platform Wallet** — system funds & provider payout management
- **Gold / Wheel / Referral Analytics** — gamification & growth performance
- **Support Tickets & Reports** — user inquiries and safety reports
- **Admin Logs** — full audit trail of admin actions

---

## 5. API Server — Route Groups & Core Logic

| Route group | What it does |
|---|---|
| `/auth` | Register, login (email, Google, Apple), password reset OTPs |
| `/users` | Profiles, trust scores, account deletion |
| `/listings` | Create/read/update/delete listings, category filters |
| `/bookings` | Booking lifecycle **state machine** |
| `/payments` | Razorpay orders, verification & webhooks |
| `/wallet` | Transactions, top-ups, instant payouts |
| `/membership` | Gold membership purchase & status |
| `/wheel` | Spin logic, weighted rewards, balances |
| `/referral` | Codes, applications, reward tracking |
| `/disputes` | Threaded dispute messaging, admin resolution |
| `/provider` | Provider stats & price snapshots |
| `/rides` | Real-time rides, driver location |
| `/safety` | Emergency contacts, reports, blocking |
| `/support` | Tickets + email notifications |

**Booking lifecycle (enforced server-side):**
`pending → accepted → confirmed → started → in_progress → completed`
Prices and dates are re-checked on the server so nothing can be faked from the phone.

**Money flow:** Customer pays (wallet/Razorpay) → platform holds it (escrow) → on completion, amount minus commission goes to provider wallet → provider withdraws to UPI/bank (instant or auto weekly via payout scheduler).

---

## 6. Database (PostgreSQL + Drizzle ORM)

Key tables: `users`, `listings`, `bookings`, `wallet_transactions`, `payouts`, `gold_purchases`, `wheel_spins`, `promo_vault`, `referrals`, `referral_rewards`, `disputes`, `dispute_messages`, `provider_documents`, `rides`, `pricing_rules`, `admin_logs`.

---

## 7. External Services

| Service | Used for | Credentials |
|---|---|---|
| **Razorpay** | Payments, wallet top-ups, Gold purchases, paid spins, payouts, webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| **SMTP email (Nodemailer)** | OTP emails, password resets, support notifications | `SMTP_USER`, `SMTP_PASS` |
| **Google Maps / Places** | Address search, listing geolocation, live ride tracking | `GOOGLE_MAPS_API_KEY` |
| **Google OAuth** | "Sign in with Google" | via `@react-native-google-signin` |
| **Apple Sign-In** | "Sign in with Apple" (iOS requirement) | via `expo-apple-authentication` |
| **Expo Notifications / EAS** | Push notifications, cloud builds & updates | EAS project `975587e1-…-b1c34641c478` |
| **PostgreSQL** | All platform data | `DATABASE_URL` |
| Local uploads | Provider KYC documents served from `/uploads` | — |

---

## 8. Dependencies

### Mobile app (Expo SDK 54, React Native 0.81.5, React 19)
**Runtime:** expo, expo-av (audio), expo-updates (OTA updates), react-native-webview, @react-native-google-signin, async-storage, netinfo, expo-clipboard, expo-document-picker, expo-image-manipulator.
**Build/dev:** expo-router 6 (file-based navigation), @tanstack/react-query (data fetching), zod (validation), expo-location, expo-image-picker, expo-linear-gradient, expo-haptics, expo-blur, expo-font + Inter, expo-auth-session, expo-apple-authentication, react-native-reanimated, gesture-handler, safe-area-context, screens, svg, react-native-web, react compiler plugin, shared `@workspace/api-client-react`.

### API server
express 5, drizzle-orm, razorpay, nodemailer, bcryptjs (password hashing), multer (file uploads), cookie-parser, cors, pino + pino-http (logging), zod schemas via `@workspace/api-zod`, shared DB via `@workspace/db`. Built with esbuild, dev via tsx.

### Admin panel
React + Vite, wouter (routing), @tanstack/react-query, full **Radix UI / shadcn** component set, tailwindcss v4, recharts (charts), framer-motion, react-hook-form + zod, lucide-react icons, sonner toasts, date-fns.

### Shared / workspace
pnpm 9 monorepo with workspace packages: `@workspace/db` (drizzle + pg + drizzle-zod), `@workspace/api-zod`, `@workspace/api-client-react`. Root tools: sharp (image processing), jszip, prettier, typescript.

---

## 9. End-to-End Workflow (In Short)

1. **Customer** opens the mobile app → browses → picks an item → configures booking (hourly/daily + extras + promo) → pays.
2. **API server** validates everything, creates the booking as *pending*, holds the money.
3. **Provider** gets notified → accepts → booking is *confirmed* → job *starts* → live tracking → *completed*.
4. **Money** moves: platform keeps its commission, the rest lands in the provider's wallet → payout to UPI/bank.
5. **Admin** oversees it all: KYC, pricing, disputes, fraud, analytics, payouts.
