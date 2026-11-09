# Deploying on Railway

This puts the website **and** the API behind one address, with a persistent volume for the database and photos. One service means one link to share, no cross-site (CORS) settings, and nothing to keep in sync.

## What gets deployed

The `Dockerfile` at the repo root builds the website (React and Vite), builds the API (NestJS), puts the website next to it, and starts both. When the container starts, `College-Business-Corner-Backend/railway-start.sh` applies the database migrations, adds the sample businesses, and starts the server.

Migrations and seeding run at **start**, not at build, because Railway only attaches the volume when the container starts.

## Before you begin

1. The repo is on GitHub and contains `Dockerfile` and `.dockerignore` at the **root** (next to the two project folders), and `railway-start.sh` inside `College-Business-Corner-Backend/`.
2. No secrets are committed: `.env`, `*.db` and `uploads/` must not be in the repo.
3. You have these ready (from the PayPal Developer Dashboard and Google AI Studio):
   - PayPal sandbox **Platform app**: client ID, client secret, partner merchant ID, and BN code
   - A Gemini API key

## Steps

1. **Create the project.** On railway.com choose **New Project**, then **Deploy from GitHub repo**, then pick your repo. Railway builds with the Dockerfile automatically (it always uses a Dockerfile when it finds one). **The first deploy will fail until you add the variables below. That is expected.**

2. **Add a volume.** Right-click the project canvas (or press Cmd/Ctrl+K), choose **Volume**, attach it to your service, and set the **mount path to `/data`**.

3. **Add the variables.** Open the service, then **Variables**, then **Raw Editor**, and paste this with your own values:

   ```
   PORT=3000
   AUTH_SECRET=<a long random string>
   PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
   PAYPAL_CLIENT_ID=<from your PayPal sandbox app>
   PAYPAL_CLIENT_SECRET=<from your PayPal sandbox app>
   PAYPAL_PARTNER_MERCHANT_ID=<your sandbox partner merchant id>
   PAYPAL_BN_CODE=<your BN code>
   GEMINI_API_KEY=<from Google AI Studio>
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

   - Make a random `AUTH_SECRET` with `openssl rand -hex 32` in a terminal.
   - **Do not set** `DATABASE_URL` or `UPLOADS_DIR`. The start script puts them on the volume. If you set them somewhere else, the script moves them back and prints a warning.
   - `APP_BASE_URL` and `FRONTEND_URL` are filled in automatically from Railway's public domain, so leave them out (see step 4).
   - Optional: `PLATFORM_FEE_PERCENT`, `POLICY_HARD_CAP_CENTS`, `POLICY_CONFIRM_ABOVE_CENTS`. `SEED_ON_START=false` stops the sample data being added at each start.
   - **The sample sellers** Campus Print Hub and Fresh Cuts Salon point at the PayPal sandbox merchant accounts built into the seed script. They can be paid only if those merchants are onboarded to **your** PayPal app. If they are not, set `SEED_PRINT_MERCHANT_ID` and `SEED_SALON_MERCHANT_ID` to sandbox seller accounts you have onboarded.

4. **Get a public address.** Open **Settings**, then **Networking**, then **Generate Domain**, and target port **3000**. Setting `PORT=3000` first (step 3) means Railway knows which port to use. The server needs this domain to build the PayPal return links, so **generate the domain before the first successful start**.

5. **Deploy.** Apply the changes and deploy (or redeploy). In the logs, look for:
   - `[start] database: file:/data/app.db` and `[start] photos: /data/uploads`, which confirm the data is on the volume.
   - `Seed complete: ...`
   - `Nest application successfully started`
   - **No** line starting with `[storage] WARNING`.

6. **Optional but recommended.** In **Settings**, set the health check path to `/listings`.

## Check it works

1. Open your Railway address. You should see the sign-in screen.
2. Click **Explore as a buyer**, ask for something, and approve a PayPal sandbox payment.
3. Open `/docs` on the same address to see the API.
4. **Redeploy once**, then check that the businesses, your orders and any photos you uploaded are still there. This confirms the volume works.

## Troubleshooting

| What you see | What it means and what to do |
|---|---|
| Crash with `Configuration key "X" does not exist` | A required variable is missing. The required ones are `PAYPAL_BASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PARTNER_MERCHANT_ID`, `PAYPAL_BN_CODE`, and `APP_BASE_URL` (which comes from the domain, so do step 4). |
| `AUTH_SECRET must be set in production` | Add `AUTH_SECRET` (step 3). |
| Data or photos disappear after a redeploy | Check for `[storage] WARNING` in the logs, and that the volume's mount path is exactly `/data`. |
| The page loads but sign-in fails | Open the browser console (F12) and the Network tab. Send me the failing request's address and status. |
| The build fails | Send me the build log. I have not been able to run Docker myself, so the first build is the real test. |
| PayPal approves but you do not land back on the app | `APP_BASE_URL` is wrong or empty. Generate the domain (step 4) and redeploy. |
| Assistant answers are slow or fail | Gemini's free tier has rate limits. Wait a minute, or use `gemini-3.5-flash-lite`. |

## Cost and limits

As of the Railway docs I checked: a new account gets a one-time **$5 trial credit** (30 days), then the **Free** plan costs **$1 a month** of usage. **Hobby** is $5 a month and includes $5 of usage. Free and Trial plans include **0.5 GB** of volume storage, which is plenty for this app. **Check railway.com/pricing yourself before relying on this, and make sure the demo stays up for the whole judging period.** If the credit runs out, the service stops.

## Keep secrets safe

Never commit `.env` or paste real keys into the README or Devpost. If a key was ever shared, rotate it in the PayPal Dashboard or Google AI Studio and update the Railway variable.
