# WAY

Connect to anyone, anywhere — search by device location ("Nearby"), street
address, or a named place on the map, filtered by category/interest.

This repo is a monorepo with two projects:

- `backend/` — Node.js (TypeScript) + Fastify + PostgreSQL/PostGIS API
- `mobile/` — React Native (Expo, Expo Router) app, iOS + Android from one codebase

## What's built (MVP)

- **Sign up / sign in** by phone or email, verified with a 6-digit code (feature 1)
- **Multiple profiles per account**, 2 free, each with its own WAY-ID ("what's your WAY?"), display name, category tags (feature 2)
- **Three search modes** — Nearby (device GPS), Address (geocoded street address), Location (place/city/state/country name or map point) (feature 3)
- **Radar / list / grid** result views with a toggle, ordered by distance, radar showing direction + distance (feature 3)
- Tapping a result opens a **mini-profile** with distance, category, visibility text, and a **Send WAY Request** button carrying text/photo/a camera-capped 5-second video (features 2, 13)
- Per-profile **visibility toggle** or "hidden" (feature 4, top-level only — per-search-mode visibility toggles exist on the API but don't have a settings screen yet)
- Server-side support for **remote/override location** (feature 5) via the profile location API
- **Timeline/feed** — text, photo, and video posts with like/comment/share/view counts, a global reverse-chronological feed, and a per-profile grid (like an Instagram profile page)
- **Auto-scroll** via the **WAY Button** — a transparent, teal-ringed floating control on the right-middle edge of the Feed screen; tap it for 3 speed options (slow/medium/fast), tap again to stop. Built as a standalone component so it's easy to promote to an app-wide overlay with more assigned functions later
- A small **local file-upload endpoint** (`POST /uploads`) backs both post media and WAY Request attachments — see the storage caveat below
- **Wallet** — multi-currency balances (USD/NGN/EUR/GBP), sending funds to another WAY by ID, a general transaction history, and a history filtered to one specific person. Purchases-within-the-app will reuse this same transfer primitive once there's something to buy. **Card funding is real for NGN** via Paystack's hosted checkout (see caveat below) — other currencies still use a simulated instant credit
- **Going live** (feature 15) — schedule or start a broadcast, a "Live Now" rail on the Feed, a real viewer count, real live chat, and a real push notification to followers when you go live or schedule one. The video transport itself is stubbed — viewers get a placeholder, not your camera feed — see caveat below
- A minimal **follow graph** (follow/unfollow, a Follow button on the search mini-profile) — added specifically so "notify my followers" has someone real to notify; profile follower/following counts are now live instead of static
- **Remote camera/mic access** (feature 16) — request another profile's camera from their mini-profile; nothing happens until they explicitly accept (a "Request Camera Access" button on the mini-profile, a review screen naming exactly who's asking and why, and a push notification), either party can end an active session, and the request/session detail endpoints are restricted to the two people involved. Video transport is stubbed the same way as Going Live — see caveat below

## Not built yet (from the full spec)

Crypto funding, real live video transport, followers/subscribers/one-time-
access tiers, and video editing/cropping tools beyond the request flow's
5-second camera cap. These are substantial features best scoped as their
own follow-ups.

## Prerequisites

