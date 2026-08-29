/**
 * GET /api/cron/social-sync
 *
 * Vercel Cron Job endpoint — runs on schedule (see vercel.json).
 * Fetches recent Instagram posts and upserts them into Firestore `socialFeed`.
 *
 * Auth: Vercel automatically passes CRON_SECRET as Authorization header
 * for cron invocations. Manual calls must include:
 *   Authorization: Bearer {CRON_SECRET}
 *
 * Requires env vars:
 *   CRON_SECRET            — shared secret for cron auth
 *   INSTAGRAM_GRAPH_TOKEN  — long-lived Instagram Graph API user token
 *
 * The endpoint is intentionally GET (Vercel cron must use GET).
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// Vercel marks cron routes as dynamic
export const dynamic = "force-dynamic";

// ── Instagram Graph API ───────────────────────────────────────────────────────

interface IGMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

async function fetchInstagramPosts(): Promise<IGMedia[]> {
  const token = process.env.INSTAGRAM_GRAPH_TOKEN;
  if (!token) throw new Error("INSTAGRAM_GRAPH_TOKEN not set");

  const url = new URL("https://graph.instagram.com/me/media");
  url.searchParams.set(
    "fields",
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 0 }, // always fresh
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ?? `Instagram API ${res.status}: ${res.statusText}`
    );
  }

  const data = await res.json();
  return (data.data ?? []) as IGMedia[];
}

function igToFeedDoc(media: IGMedia) {
  const imageUrl =
    media.media_type === "VIDEO"
      ? (media.thumbnail_url ?? "")
      : (media.media_url ?? "");

  return {
    platform: "instagram" as const,
    postUrl: media.permalink,
    imageUrl,
    caption: media.caption ?? "",
    postedAt: media.timestamp,
    status: "published" as const,
    source: "instagram_cron",
    syncedAt: new Date().toISOString(),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth — Vercel passes CRON_SECRET as Bearer token ─────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron/social-sync] CRON_SECRET env var not set — refusing");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const incoming = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (incoming !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Skip if no Instagram token configured ─────────────────────────────────
  if (!process.env.INSTAGRAM_GRAPH_TOKEN) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "INSTAGRAM_GRAPH_TOKEN not configured",
    });
  }

  const db = adminDb();
  let added = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    const posts = await fetchInstagramPosts();

    for (const media of posts) {
      const docId = `ig_${media.id}`;
      const docRef = db.collection("socialFeed").doc(docId);
      const existing = await docRef.get();
      const feedDoc = igToFeedDoc(media);

      if (!existing.exists) {
        await docRef.set(feedDoc);
        added++;
      } else {
        // Refresh image URL and caption (they can change on Instagram)
        await docRef.update({
          imageUrl: feedDoc.imageUrl,
          caption: feedDoc.caption,
          syncedAt: feedDoc.syncedAt,
        });
        updated++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    console.error("[cron/social-sync] Instagram error:", msg);
  }

  // ── Record last sync time ─────────────────────────────────────────────────
  await db
    .collection("config")
    .doc("social")
    .set(
      {
        lastCronSyncAt: new Date().toISOString(),
        lastCronResults: { added, updated, errors },
      },
      { merge: true }
    );

  console.log(`[cron/social-sync] done — added: ${added}, updated: ${updated}, errors: ${errors.length}`);

  return NextResponse.json({
    success: errors.length === 0,
    added,
    updated,
    errors,
    syncedAt: new Date().toISOString(),
  });
}
