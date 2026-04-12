import { NextRequest, NextResponse } from "next/server";

type CheckoutData = {
  url?: string;
  checkoutUrl?: string;
  sessionUrl?: string;
  stripeCheckoutUrl?: string;
  data?: {
    url?: string;
    checkoutUrl?: string;
    sessionUrl?: string;
  };
};

function extractUrlFromJson(data: CheckoutData): string | null {
  if (!data) return null;

  return (
    data.url ||
    data.checkoutUrl ||
    data.sessionUrl ||
    data.stripeCheckoutUrl ||
    data?.data?.url ||
    data?.data?.checkoutUrl ||
    data?.data?.sessionUrl ||
    null
  );
}

function extractStripeUrlFromText(raw: string): string | null {
  if (!raw) return null;

  // Stripe Checkout URLs commonly look like https://checkout.stripe.com/c/pay/...
  const match = raw.match(/https:\/\/checkout\.stripe\.com\/[^\s"'<>]+/i);
  return match?.[0] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const fnUrl = process.env.CREATE_CHECKOUT_SESSION_URL;

    if (!fnUrl) {
      return NextResponse.json(
        { error: "Missing CREATE_CHECKOUT_SESSION_URL in web/.env.local" },
        { status: 500 }
      );
    }

    // Forward uid so the Cloud Function can stamp client_reference_id on the session
    let uid: string | null = null;
    try {
      const body = await req.json();
      uid = body?.uid ?? null;
    } catch {
      // No body or invalid JSON — uid stays null
    }

    const res = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
      // If the function responds with a redirect, don't auto-follow it.
      redirect: "manual",
      cache: "no-store",
    });

    // ✅ Case 1: Redirect (e.g., res.redirect(session.url))
    const location = res.headers.get("location");
    if (location && location.startsWith("http")) {
      return NextResponse.json({ url: location });
    }

    const raw = await res.text();

    // If function failed, bubble the payload up so you can see it in UI
    if (!res.ok) {
      // Try to find a Stripe URL even in error pages (rare but possible)
      const maybeStripe = extractStripeUrlFromText(raw);
      if (maybeStripe) return NextResponse.json({ url: maybeStripe });

      return NextResponse.json(
        {
          error: "Cloud Function returned non-200",
          status: res.status,
          raw: raw?.trim() ? raw : "(empty body)",
        },
        { status: 500 }
      );
    }

    // ✅ Case 2: JSON body
    let data: CheckoutData | null = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // ✅ Case 3: Not JSON (HTML/text)
      const maybeStripe = extractStripeUrlFromText(raw);
      if (maybeStripe) return NextResponse.json({ url: maybeStripe });

      return NextResponse.json(
        {
          error: "Cloud Function did not return JSON (and no Stripe URL found)",
          raw: raw?.trim() ? raw : "(empty body)",
        },
        { status: 500 }
      );
    }

    const url = data ? extractUrlFromJson(data) : null;
    if (!url) {
      return NextResponse.json(
        { error: "No checkout URL returned", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Server failed to call Cloud Function", details: message },
      { status: 500 }
    );
  }
}