- Node.js 20+
- A PostgreSQL database with the [PostGIS](https://postgis.net) extension available (`CREATE EXTENSION postgis;` is run by the first migration)
- Xcode (iOS Simulator) and/or Android Studio, or the Expo Go app on a physical phone
- A Google Maps API key with the **Geocoding API** enabled, for Address/Location search (optional for Nearby-only testing)

## Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, GOOGLE_MAPS_API_KEY
npm install
npm run prisma:migrate # applies prisma/migrations against your database
npm run dev             # starts the API on http://localhost:4000
```

Without `TWILIO_*` / `SENDGRID_*` credentials set, OTP codes are logged to the
server console and echoed back in the `/auth/request-otp` response
(`devCode`) so the app is fully testable without SMS/email infrastructure.

Uploaded media (post photos/videos, WAY Request attachments) is written to
`backend/uploads/` and served back from the same host. That's fine for local
dev and a single-server deploy, but it won't survive redeploys or scale past
one instance — swap `src/routes/uploads.ts` for S3/Cloudinary/R2 before
shipping.

Card funding (`POST /wallet/fund` with `method: "card"`) is real for NGN via
[Paystack](https://paystack.com)'s hosted checkout — set `PAYSTACK_SECRET_KEY`
in `.env` (a **test** secret key from your Paystack dashboard is fine and
recommended while developing) and it activates automatically; leave it unset
and NGN funding falls back to the same instant simulated credit every other
currency still uses (see `PAYSTACK_SUPPORTED_CURRENCIES` in
`src/lib/paystack.ts` — Paystack accounts are approved for specific
currencies by business country, so this stays NGN-only until there's a
reason to widen it). The flow: the backend calls Paystack's Initialize
Transaction API and hands the mobile app a checkout URL; the app opens it via
`expo-web-browser`, Paystack redirects back to the app's `way://` scheme on
completion, and the app then calls `POST /wallet/fund/verify` — which
independently re-checks the payment with Paystack's server-to-server Verify
API before crediting anything. **The redirect itself is never trusted as
proof of payment; only that server-to-server verify is.** No card details
ever touch this backend — Paystack's checkout page collects them directly,
so there's nothing PCI-sensitive here. `method: "crypto"` still returns a
501 placeholder for whichever on/off-ramp gets picked later. Transfers
between wallets and the balance ledger itself have been real since the
wallet was first built — this pass only replaced the funding *source* for
NGN.

Live video (both the Going Live broadcast and remote camera/mic sessions) is
scheduling/consent + presence + chat, not actual video — real streaming
needs a WebRTC SDK (LiveKit, Agora, etc.), which also means switching the
mobile app off Expo Go onto a native development build (`react-native-webrtc`
requires native code). Push notifications use Expo's free push API directly
(no API key needed server-side), but the *device* needs an EAS project id to
mint a real token — see the mobile section below.

Every route that touches someone else's private data (their transaction
history, their scheduled broadcasts, a camera request's message) checks
ownership via `assertOwnsProfile` in `src/lib/auth.ts` — a shared helper as
of this pass, after two earlier features shipped with that check missing on
one endpoint each because it was being copy-pasted per file. If you add a
new route that takes a `profileId`, use that helper rather than writing the
check inline.

## Mobile

```bash
cd mobile
npm install
npx expo start
```

Edit `src/api/config.ts` (or set `EXPO_PUBLIC_API_URL`) to point at your
backend — `localhost` works for the iOS Simulator, but a physical device or
Android emulator needs your machine's LAN IP.

The real WAY logo, app icon, and brand colors (from `Way Brand Guide.pdf`) are
wired in — deep teal `#0A4554` primary, `#2F6F7C` secondary, `#E6B655` gold /
`#F26A5B` coral accents, and the Gabarito headline typeface.

The Paystack checkout redirect relies on the app's `way://` URL scheme
(already set in `app.json`) — no extra setup needed on the mobile side for
that to work.

Push notification tokens won't register without an EAS project: run `eas
init` (needs a free Expo account) to get a `projectId`, then it's picked up
automatically from `app.json`'s `extra.eas.projectId`. Without it — or in
Expo Go on SDK 53+, which dropped remote push support entirely, or on a
simulator/emulator — push registration fails silently and the rest of the
app keeps working normally; you'll just need a real development build on a
physical device to see a notification land.

## Project conventions

- Mobile routes are file-based under `mobile/src/app/` (Expo Router) — see `mobile/AGENTS.md`.
- Backend routes live in `backend/src/routes/`, one file per resource; shared logic (DB client, geo queries, auth) is in `backend/src/lib/`.
