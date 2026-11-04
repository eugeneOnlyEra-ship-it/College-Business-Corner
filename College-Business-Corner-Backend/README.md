# College Business Corner: Backend (NestJS)

Campus marketplace API: businesses list products/services, students pay through PayPal
(multi-seller split payments with a platform fee), and an AI shopping agent buys on a
student's behalf under a spending policy.

> Hackathon: PayPal AI Hackathon (Devpost). Full context: see `/HANDOVER/PROJECT_HANDOVER.md` at the repo root.

## Requirements
- Node.js 22.22.3+ (Nest 12 scaffold requirement)
- A PayPal Developer account with a **Platform** app in the **Sandbox**, a sandbox Personal
  (buyer) account, and at least one sandbox Business (seller) account that has been onboarded.

## Setup
```bash
npm install            # if you hit "Cannot read properties of null (reading 'edgesOut')": npm install --legacy-peer-deps
cp .env.example .env   # then fill in the values (DATABASE_URL="file:./dev.db" is already right)
npx prisma generate    # builds the typed database client into src/generated/prisma
npx prisma migrate dev # creates the local SQLite database (dev.db) from prisma/migrations
npm run db:seed        # demo businesses and listings (safe to re-run)
npm run start:dev
```
Open http://localhost:3000/docs (Swagger UI) to try the endpoints.

## Verify the PayPal flow (browser only, no curl)
1. `GET /paypal/sellers/{merchantId}/status` -> `ready: true` for an onboarded seller.
2. `POST /paypal/orders` with
   ```json
   { "items": [ { "sellerMerchantId": "NR94ASH7KHULQ", "amount": "10.00", "platformFee": "1.00", "description": "Test purchase" } ] }
   ```
3. Open the returned `approveUrl` in a **private window**, log in as the sandbox **Personal** buyer, approve.
   You are redirected to `/paypal/return`, which captures the payment and shows the breakdown.

## Onboard a new seller
`POST /paypal/onboard` `{ "trackingId": "business-123" }` -> open `onboardingUrl` in a private window,
log in with the sandbox Business account, approve. Check the `merchantIdInPayPal` in the return URL
(echoed by `/paypal/onboarding-return`). Or `GET /paypal/lookup/business-123`.

## Database (SQLite + Prisma)
No database server needed: the database is the single file `dev.db`. Money is stored in whole cents.
Try `GET /listings?q=haircut` or `GET /listings?maxPriceCents=1000` in Swagger after seeding.
Tables: User, Business, Listing, Order, OrderItem, AuditLog (see `prisma/schema.prisma`).
One PayPal account can be connected to several businesses (a student with two side businesses needs only one PayPal account). When a buyer
pays two businesses on the same account, PayPal gets one payment and the app records each business's share.

The seed links two demo sellers to the author's PayPal sandbox merchants; to use your own, onboard
sellers and set `SEED_PRINT_MERCHANT_ID` / `SEED_SALON_MERCHANT_ID` in `.env` before seeding.

## Place a real order (database-backed)
1. `GET /listings` and copy two listing ids (for example a printing job and a haircut).
2. `POST /orders` with `{ "items": [ { "listingId": "...", "quantity": 1 }, { "listingId": "...", "quantity": 1 } ] }`.
   Prices and the platform fee (`PLATFORM_FEE_PERCENT`, default 10) are computed on the server.
3. Open the returned `approveUrl` in a private window, approve as the sandbox buyer.
   PayPal redirects to `/orders/return`, which captures the payment and shows per-seller results.
4. `GET /orders/{orderId}` shows the saved order, its items and each seller's payout.

## Safety rules (policy engine)
Every checkout request is judged by deterministic rules before PayPal is ever called, and each
decision is saved in the audit log (`GET /policy/audit`).
- **BLOCK** (final): seller not connected to PayPal, unknown/inactive listing, bad quantity, or total above `POLICY_HARD_CAP_CENTS` ($100).
- **ASK** (buyer must confirm with `"confirmed": true`): total over the stated `budgetCents`, total above `POLICY_CONFIRM_ABOVE_CENTS` ($50), or the price changed since it was quoted.
- **ALLOW**: everything else.
Dry-run any cart with `POST /policy/check`.

