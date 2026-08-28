/**
 * Update the Stripe account statement descriptor to "ALL ACCESS WINNIPEG"
 * Run: node --env-file="../web/.env.local" ../functions/fix-statement-descriptor.mjs
 */
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const isLive = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live");
console.log(`Stripe key mode: ${isLive ? "LIVE ✅" : "TEST ⚠️"}`);

// Show current descriptor
const before = await stripe.account.retrieve();
console.log(`\nCurrent descriptor: "${before.settings?.payments?.statement_descriptor ?? "(none)"}"`);

// Update it — POST /v1/account (no account ID needed for own account)
const res = await fetch("https://api.stripe.com/v1/account", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "settings[payments][statement_descriptor]=ALL+ACCESS+WINNIPEG",
});
const updated = await res.json();
if (!res.ok) throw new Error(JSON.stringify(updated));

console.log(`Updated descriptor: "${updated.settings?.payments?.statement_descriptor}"`);
console.log("\n✅ Done — refresh Stripe dashboard to confirm.");
process.exit(0);
