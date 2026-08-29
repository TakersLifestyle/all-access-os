/**
 * GET /api/memories/image?id={mediaId}&size=grid|lightbox
 *
 * PUBLIC image proxy for the Memories archive.
 * — Reads storagePath server-side via Admin SDK (never exposed to client)
 * — Downloads the original from Firebase Storage (server-to-server, bypasses rules)
 * — Resizes to a web-optimised derivative using sharp
 * — Returns the derivative; never returns the original or the storage path
 * — Vercel edge-caches the result for 7 days
 *
 * Size specs:
 *   grid      → max 800px, JPEG 75%   (masonry grid cards)
 *   lightbox  → max 1200px, JPEG 82%  (lightbox viewer — sharp, not original)
 *
 * The original Firebase Storage URL / download token is never sent to the browser.
 * This endpoint is intentionally unauthenticated; it serves only resized derivatives.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import sharp from "sharp";

// Ensure Node.js runtime (required for sharp native binaries)
export const runtime = "nodejs";

// ── Size configurations ──────────────────────────────────────────────────────

const SIZE_CONFIG = {
  grid: { maxDim: 800, quality: 75 },
  lightbox: { maxDim: 1200, quality: 82 },
} as const;

type Size = keyof typeof SIZE_CONFIG;

// Cache-Control for Vercel CDN edge caching.
// Images in the archive don't change, so we cache aggressively.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const sizeParam = searchParams.get("size") ?? "grid";

  // Validate inputs
  if (!id || typeof id !== "string" || id.length > 128) {
    return new NextResponse("Missing or invalid id", { status: 400 });
  }
  if (!Object.keys(SIZE_CONFIG).includes(sizeParam)) {
    return new NextResponse("Invalid size — use grid or lightbox", { status: 400 });
  }
  const size = sizeParam as Size;
  const { maxDim, quality } = SIZE_CONFIG[size];

  try {
    // ── 1. Read storagePath from Firestore (server-side, Admin SDK) ───────────
    // The document is publicly readable in Firestore, but storagePath alone is
    // harmless without a valid auth token or download token to access Storage.
    // Using Admin SDK here so we have a single secure server-to-server path.
    const snap = await adminDb().collection("memoryMedia").doc(id).get();

    if (!snap.exists) {
      return new NextResponse("Not found", { status: 404 });
    }

    const data = snap.data()!;

    // Only proxy photo types — videos use YouTube/external URLs
    if (data.type === "video") {
      return new NextResponse("Videos are not proxied through this endpoint", { status: 400 });
    }

    // ── 2. Resolve the storage path ──────────────────────────────────────────
    let storagePath: string | undefined = data.storagePath;

    // Fallback: extract path from the tokenized URL for legacy records
    if (!storagePath && typeof data.url === "string") {
      storagePath = extractStoragePathFromUrl(data.url);
    }

    if (!storagePath) {
      return new NextResponse("No storage path available for this media", { status: 404 });
    }

    // ── 3. Download original from Firebase Storage via Admin SDK ─────────────
    // This is a server-to-server call using the service account.
    // The original bytes never touch the client — only the resized derivative does.
    const bucket = adminStorage();
    const file = bucket.file(storagePath);

    let originalBuffer: Buffer;
    try {
      const [downloaded] = await file.download();
      originalBuffer = downloaded;
    } catch (storageErr: unknown) {
      const code = (storageErr as { code?: number })?.code;
      if (code === 404) {
        return new NextResponse("Storage object not found", { status: 404 });
      }
      throw storageErr;
    }

    // ── 4. Resize with sharp ─────────────────────────────────────────────────
    const resized = await sharp(originalBuffer)
      .resize({
        width: maxDim,
        height: maxDim,
        fit: "inside",          // preserve aspect ratio, never upscale
        withoutEnlargement: true,
      })
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toBuffer();

    // ── 5. Return derivative with CDN cache headers ──────────────────────────
    // Convert Buffer to Uint8Array — NextResponse BodyInit requires it in strict TS
    return new NextResponse(new Uint8Array(resized), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": CACHE_CONTROL,
        "Vary": "Accept",
        "X-Content-Type-Options": "nosniff",
        // Never expose storage path or any storage credential in response headers
      },
    });
  } catch (err) {
    console.error("[memories/image] Error serving image", { id, size }, err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the Firebase Storage object path from a tokenized download URL.
 * URL format:
 *   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=XXXX
 * The encoded path segment is URL-encoded, so decodeURIComponent is required.
 */
function extractStoragePathFromUrl(url: string): string | undefined {
  try {
    const match = url.match(/\/o\/(.+?)(?:\?|$)/);
    if (!match?.[1]) return undefined;
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}
