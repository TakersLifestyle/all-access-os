import Stripe from "stripe";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));
const raw = getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

// Exact correct mapping — chronological by purchase date
// ebubeokeke0 Aug 4 = Ticket #1 (confirmed by user)
// bforsonfoidart Sep 2 = Group of 3 = Ticket #6–#8
const CORRECT = [
  { id: "pi_3U0lRPARL4KX4f6A3f7Hfdgl", label: "ROCAFIESTA — Ticket #1"    }, // Aug 4  ebubeokeke0
  { id: "pi_3U20HnARL4KX4f6A0REMPVrR", label: "ROCAFIESTA — Ticket #2"    }, // Aug 7  ben.duk
  { id: "pi_3U41UfARL4KX4f6A0dOhhxeb", label: "ROCAFIESTA — Ticket #3"    }, // Aug 13 neema.muthumwa
  { id: "pi_3U5Ym1ARL4KX4f6A1mnm9cob", label: "ROCAFIESTA — Ticket #4"    }, // Aug 17 nancysoka
  { id: "pi_3U9DOJARL4KX4f6A0iDkYjXo", label: "ROCAFIESTA — Ticket #5"    }, // Aug 27 hauwaomowumi
  { id: "pi_3UBHz1ARL4KX4f6A1R2JasrE", label: "ROCAFIESTA — Ticket #6–#8" }, // Sep 2  bforsonfoidart (group of 3)
  { id: "pi_3UBQU1ARL4KX4f6A3OltlZF1", label: "ROCAFIESTA — Ticket #9"    }, // Sep 2  savross28
  { id: "pi_3UBhDnARL4KX4f6A1KBSmEs9", label: "ROCAFIESTA — Ticket #10"   }, // Sep 3  neema.mithumwa
  // Jul 6 pre-sale (not counted in numbered sequence)
  { id: "pi_3TqHF8ARL4KX4f6A0r5RrtBf", label: "ROCAFIESTA — Early Access" },
];

for (const { id, label } of CORRECT) {
  try {
    await stripe.paymentIntents.update(id, { description: label });
    console.log(`✓ ${id} → "${label}"`);
  } catch (e) {
    console.log(`✗ ${id}: ${e.message}`);
  }
}

// 10 real tickets sold (1+1+1+1+1+3+1+1), 90 remaining
await db.collection("events").doc("MCzwl8mGF8P1rL5goEab").update({ ticketsRemaining: 90 });
console.log(`\n✓ Firestore ticketsRemaining → 90`);
process.exit(0);