## Shopping agent (Gemini)
`POST /agent/chat` with `{ "message": "I need 40 pages printed and a haircut, budget $25." }`.
Needs `GEMINI_API_KEY` (free key from Google AI Studio) in `.env`; the model is `GEMINI_MODEL`.
The agent has two tools: search listings, and request a checkout. It can only *propose*: the policy
engine decides allow / ask / block, and the buyer approves any payment in PayPal. The response includes
the reply, the checkout decision (with the PayPal `approveUrl` when allowed) and the tool steps taken.

## Sign-in (demo)
Open the app and choose **I want to buy** or **I want to sell**, then enter an email (no password in this prototype),
or use the **demo buyer / demo business owner** links. The backend returns a signed session token
(`POST /auth/login`); owner endpoints (`/businesses/*`) need it and take the owner from the token, so one
owner cannot manage another's business. In Swagger, paste the token into **Authorize**.
Set `AUTH_SECRET` in `.env` (any long random string; required when `NODE_ENV=production`).
Real sign-in (Google or magic links) is the production step.

## Business assistant (owners)
Owners get an **Assistant** tab. Tell it what you offer ("I offer salon services at $15") and it sets up the business and a clean,
searchable listing, so the shopping assistant can find it. It then guides the owner through connecting PayPal: it checks the PayPal
status, explains anything missing in plain words, and offers a **Connect PayPal** card that opens the PayPal approval link.
It can only PROPOSE: each proposal is a card the owner confirms, and confirming calls the normal owner endpoints
(`POST /businesses`, `/businesses/:id/listings`, `/businesses/:id/paypal/connect`), which validate everything again.
Endpoint: `POST /agent/owner/chat` (owner sign-in required). Needs `GEMINI_API_KEY`.

## Search and campus demand insights
Shoppers search in **Browse** (type, then Enter or **Search**) or by asking the shopping assistant. Both go through `GET /listings?q=`.
Each search is reduced to plain keywords ("cheap haircut near the hostel" becomes `haircut`, `hostel`) and a counter per keyword per day is
added in the `SearchInterest` table. **Privacy by design:** no user, session, IP, full sentence or time of day is stored; text that looks like
an email, link or phone number is dropped; a keyword is only shown to anyone after it has been searched at least twice.

Owners can see the result in the Assistant ("Students are searching for...") and through `GET /insights/demand` (owner sign-in required).
The owner assistant uses it through its `get_demand_insights` tool: for a student with no idea what to sell, it suggests ideas ranked by
keywords that are searched often but have no listings yet, quotes the real counts, and offers to set the chosen idea up. With too little data
it says so and offers general beginner ideas labelled as such.
Owners who already have a business get **expansion tips** too: a special card saying, for example, "Students searched for 'laundry' 7 times in the last 30 days and nobody on campus sells it yet", with a rough start-up cost estimate and an **Add this to my business** button. The numbers on a tip card come from the real counts, so the assistant cannot make them up, and nothing is added unless the owner taps the button and confirms the listing.
To try it: search a couple of things in Browse (twice each), then tell the owner assistant "I have no idea what to sell".
Run `npm run db:migrate` once to create the table.

## For business owners
(All of these need an owner sign-in token.) `POST /businesses` registers a business, `POST /businesses/:id/listings` adds listings, and
`POST /businesses/:id/paypal/connect` returns the PayPal setup link. `GET /businesses/:id/paypal/status`
checks the setup, saves the merchant id automatically and says what is still missing.


## Scripts
`npm run db:generate` | `npm run db:migrate` | `npm run db:seed` | `npm run db:studio` | `npm run build` | `npm test` (unit) | `npm run test:e2e` (wiring) | `npm run start:prod`

## Layout
`src/paypal/` is the ONLY place that talks to PayPal. Built: paypal, prisma, listings, orders, policy, agent, businesses. Planned modules: auth, businesses,
orders, policy, agent, audit (see handover doc).
