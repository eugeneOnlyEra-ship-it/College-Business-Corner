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
cp .env.example .env   # then fill in the values
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

## Scripts
`npm run build` | `npm test` (unit) | `npm run test:e2e` (wiring) | `npm run start:prod`

## Layout
`src/paypal/` is the ONLY place that talks to PayPal. Planned modules: auth, businesses, listings,
orders, policy, agent, audit (see handover doc).
