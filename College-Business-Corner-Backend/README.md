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
# After pulling new code, always bring an existing dev.db up to date (applies migrations AND regenerates the Prisma client):
npm run db:deploy
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

## Business profile (public)
`GET /listings/businesses/:id` returns one business with its active listings (name, category, description, member-since date,
whether it can take PayPal, and each listing with price and photo). It is read-only and public like `GET /listings`, and never includes
the owner's email or any PayPal ids. Unknown ids return 404.

## Shopping assistant: cards in the chat
`POST /agent/chat` now also returns `listings` (the real listings the assistant found: id, title, description, price, unit, photo and
business id/name/category/PayPal status, best 4 per search, 12 at most) and `selectedIds` (which of them went into the cart). The chat
shows them as cards: tap one to read about the business and see everything it offers, or choose it. The cards come straight from the
search results, never from the AI's wording, so they can't show invented listings.
The assistant's instructions were changed so that when several listings fit a need and the student gave no budget or preference, it lists
the options and asks which one, instead of silently picking the cheapest and preparing a payment link.

## Shopping assistant: handing the decision over
If the student says "choose for me", "you decide", "just do it", "I'll just pay" and similar, the assistant picks, prepares the
checkout, and its reply lists what it picked, the other options it found with prices, why the pick won, and that the only thing left
is to approve the payment link. The cards under the reply show all the options. Safety rules still apply: the assistant never pays, and
delegating never lets it skip a confirmation or go over a budget or limit (ASK and BLOCK work exactly as before).

## Starter pack for new entrepreneurs
`GET /insights/starter-pack` (owner sign-in) returns checked beginner tips, books and websites (`src/insights/starter-pack.ts`).
The business assistant offers them once after a first business is confirmed, and shows them as a card when the owner asks. The assistant
only ever sees titles, never links, and the card is built from this file, so it cannot invent a book or a web address. A test allows only
checked hosts: to add a link, check it works, add it to the file, and add its host to the test.

## Who can see what
| Data | Who can read it |
|---|---|
| Businesses, listings, business pages, search | Everyone (it is a public marketplace) |
| `GET /businesses`, `/businesses/:id/sales`, edits | Only the owner account that owns that business |
| `GET /orders/mine`, `/buyers/me/limits` | Only the signed-in buyer, their own data |
| `GET /policy/audit` (Safety log) | Only the signed-in buyer, their own decisions. Owners get an empty list |
| `GET /orders/:id` (receipt link) | Anyone who has the link (an unguessable id). It shows the buyer's name only, never their email |

Sign-in is a **demo**: there is no password, so anyone who knows an email can sign in as it (the role is just chosen at login).
`demo-buyer@campus.test` and `demo-owner@campus.test` are ordinary accounts: they see only what they created. Nothing shows "all
businesses with their sales" except signing in as the account that owns them. Real sign-in (Google or a magic link) is the production step.
The seed businesses belong to `print.owner@example.com`, `salon.owner@example.com` and `rides.owner@example.com`, and the seeded
demo orders to `student@example.com`.

## Buyers: who an order belongs to, history and personal limits
- A signed-in buyer always buys as themselves: `POST /orders` and the shopping agent use the signed-in email (any `buyerEmail` in the
  body is ignored). Without sign-in (for example Swagger testing) the seeded demo student is used. A token that is present but
  invalid or expired is rejected with 401 rather than silently falling back to the demo student.
  Orders made before this change stay with the demo student.
- `GET /orders/mine` (sign-in needed) lists the buyer's own orders, newest first.
- `GET /buyers/me/limits` and `PUT /buyers/me/limits` (sign-in needed) read and set the buyer's own safety limits:
  `{ "maxOrderCents": 4000, "confirmAboveCents": 1500 }`, with `null` meaning "use the default". Limits can only be **stricter**
  than the system's (`POLICY_HARD_CAP_CENTS`, `POLICY_CONFIRM_ABOVE_CENTS`): the maximum order can't exceed the system cap and
  "ask me first" can't exceed the buyer's own maximum. The policy engine applies them on every checkout and the audit log records the result.

## Sellers: sales
`GET /businesses/:id/sales` (owner sign-in, own business only) returns totals (paid orders, what customers paid, platform fee,
PayPal fee, what the seller received) and the 20 most recent paid orders. Only completed orders count. Buyers appear by name only,
never by email.

## Owner edits
Owners (signed in) can correct their own data. Both routes only touch the signed-in owner's businesses and change only the fields sent:
- `PATCH /businesses/:id` changes name, category or description.
- `PATCH /businesses/:id/listings/:listingId` changes title, description, kind, price (0.50 to 100.00 dollars), unit, or `active`.
  `active: false` hides a listing: it leaves search and business pages, and checkout refuses it. `active: true` shows it again.

## Search analytics and a fresh database
Search analytics are **real, anonymous counts of what people search for**, so they start empty. A new database
created from the migrations (and `npm run db:seed`, which only adds demo businesses and listings) has **no search data
until people search**. That is by design: nothing is pre-filled or invented, and the owner assistant only quotes numbers it
really reads from the database.

What this means in practice:
- Right after setup, the owner assistant says there isn't enough campus search data yet and falls back to general ideas.
- Demand appears once a keyword has been searched **at least 2 times** (a privacy rule, `MIN_REPORT_COUNT`).
- Counting happens in `GET /listings?q=`, so Browse (press Search or Enter) and the shopping assistant both feed it.

To see demand insights yourself (for example when testing or recording a demo):
1. Sign in as a buyer and search for things nobody sells yet, twice each (for example "tutoring", "laundry", "phone charger").
2. Sign in as an owner, open the **Assistant** and ask "I have no idea what to sell. What do students want?"
3. It should quote the real counts and mention that nobody sells those things yet.

## Troubleshooting: sign-in hangs or "Could not reach the server"
- **Several old copies running.** `Port 5173 is in use, trying another one...` and `EADDRINUSE ... :3000` mean old dev servers are still alive.
  List them with `ss -ltnp | grep -E ':(3000|3003|517[0-9])'` and stop the stale ones (`kill <pid>`), so Vite gets 5173 again.
- **Frontend and backend must point at each other.** Backend `.env`: `PORT=3003`. Frontend `.env`: `VITE_API_URL=http://localhost:3003`.
  Restart Vite after editing `.env` (it only reads it at startup). Check the backend is really on that port: open `http://localhost:3003/docs`.
- **CORS.** In development the API accepts a browser page on any localhost port (Vite hops ports). In production only `FRONTEND_URL`
  (one address or a comma-separated list) is accepted, and localhost is not.
- **PayPal redirect.** `FRONTEND_URL` must be the address the app is really on, because PayPal sends the buyer back there.
- The frontend now gives up after 20 seconds (2 minutes for the assistant) with a message naming the address it tried.

## Troubleshooting: search analytics shows nothing
- Check the server log at startup. `The "SearchInterest" table is missing` means your `dev.db` is behind the code: run `npm run db:deploy`.
- A keyword is only shown to owners once it has been searched **at least 2 times** (`MIN_REPORT_COUNT`), so one test search per word won't appear. Search each word twice.
- Counting happens in `GET /listings?q=`: Browse (press Search/Enter) and the shopping assistant both use it.
