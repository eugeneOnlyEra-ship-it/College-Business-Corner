// paypal-test.example.mjs : reference copy of the throwaway CLI used to prove the PayPal flow.
// To use: copy to paypal-test.mjs (git-ignored), paste your sandbox values, run with node.
// NEVER commit a version containing real secrets.
//
//   node paypal-test.mjs token
//   node paypal-test.mjs onboard <your-tracking-id>
//   node paypal-test.mjs lookup <your-tracking-id>
//   node paypal-test.mjs status <seller-paypal-merchant-id>
//   node paypal-test.mjs order <seller-paypal-merchant-id> [amount] [fee] [full|nofee|plain]
//   node paypal-test.mjs capture <order-id>
import { randomUUID } from "node:crypto";

const CLIENT_ID = "PASTE_SANDBOX_CLIENT_ID";
const CLIENT_SECRET = "PASTE_SANDBOX_SECRET";
const BN_CODE = "PASTE_BN_CODE";
const PARTNER_MERCHANT_ID = "PASTE_PARTNER_MERCHANT_ID";
const BASE = "https://api-m.sandbox.paypal.com";

async function getToken() {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) { console.error("Token request FAILED:", res.status, data); process.exit(1); }
  return data;
}

function partnerHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "PayPal-Partner-Attribution-Id": BN_CODE,
    "PayPal-Request-Id": randomUUID(),
  };
}

async function onboard(trackingId) {
  const { access_token } = await getToken();
  const res = await fetch(`${BASE}/v2/customer/partner-referrals`, {
    method: "POST",
    headers: partnerHeaders(access_token),
    body: JSON.stringify({
      tracking_id: trackingId,
      partner_config_override: { return_url: "https://example.com/paypal-return" },
      operations: [{
        operation: "API_INTEGRATION",
        api_integration_preference: {
          rest_api_integration: {
            integration_method: "PAYPAL",
            integration_type: "THIRD_PARTY",
            third_party_details: { features: ["PAYMENT", "REFUND", "PARTNER_FEE"] },
          },
        },
      }],
      products: ["EXPRESS_CHECKOUT"],
      legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
    }),
  });
  const data = await res.json();
  if (!res.ok) { console.error("Onboarding FAILED:", res.status, JSON.stringify(data, null, 2)); process.exit(1); }
  const link = data.links.find((l) => l.rel === "action_url");
  console.log("\nOpen this link in a PRIVATE/INCOGNITO window:\n");
  console.log(link.href + "\n");
}

async function lookup(trackingId) {
  const { access_token } = await getToken();
  const res = await fetch(
    `${BASE}/v1/customer/partners/${PARTNER_MERCHANT_ID}/merchant-integrations?tracking_id=${trackingId}`,
    { headers: partnerHeaders(access_token) });
  const data = await res.json();
  console.log("HTTP status:", res.status);
  console.log("Seller PayPal merchant ID:", data.merchant_id);
}

async function status(sellerMerchantId) {
  const { access_token } = await getToken();
  const res = await fetch(
    `${BASE}/v1/customer/partners/${PARTNER_MERCHANT_ID}/merchant-integrations/${sellerMerchantId}`,
    { headers: partnerHeaders(access_token) });
  const data = await res.json();
  console.log("HTTP status:", res.status);
  console.log("payments_receivable:", data.payments_receivable);
  console.log("primary_email_confirmed:", data.primary_email_confirmed);
  console.log("permissions granted:", data.oauth_integrations?.length ? "yes" : "NO");
}

// mode: "full" = seller + platform fee, "nofee" = seller only, "plain" = no seller, no fee
async function createOrder(sellerMerchantId, amount, fee, mode) {
  const { access_token } = await getToken();
  const unit = {
    reference_id: "TEST-ORDER-1",
    description: "College Business Corner test purchase",
    amount: { currency_code: "USD", value: amount },
  };
  if (mode !== "plain") unit.payee = { merchant_id: sellerMerchantId };
  if (mode === "full") {
    unit.payment_instruction = {
      disbursement_mode: "INSTANT",
      platform_fees: [{ amount: { currency_code: "USD", value: fee } }],
    };
  }
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: partnerHeaders(access_token),
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [unit],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: "https://example.com/paypal-return",
            cancel_url: "https://example.com/paypal-cancel",
          },
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) { console.error("Create order FAILED:", res.status, JSON.stringify(data, null, 2)); process.exit(1); }
  const approve = data.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  console.log("Mode:", mode, "\nOrder ID:", data.id, "\nOrder status:", data.status);
  console.log("\nOpen in a PRIVATE window, log in as the sandbox PERSONAL (buyer) account:\n");
  console.log(approve.href + "\n");
  console.log(`Then run:  node paypal-test.mjs capture ${data.id}`);
}

async function capture(orderId) {
  const { access_token } = await getToken();
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: partnerHeaders(access_token),
    body: "{}",
  });
  const data = await res.json();
  if (!res.ok) { console.error("Capture FAILED:", res.status, JSON.stringify(data, null, 2)); process.exit(1); }
  const cap = data.purchase_units?.[0]?.payments?.captures?.[0];
  console.log("Order status:", data.status, "\nCapture status:", cap?.status);
  console.log("Capture details:\n", JSON.stringify(cap, null, 2));
}

const [cmd, a, b, c, d] = process.argv.slice(2);
if (cmd === "token") {
  const t = await getToken();
  console.log("SUCCESS. Token starts with:", t.access_token.slice(0, 12) + "...", "expires_in:", t.expires_in);
} else if (cmd === "onboard") await onboard(a || "seller1");
else if (cmd === "lookup") await lookup(a || "seller1");
else if (cmd === "status") await status(a);
else if (cmd === "order") await createOrder(a, b || "10.00", c || "1.00", d || "full");
else if (cmd === "capture") await capture(a);
else console.log("Usage: see comments at top of file.");
