/**
 * POST /api/memories/download
 * Body: { mediaId: string }
 * Authorization: Bearer {firebase-id-token}
 *
 * Authenticated endpoint — generates a short-lived signed URL for the
 * original (full-resolution) Firebase Storage object.
 *
 * Access is gated by canAccessPremiumMemories():
 *   — Admin
 *   — Active ALL ACCESS $10/mo subscriber (status=active AND accountType=supporter)
 *   — Historical Founding Member (isFoundingMember=true custom claim)
 *
 * What this endpoint NEVER does:
 *   — Return a permanent Firebase download token
 *   — Expose the storagePath in the response
 *   — Store the signed URL in Firestore or any log
 *   — Trust any client-supplied premium flag
 *
 * Signed URLs expire in 15 minutes.
 * The response-content-disposition header forces a browser download.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, adminStorage } from "@/lib/firebase-admin";
import { canAccessPremiumMemoriesFromClaims } from "@/lib/premium-memories";

export const runtime = "nodejs";

// Signed URL TTL: 15 minutes
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  // ── 1. Extract and verify Firebase ID token ──────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let decodedToken: Awaited<ReturnType<ReturnType<typeof adminAuth>["verifyIdToken"]>>;
  try {
    decodedToken = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // ── 2. Authorisation — canAccessPremiumMemories() ────────────────────────
  // Never trust client-supplied claims. The decoded token is Firebase-verified.
  if (!canAccessPremiumMemoriesFromClaims(decodedToken)) {
    return NextResponse.json(
      {
        error: "ALL ACCESS membership required",
        code: "PREMIUM_MEMORIES_REQUIRED",
      },
      { status: 403 },
    );
  }

  // ── 3. Parse and validate request body ───────────────────────────────────
  let mediaId: string;
  try {
    const body = await request.json();
    mediaId = body?.mediaId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!mediaId || typeof mediaId !== "string" || mediaId.length > 128) {
    return NextResponse.json({ error: "Missing or invalid mediaId" }, { status: 400 });
  }

  // ── 4. Read storagePath from Firestore via Admin SDK ─────────────────────
  // Using Admin SDK so the storagePath is never visible to the browser.
  const snap = await adminDb().collection("memoryMedia").doc(mediaId).get();

  if (!snap.exists) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const data = snap.data()!;

  // Resolve the storage path
  let storagePath: string | undefined = data.storagePath;
  if (!storagePath && typeof data.url === "string") {
    storagePath = extractStoragePathFromUrl(data.url);
  }

  if (!storagePath) {
    return NextResponse.json(
      { error: "No storage path available for this media" },
      { status: 404 },
    );
  }

  // ── 5. Generate short-lived signed URL ───────────────────────────────────
  // responseDisposition tells GCS to send Content-Disposition: attachment,
  // which triggers a browser download rather than opening the file.
  // The signed URL is ephemeral — it expires in 15 minutes.
  const originalFilename = storagePath.split("/").pop() ?? `memory-${mediaId}.jpg`;
  // Sanitise: strip timestamp prefix (ts_i_originalname.jpg → originalname.jpg)
  const displayFilename = originalFilename.replace(/^\d+_\d+_/, "") || `memory-${mediaId}.jpg`;

  const bucket = adminStorage();
  const file = bucket.file(storagePath);

  let signedUrl: string;
  try {
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
      responseDisposition: `attachment; filename="${displayFilename}"`,
    });
    signedUrl = url;
  } catch (err) {
    console.error("[memories/download] getSignedUrl failed", { mediaId, storagePath }, err);
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }

  // ── 6. Return signed URL — never log it, never store it ──────────────────
  // The storagePath is intentionally excluded from the response.
  return NextResponse.json({
    signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString(),
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractStoragePathFromUrl(url: string): string | undefined {
  try {
    const match = url.match(/\/o\/(.+?)(?:\?|$)/);
    if (!match?.[1]) return undefined;
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}
