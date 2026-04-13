# ALL ACCESS by TakersLifestyle — Project Memory

## What this is
Premium paid membership platform at **allaccesswinnipeg.ca**  
Stack: Next.js 16 App Router · Firebase Auth + Firestore · Stripe · Resend · Vercel  
Monorepo: `web/` (Next.js), `functions/` (Cloud Functions), `firestore.rules`

---

## Key URLs
- Production: https://allaccesswinnipeg.ca
- GitHub: https://github.com/TakersLifestyle/all-access-os
- Firebase project: `studio-4850154113-14e56`
- Vercel: auto-deploys on push to `main`

---

## Auth & Membership Model
- Firebase Auth with **custom claims**: `{ role: "admin"|"member", status: "active"|"inactive"|"past_due"|"cancelled" }`
- Claims set by Stripe webhook — zero Firestore reads in security rules
- `isActive` = `status === "active"` OR `role === "admin"`
- Admin account: `tharealprincecharles@gmail.com` — claims: `{ role: "admin", status: "active" }`
- Firestore rules use `request.auth.token.role` and `request.auth.token.status` (never get() calls)

---

## Stripe
- Membership: `mode: "subscription"`, CAD, $50 first month → $99/month recurring
- Event tickets: `mode: "payment"`, CAD, server-side pricing only (never trust frontend)
- Webhook secret: `STRIPE_WEBHOOK_SECRET` env var
- Webhook endpoint: `/api/webhook`
- Webhook handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

---

## Email System (Resend)
- Provider: Resend — `RESEND_API_KEY` env var required
- From: `ALL ACCESS <hello@allaccesswinnipeg.ca>`
- Templates: `web/src/lib/emails/membership-welcome.ts`, `web/src/lib/emails/ticket-confirmation.ts`
- Send module: `web/src/lib/email.ts`
- **Membership welcome** — sent after `syncUser()` in `checkout.session.completed` (subscription path)
- **Ticket confirmation** — sent after Firestore transaction in `checkout.session.completed` (event_ticket path)
- **Idempotency**: `users/{uid}.welcomeEmailSentAt` and `ticketOrders/{orderId}.confirmationEmailSentAt` sentinel fields prevent duplicate sends on webhook retries

---

## Firestore Collections
| Collection | Purpose | Write access |
|---|---|---|
| `users/{uid}` | Member profiles + Stripe data | Webhook (Admin SDK) / client (safe fields only) |
| `events/{eventId}` | Platform events | Admin only |
| `perks/{perkId}` | Member perks with promo codes | Admin only |
| `posts/{postId}` | Community feed | Active members |
| `comments/{commentId}` | Post comments | Active members |
| `ticketOrders/{orderId}` | Ticket purchases | Server-side Admin SDK only |

---

## Key Files
```
web/src/app/
  api/
    checkout/route.ts          — membership Stripe checkout
    event-checkout/route.ts    — event ticket Stripe checkout (server-side pricing)
    webhook/route.ts           — Stripe webhook (subscription sync + email sends)
  admin/
    events/page.tsx            — admin CRUD for events
    perks/page.tsx             — admin CRUD for perks
    users/page.tsx             — admin user management
  events/
    page.tsx                   — events page wrapper
    EventsList.tsx             — event cards with quantity selector + ticket checkout
  page.tsx                     — homepage (conversion-optimized)

web/src/lib/
  auth-context.tsx             — reads claims from ID token (zero Firestore reads)
  firebase-admin.ts            — Admin SDK singleton
  firebase.ts                  — client SDK
  email.ts                     — sendMembershipWelcome(), sendTicketConfirmation()
  emails/
    membership-welcome.ts      — welcome email HTML template
    ticket-confirmation.ts     — ticket confirmation HTML template

firestore.rules                — production security rules (deployed)
```

---

## Event Ticket Purchase Flow
1. User selects quantity (1–5 max) on event card → clicks "Get Tickets"
2. `EventsList.tsx` calls `POST /api/event-checkout` with `{ eventId, quantity, uid, userEmail }`
3. Server validates: quantity, event exists + active, capacity, membership for members-only events
4. Server reads price from Firestore (never trusts frontend)
5. Creates `ticketOrders` doc with `paymentStatus: "pending"`
6. Creates Stripe Checkout session → returns URL
7. On success: webhook fires `checkout.session.completed` with `metadata.type === "event_ticket"`
8. Webhook: Firestore transaction marks order `paid`, decrements `ticketsRemaining`, auto-marks `sold_out` at 0
9. Webhook: sends ticket confirmation email via Resend (idempotent)
10. User lands on `/events?order=success` → green toast shown

---

## Events in Database (4 active)
1. **VIP Launch Night** — members only, memberPrice $45, June 14 2026
2. **Winnipeg After Dark DIABLO** — memberPrice $35, generalPrice $50, July 19 2026
3. **Mansion Party** — memberPrice $60, generalPrice $80, Aug 9 2026
4. **Sea Bears Courtside** — memberPrice $55, generalPrice $75, Aug 23 2026

Images hosted in `web/public/events/` → served from Vercel CDN.

---

## Perks in Database (6 active)
Seeded via `scripts/seed-perks.mjs` (run from `functions/` folder).

---

## Domain Setup
- Primary: `allaccesswinnipeg.ca` on Vercel
- Redirect: `allaccesswinnipeg.com` → `allaccesswinnipeg.ca` (301, via `next.config.ts`)
- GoDaddy DNS: `allaccesswinnipeg.com` A record → `216.198.79.1` (Vercel)

---

## Environment Variables (Vercel + .env.local)
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_KEY   (JSON stringified)
RESEND_API_KEY                 (re_xxxx... — add to Vercel before emails work)
APP_URL=https://allaccesswinnipeg.ca
```

---

## Common Commands
```bash
# Local dev
cd ~/all-access-platform/web && npm run dev

# Forward Stripe webhooks locally
stripe listen --forward-to localhost:3000/api/webhook

# Deploy Firestore rules
cd ~/all-access-platform && firebase deploy --only firestore:rules

# Run seed scripts (must be in functions/ folder — has firebase-admin)
cd ~/all-access-platform/functions
node ../scripts/seed-events.mjs
```

---

## Known Gotchas
- `resource.data` is NULL on Firestore list queries — can't filter `isMembersOnly` in rules on collection reads. Events rule is `allow read: if isSignedIn()` — UI handles member gating.
- Custom claims must be lowercase: `role: "admin"` not `"Admin"`. Case mismatch breaks all access checks.
- Stripe webhook must return 200 even on logic errors — otherwise Stripe retries infinitely.
- Seed scripts fail if run from `scripts/` directly — `firebase-admin` is only installed in `functions/`.
- After membership checkout, client must call `user.getIdToken(true)` to pick up new custom claims.
