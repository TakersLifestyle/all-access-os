// Stripe webhook — activates user in Firestore after successful subscription
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  const db = adminDb();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id ?? session.metadata?.uid;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (uid) {
          await db.collection("users").doc(uid).set(
            { status: "active", stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId },
            { merge: true }
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        // Find user by Stripe customer ID and deactivate
        const snap = await db.collection("users")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (!snap.empty) {
          await snap.docs[0].ref.set({ status: "inactive" }, { merge: true });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const snap = await db.collection("users")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (!snap.empty) {
          await snap.docs[0].ref.set({ status: "inactive" }, { merge: true });
        }
        break;
      }
    }
  } catch (err: unknown) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
