# RentZilla — Google Play Store Deployment Guide

## App Details
| Field | Value |
|---|---|
| App Name | RentZilla |
| Package | `com.rentzilla.myapp` |
| Version | 1.0.0 |
| API Server | https://rent-organizer.replit.app |
| Build Tool | EAS (Expo Application Services) |
| Node Version | 20.19.0 |
| pnpm Version | 9.15.0 |

---

## STEP 1 — One-time Setup (do once)

Open **Replit Shell** and run:

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in with your Expo account (free at expo.dev)
eas login

# Move into the mobile project folder
cd artifacts/mobile
```

---

## STEP 2 — Test Build (APK for your phone)

Before uploading to Play Store, install and test on your phone:

```bash
cd artifacts/mobile
eas build --platform android --profile preview
```

- EAS uploads your code to Expo's cloud servers
- Builds a `.apk` file (takes ~5–10 min)
- Download the APK from the link it prints
- Install on your Android phone and test:
  - Sign up / Sign in
  - Browse listings
  - Book a service
  - Wallet & payments
  - Gold Membership (₹2.49/year)
  - Wheel of Fortune
  - Refer a Friend
  - Provider dashboard
  - Google Maps (Cars tab)
  - Push notifications

---

## STEP 3 — Production Build (AAB for Play Store)

Once testing is done:

```bash
cd artifacts/mobile
eas build --platform android --profile production
```

- Builds a `.aab` (Android App Bundle) — required by Google Play
- Takes ~10–15 min
- Download the `.aab` from the Expo dashboard link

---

## STEP 4 — Google Play Console Setup

1. Go to [https://play.google.com/console](https://play.google.com/console)
2. Pay the one-time $25 developer fee (if not done)
3. Click **Create App**

Fill in:
| Field | Value |
|---|---|
| App name | RentZilla |
| Default language | English (India) |
| App or game | App |
| Free or paid | Free |

---

## STEP 5 — Store Listing (required before upload)

### Short description (max 80 chars)
```
Punjab's #1 rental marketplace — equipment, cars & services
```

### Full description (max 4000 chars)
```
RentZilla is Punjab's trusted rental marketplace connecting customers 
with equipment providers, car owners, and service professionals.

FEATURES:
• Browse and book tractors, harvesters, JCBs, and farm equipment
• Rent cars with Google Maps integration
• Real-time chat with providers
• Secure wallet with ₹INR payments
• Gold Membership — 4% off every booking at just ₹2.49/year
• Wheel of Fortune daily spin for discount rewards
• Refer a Friend — earn 10% off after 5 referrals
• Document verification for trusted providers
• Provider dashboard with earnings tracking
• Push notifications for booking updates
• AES-256-GCM encrypted payment methods
• 15% platform commission marketplace model

Available in English and Punjabi (ਪੰਜਾਬੀ).
```

### Screenshots needed (minimum 2, recommended 8)
Take screenshots of:
1. Home screen (listings)
2. Booking flow
3. Gold Membership screen
4. Wheel of Fortune
5. Provider Dashboard
6. Wallet screen
7. Refer a Friend screen
8. Cars + Google Maps

---

## STEP 6 — Upload the AAB

1. Go to **Testing → Internal testing → Create new release**
2. Click **Upload** and select your `.aab` file
3. Add release notes:
   ```
   Initial release of RentZilla — Punjab's rental marketplace
   ```
4. Click **Save → Review release → Start rollout**

---

## STEP 7 — Required Declarations

Google will ask you to complete these before going live:

### Privacy Policy (REQUIRED)
Create a privacy policy page. Free generator: https://privacypolicygenerator.info  
Host it at: `https://rent-organizer.replit.app/privacy`

### Permissions Justification
You will need to explain why the app uses:

| Permission | Reason |
|---|---|
| CAMERA | Profile photo upload |
| LOCATION | Google Maps for Cars tab |
| NOTIFICATIONS | Booking status updates |
| INTERNET | API calls to rent-organizer.replit.app |
| READ_MEDIA_IMAGES | Profile picture selection |

### Financial Features Declaration
Because RentZilla has wallet, payments, and earnings:
- Declare it as a **marketplace app**
- Select category: **Lifestyle → Rental & Hiring**
- Mark that the app handles **in-app financial transactions**

---

## STEP 8 — Release Track Order (Recommended)

To avoid rejection, go in this order:

```
Internal Testing (you + 5 testers)
        ↓
Closed Testing (20–50 users, 2 weeks)
        ↓
Production (everyone)
```

---

## Version Update Process (future releases)

After making code changes:

```bash
cd artifacts/mobile
# eas.json has autoIncrement: true — version bumps automatically
eas build --platform android --profile production
```

Then upload the new `.aab` to Play Console → Production → Create new release.

---

## Common Issues

| Problem | Fix |
|---|---|
| Build fails with "node version" | eas.json already sets `"node": "20.19.0"` |
| "Package name already taken" | `com.rentzilla.myapp` is yours — just log in to the right Google account |
| Maps not showing | Ensure `GOOGLE_MAPS_API_KEY` is set in Replit Secrets |
| Notifications not working | Add `google-services.json` from Firebase Console to `artifacts/mobile/` |
| App rejected for payments | Add privacy policy URL and financial transactions disclosure |
