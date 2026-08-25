import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve } from "path";

let stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  try {
    const env = readFileSync(resolve("../web/.env.local"), "utf8");
    const match = env.match(/^STRIPE_SECRET_KEY=(.+)$/m);
    if (match) stripeKey = match[1].trim();
  } catch {}
}
const stripe = new Stripe(stripeKey);

// 4 real ROCAFIESTA customer tickets — chronological order
const tickets = [
  { chargeId: "ch_3U0lRPARL4KX4f6A3e60NbRt", num: 1, email: "ebubeokeke0@gmail.com",   date: "Aug 4"  },
  { chargeId: "ch_3U20HnARL4KX4f6A0DFTvhOS", num: 2, email: "ben.duk@hotmail.com",      date: "Aug 7"  },
  { chargeId: "ch_3U41UfARL4KX4f6A0uzKTkl3", num: 3, email: "neema.muthumwa@gmail.com", date: "Aug 13" },
  { chargeId: "ch_3U5Ym1ARL4KX4f6A1EximeXV", num: 4, email: "nancysoka@gmail.com",      date: "Aug 17" },
];

for (const t of tickets) {
  const desc = `ROCAFIESTA — Ticket #${t.num}`;

  // Update charge
  const charge = await stripe.charges.update(t.chargeId, { description: desc });

  // Update linked payment intent
  if (charge.payment_intent) {
    await stripe.paymentIntents.update(charge.payment_intent, { description: desc });
  }

  console.log(`✅  Ticket #${t.num} — ${t.email} (${t.date})`);
}

console.log(`\n✅  All 4 ROCAFIESTA tickets labeled.`);
