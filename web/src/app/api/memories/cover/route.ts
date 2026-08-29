/**
 * GET /api/memories/cover?albumId={albumId}&size=card|hero
 *
 * PUBLIC album-cover proxy for the Memories archive.
 * — Reads coverStoragePath (or derives it from coverImageUrl) via Admin SDK
 * — Downloads the original from Firebase Storage (server-to-server, bypasses rules)
 * — Resizes to a web-optimised derivative using sharp
 * — Returns the derivative; never returns the original or any Firebase download token
 * — Vercel edge-caches the result for 7 days
 *
 * Size specs:
 *   card   → max 800px,  JPEG 80%   (album cards, episode cards, nav thumbnails, homepage grid)
 *   hero   → max 1200px, JPEG 85%   (full-width hero banners)
 *
 * The original Firebase Storage URL / download token is never sent to the browser.
 * This endpoint is intentionally unauthenticated; it serves only resized derivatives.
 *
 * Storage path resolution order:
 *   1. memoryAlbums/{albumId}.coverStoragePath  (preferred — explicit path)
 *   2. Extract path from memoryAlbums/{albumId}.coverImageUrl (legacy fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import sharp from "sharp";

// Ensure Node.js runtime (required for sharp native binaries)
export const runtime = "nodejs";

// ── Size configurations ──────────────────────────────────────────────────────

const SIZE_CONFIG = {
  card: { maxDim: 800,  quality: 80 },
  hero: { maxDim: 1200, quality: 85 },
} as const;

type Size = keyof typeof SIZE_CONFIG;

// Cache-Control for Vercel CDN edge caching.
// Album covers don't change frequently, so we cache aggressively.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get("albumId");
  const sizeParam = searchParams.get("size") ?? "card";

  // Validate inputs
  if (!albumId || typeof albumId !== "string" || albumId.length > 256) {
    return new NextResponse("Missing or invalid albumId", { status: 400 });
  }
  if (!Object.keys(SIZE_CONFIG).includes(sizeParam)) {
    return new NextResponse("Invalid size — use card or hero", { status: 400 });
  }
  const size = sizeParam as Size;
  const { maxDim, quality } = SIZE_CONFIG[size];

  try {
    // ── 1. Read album document from Firestore (server-side, Admin SDK) ────────
    const snap = await adminDb().collection("memoryAlbums").doc(albumId).get();

    if (!snap.exists) {
      return new NextResponse("Album not found", { status: 404 });
    }

    const data = snap.data()!;

    // ── 2. Resolve the cover storage path + bucket ───────────────────────────
    // Priority: coverImageUrl first (reflects the admin's latest "Set Cover" pick),
    // then coverStoragePath as fallback (used for albums with no URL set).
    // Albums created at different times may be in different buckets
    // (.appspot.com vs .firebasestorage.app) — bucket is extracted from the URL.
    let storagePath: string | undefined;
    let urlBucket: string | undefined;

    if (typeof data.coverImageUrl === "string" && data.coverImageUrl.includes("/o/")) {
      const resolved = resolveFromUrl(data.coverImageUrl);
      if (resolved?.path) {
        storagePath = resolved.path;
        urlBucket = resolved.bucket;
      }
    }

    // Fall back to coverStoragePath if coverImageUrl absent or unparseable
    if (!storagePath) {
      storagePath = data.coverStoragePath;
    }

    if (!storagePath) {
      // No explicit cover set — fall back to the first photo in the album
      const firstPhotoSnap = await adminDb()
        .collection("memoryMedia")
        .where("albumId", "==", albumId)
        .where("type", "==", "photo")
        .limit(1)
        .get();

      if (!firstPhotoSnap.empty) {
        const photoData = firstPhotoSnap.docs[0].data();
        storagePath = photoData.storagePath;
        if (!storagePath && typeof photoData.url === "string") {
          const resolved = resolveFromUrl(photoData.url);
          if (resolved?.path) {
            storagePath = resolved.path;
            urlBucket = resolved.bucket;
          }
        }
      }

      if (!storagePath) {
        return new NextResponse("No cover image available for this album", { status: 404 });
      }
    }

    // ── 3. Download original cover from Firebase Storage via Admin SDK ────────
    // Try the bucket embedded in the URL first (most accurate).
    // Fall back to the project-default bucket if the URL bucket fails.
    const defaultBucket = adminStorage();
    const bucketsToTry = urlBucket
      ? [adminStorageBucket(urlBucket), defaultBucket]
      : [defaultBucket];

    // Deduplicate in case urlBucket === defaultBucket name
    const seen = new Set<string>();
    const uniqueBuckets = bucketsToTry.filter(b => {
      const n = b.name;
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });

    let originalBuffer: Buffer | undefined;
    let lastError: unknown;
    for (const bucket of uniqueBuckets) {
      try {
        const [downloaded] = await bucket.file(storagePath).download();
        originalBuffer = downloaded;
        break;
      } catch (storageErr: unknown) {
        lastError = storageErr;
        const code = (storageErr as { code?: number })?.code;
        if (code !== 404) throw storageErr; // non-404 errors bubble up immediately
        // 404 → try next bucket
      }
    }

    if (!originalBuffer) {
      console.warn("[memories/cover] Cover not found in any bucket", { albumId, storagePath, urlBucket });
      return new NextResponse("Cover image not found in storage", { status: 404 });
    }

    // ── 4. Resize with sharp ─────────────────────────────────────────────────
    const resized = await sharp(originalBuffer as Buffer)
      .resize({
        width: maxDim,
        height: maxDim,
        fit: "inside",           // preserve aspect ratio, never upscale
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
    console.error("[memories/cover] Error serving cover image", { albumId, size }, err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the storage path AND bucket name from a Firebase Storage download URL.
 * Handles both bucket formats:
 *   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=XXXX
 * The encoded path segment is URL-encoded, so decodeURIComponent is required.
 * Returns both the object path and the bucket name so the proxy can target the
 * exact bucket the file lives in — critical when albums span multiple buckets.
 */
function resolveFromUrl(url: string): { path: string; bucket?: string } | undefined {
  try {
    const pathMatch = url.match(/\/o\/(.+?)(?:\?|$)/);
    if (!pathMatch?.[1]) return undefined;
    const path = decodeURIComponent(pathMatch[1]);

    // Extract bucket name from /v0/b/{bucket}/o/ segment
    const bucketMatch = url.match(/\/b\/([^/]+)\/o\//);
    const bucket = bucketMatch?.[1] ? decodeURIComponent(bucketMatch[1]) : undefined;

    return { path, bucket };
  } catch {
    return undefined;
  }
}

/** Get a specific named bucket from the Admin Storage singleton. */
function adminStorageBucket(bucketName: string) {
  const { getStorage } = require("firebase-admin/storage") as typeof import("firebase-admin/storage");
  return getStorage().bucket(bucketName);
}
