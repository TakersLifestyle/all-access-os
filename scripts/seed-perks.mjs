import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../web/.env.local");
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS_JSON=(.+)/);
if (!match) throw new Error("No GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.local");
const serviceAccount = JSON.parse(match[1]);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const perks = [
  {
    title: "VIP Lounge Entry Access",
    partner: "Downtown Lounge (Rotating Partner)",
    discount: "Free entry before 11PM",
    code: "ALLACCESS",
    redemptionMethod: "Show your active ALL ACCESS membership inside the app at the door.",
    description: "Members receive complimentary early access to select nightlife venues. Skip the line and enter before 11PM at no cost.",
    status: "active",
    order: 1,
  },
  {
    title: "Restaurant Discount",
    partner: "Brown's Social House (Rotating Partner)",
    discount: "15% off total bill",
    code: "TAKERS15",
    redemptionMethod: "Show your membership and mention the code to your server before paying.",
    description: "Enjoy discounted dining at select partner restaurants. Perfect for pre-event dinners or casual nights out.",
    status: "active",
    order: 2,
  },
  {
    title: "Complimentary Welcome Drink",
    partner: "Select Nightclub (Rotating Partner)",
    discount: "Free drink with entry",
    code: "NONE",
    redemptionMethod: "Present your ALL ACCESS membership at the bar upon arrival.",
    description: "Members receive a complimentary welcome drink at participating nightlife venues.",
    status: "active",
    order: 3,
  },
  {
    title: "Photoshoot Discount",
    partner: "Local Photographer (TBD)",
    discount: "$25 off session",
    code: "ACCESS25",
    redemptionMethod: "Book your session directly with the photographer and mention the promo code.",
    description: "Get professional photos at a discounted rate. Ideal for personal branding, content creation, and lifestyle shoots.",
    status: "active",
    order: 4,
  },
  {
    title: "Fitness & Wellness Access",
    partner: "Local Gym or Studio (Rotating Partner)",
    discount: "Free 1-day pass",
    code: "ALLACCESSFIT",
    redemptionMethod: "Show your membership at the front desk to redeem your pass.",
    description: "Access premium fitness or wellness facilities for a day. Stay aligned with both lifestyle and health.",
    status: "active",
    order: 5,
  },
  {
    title: "Giveaway Boost",
    partner: "ALL ACCESS",
    discount: "2x giveaway entries",
    code: "AUTOMATIC",
    redemptionMethod: "Active members are automatically entered with double entries in all platform giveaways.",
    description: "Members receive increased chances of winning giveaways including tech, experiences, and exclusive rewards. No action required — being active is enough.",
    status: "active",
    order: 6,
  },
];

async function seed() {
  console.log("🔥 Seeding perks into Firestore...\n");

  // Clear existing perks
  const snap = await db.collection("perks").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
  console.log(`🗑️  Cleared ${snap.docs.length} existing perk(s)\n`);

  for (const perk of perks) {
    const ref = await db.collection("perks").add({
      ...perk,
      createdAt: Timestamp.now(),
    });
    const codeDisplay = perk.code === "NONE" ? "No code" : perk.code === "AUTOMATIC" ? "Auto" : perk.code;
    console.log(`✅ ${perk.title}`);
    console.log(`   Partner: ${perk.partner}`);
    console.log(`   Discount: ${perk.discount} | Code: ${codeDisplay}`);
    console.log(`   ID: ${ref.id}\n`);
  }

  console.log(`🎉 All ${perks.length} perks seeded successfully!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
