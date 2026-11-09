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

## Sign-in (why there is no password)
The Web version has no passwords on purpose: the aim is to let a judge or visitor try the AI assistant and PayPal checkout in one click
(**Explore as a buyer** / **Explore as a seller**, or any email). Every account still only sees its own data, and all payments are in PayPal's
sandbox, so no real money moves. The trade-off is that anyone who knows an email can sign in as it, so use sample emails, not real personal
details. Real sign-in (Google or a magic link) would be added for a real launch. Details are in the backend README, "Why there is no password".

## If sign-in hangs or says "Could not reach the server"
The message names the address it tried (from `VITE_API_URL`). Check the backend is running there, that you restarted `npm run dev`
after editing `.env`, and that you are not looking at an old copy: `Port 5173 is in use, trying another one...` means an older Vite is
still running, so stop it (`ss -ltnp | grep 517` shows it). See the backend README, "Troubleshooting".

## Screens
- `#/` (buyers) Shopping assistant chat + cart. The example prompts are built from real listings, so they work on any database.
- `#/assistant` (owners) Business assistant: sets up the business and listings, suggests ideas from anonymous campus
  search demand, and guides PayPal onboarding. It only proposes; the owner confirms each card.
- `#/sell` (owners) "My business": PayPal status and connect, listings with photo upload, edit, and hide/show (a hidden listing disappears from search, business pages and checkout), editable business details, a Sales panel (paid orders, fees and what you received), **Close business** (hidden from shoppers, history kept, can be reopened) and **Delete permanently** (only if nothing was ever ordered, and you must type the name), and manual forms to
  register a business or add a listing without the assistant.
- `#/business/:id` Business page: description, payment status, member since and every listing with photos. Buyers can send a ready-made request to the shopping assistant. Opened from any card in Browse.
- `#/orders` (buyers) My orders: every order with its status, date, businesses and total, with a receipt link for paid ones.
- `#/limits` (buyers) My limits: set a personal maximum order and an "ask me first" amount. They can only be stricter than the campus defaults.
- `#/browse` Search (counted anonymously, never who searched), category filter, listing photos.
- `#/log` (buyers) Safety log: the policy decisions about your own orders. Only you can see them.
- `#/orders/:id` Receipt after PayPal payment (per-business payouts and fees).
- `#/cancelled`, `#/problem` Friendly pages for cancelled or failed payments.

## Starter pack
Business owners get an optional, collapsed "Starter pack for new entrepreneurs" (tips, books, websites) on the My business page. The business
assistant offers it after a first business is confirmed and shows it, already open, when the owner asks for tips, books or websites.

## Chat: listing cards
When the shopping assistant finds listings, they appear on a light gold tray (the logo's sun colour) under its reply, so they stand out from the white chat. Each business has its own colour, the cart pick has a green ribbon and ring, and the open card a maroon ring. The colours are the `--tray` / `--tray-ink` variables at the top of that block in `src/merge.css` (photo, title, business, price; "In your cart" for the
chosen one). Tap a card to read about the business and see everything it offers without leaving the chat, or tap **Choose this** to tell the
assistant which one you want. A business that can't take PayPal yet is flagged and can't be chosen.

## Chat: copy and edit your messages
Hover (or tap) one of your own messages in either chat for **Copy** and **Edit**. Edit works in place: **Save & resend** keeps
everything before that message, drops the replies after it, and asks again. In the shopping chat a cart that came from a discarded
reply is cleared. In the business assistant, messages written before a confirmed action (a created business, added listings, a PayPal
step) cannot be edited, because that data is already saved; messages the app writes itself ("I confirmed the listings") have no buttons.

## Code map
- `src/api.ts` is the only file that talks to the backend.
- `src/styles.css`, `dashboard.css`, `blend.css`, `light.css` hold the green/lime theme; `merge.css` holds styles
  for photos, search and the assistant's cards.
- `public/images/photos/` are Pexels photos used under the Pexels License. Credits and terms are in `ATTRIBUTION.md`.

## Image credits
Photos are from [Pexels](https://www.pexels.com/license/) (free to use, attribution not required but given). They are not
covered by this project's open-source license. See `ATTRIBUTION.md`.
