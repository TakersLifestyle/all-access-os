import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();
const auth = getAuth();

const email = "chrisbryant433@gmail.com";

console.log(`=== Firebase Auth record ===`);
const authUser = await auth.getUserByEmail(email);
console.log(`UID:           ${authUser.uid}`);
console.log(`Email:         ${authUser.email}`);
console.log(`Verified:      ${authUser.emailVerified}`);
console.log(`Disabled:      ${authUser.disabled}`);
console.log(`Sign-in methods: ${authUser.providerData.map(p => p.providerId).join(", ")}`);
console.log(`Custom claims: ${JSON.stringify(authUser.customClaims ?? {})}`);
console.log(`Created:       ${new Date(authUser.metadata.creationTime).toLocaleString()}`);
console.log(`Last sign-in:  ${new Date(authUser.metadata.lastSignInTime).toLocaleString()}`);

console.log(`\n=== Firestore users/${authUser.uid} ===`);
const firestoreDoc = await db.collection("users").doc(authUser.uid).get();
if (firestoreDoc.exists) {
  const d = firestoreDoc.data();
  console.log(`role:          ${d.role ?? "NOT SET"}`);
  console.log(`status:        ${d.status ?? "NOT SET"}`);
  console.log(`email:         ${d.email ?? "NOT SET"}`);
  console.log(`stripeCustomerId: ${d.stripeCustomerId ?? "none"}`);
  console.log(`Full doc:`, JSON.stringify(d, null, 2));
} else {
  console.log("NO FIRESTORE DOCUMENT EXISTS for this user");
}

// Force correct state
console.log(`\n=== Applying fix ===`);
await auth.setCustomUserClaims(authUser.uid, { role: "member", status: "active" });
await db.collection("users").doc(authUser.uid).set({
  email,
  role: "member",
  status: "active",
  updatedAt: new Date().toISOString(),
}, { merge: true });

const verify = await auth.getUser(authUser.uid);
console.log(`✓ Claims now: ${JSON.stringify(verify.customClaims)}`);
console.log(`✓ Firestore updated.`);
console.log(`\nNote: User must sign out and sign back in to get the new token.`);
process.exit(0);
