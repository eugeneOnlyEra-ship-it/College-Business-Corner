# College Business Corner: Frontend

React + TypeScript + Vite. Buyers chat with a shopping assistant and see a live cart with the safety decision
(ready to pay / needs your OK / not allowed). Sellers get a business assistant, a dashboard and PayPal onboarding.

## Run
Start the backend first (see its README), then:
```bash
npm install
npm run dev        # http://localhost:5173
```
Optional: copy `.env.example` to `.env` if the backend is not on `http://localhost:3000`.
In the backend `.env` set `FRONTEND_URL=http://localhost:5173` so PayPal returns you to the receipt page.

## Screens
- `#/` (buyers) Shopping assistant chat + cart. Try the example prompts.
- `#/assistant` (owners) Business assistant: sets up the business and listings, suggests ideas from anonymous campus
  search demand, and guides PayPal onboarding. It only proposes; the owner confirms each card.
- `#/sell` (owners) "My business": PayPal status and connect, listings with photo upload, and manual forms to
  register a business or add a listing without the assistant.
- `#/browse` Search (counted anonymously, never who searched), category filter, listing photos.
- `#/log` Safety log: every policy decision.
- `#/orders/:id` Receipt after PayPal payment (per-business payouts and fees).
- `#/cancelled`, `#/problem` Friendly pages for cancelled or failed payments.

## Code map
- `src/api.ts` is the only file that talks to the backend.
- `src/styles.css`, `dashboard.css`, `blend.css`, `light.css` hold the green/lime theme; `merge.css` holds styles
  for photos, search and the assistant's cards.
- `public/images/photos/` are Pexels photos used under the Pexels License. Credits and terms are in `ATTRIBUTION.md`.

## Image credits
Photos are from [Pexels](https://www.pexels.com/license/) (free to use, attribution not required but given). They are not
covered by this project's open-source license. See `ATTRIBUTION.md`.
