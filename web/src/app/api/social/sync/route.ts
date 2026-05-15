/**
 * POST /api/social/sync
 *
 * Admin-only endpoint. Fetches latest posts from configured platforms
 * and upserts them into the Firestore `socialFeed` collection.
 *
 * Platforms:
 *   - Instagram: Graph API (requires INSTAGRAM_GRAPH_TOKEN)
 *   - Twitch: Helix API (requires TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET)
 *   - TikTok: No "fetch my posts" public API — manual URL entry only
 *
 * Auth: Authorization: Bearer {Firebase ID Token} with admin custom claim
 *
 * Returns: { instagramAdded, instagramUpdated, twitchLive, errors }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.role === "admin";
  } catch {
    return false;
  }
}

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
  if (!token) return [];

  try {
    const url = new URL("https://graph.instagram.com/me/media");
    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "20");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message ?? `Instagram API returned ${res.status}`
      );
    }

    const data = await res.json();
    return (data.data ?? []) as IGMedia[];
  } catch (err) {
    throw new Error(
      `Instagram fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function igMediaToFeedPost(media: IGMedia) {
  // For VIDEO posts use thumbnail_url; for IMAGE / CAROUSEL use media_url
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
    source: "instagram_sync",
    syncedAt: new Date().toISOString(),
  };
}

// ── Twitch Helix API ──────────────────────────────────────────────────────────

async function getTwitchAppToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchTwitchStatus(): Promise<{
  live: boolean;
  title?: string;
  viewerCount?: number;
  game?: string;
  thumbnailUrl?: string;
} | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const appToken = await getTwitchAppToken();
  if (!clientId || !appToken) return null;

  try {
    const res = await fetch(
      "https://api.twitch.tv/helix/streams?user_login=takerslifestyle",
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${appToken}`,
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const stream = data.data?.[0];
    if (!stream) return { live: false };

    const thumbnailUrl = stream.thumbnail_url
      ?.replace("{width}", "640")
      ?.replace("{height}", "360");

    return {
      live: true,
      title: stream.title,
      viewerCount: stream.viewer_count,
      game: stream.game_name,
      thumbnailUrl,
    };
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verify admin
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const errors: string[] = [];
  let instagramAdded = 0;
  let instagramUpdated = 0;
  let twitchLive: boolean | undefined;

  // ── Instagram sync ────────────────────────────────────
  if (process.env.INSTAGRAM_GRAPH_TOKEN) {
    try {
      const posts = await fetchInstagramPosts();

      for (const media of posts) {
        const feedPost = igMediaToFeedPost(media);
        // Use deterministic doc ID based on Instagram post ID
        const docId = `ig_${media.id}`;
        const docRef = db.collection("socialFeed").doc(docId);
        const existing = await docRef.get();

        if (!existing.exists) {
          await docRef.set(feedPost);
          instagramAdded++;
        } else {
          // Update imageUrl and caption (they can change)
          await docRef.update({
            imageUrl: feedPost.imageUrl,
            caption: feedPost.caption,
            syncedAt: feedPost.syncedAt,
          });
          instagramUpdated++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.error("[social/sync] Instagram error:", msg);
    }
  }

  // ── Twitch status ─────────────────────────────────────
  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    try {
      const status = await fetchTwitchStatus();
      if (status) {
        twitchLive = status.live;
        // Store in config doc for display on Connect page
        await db.collection("config").doc("twitch").set(
          {
            live: status.live,
            title: status.title ?? null,
            viewerCount: status.viewerCount ?? null,
            game: status.game ?? null,
            thumbnailUrl: status.thumbnailUrl ?? null,
            checkedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Twitch: ${msg}`);
    }
  }

  // ── Update last sync timestamp ────────────────────────
  await db
    .collection("config")
    .doc("social")
    .set(
      {
        lastSyncedAt: new Date().toISOString(),
        lastSyncResults: {
          instagramAdded,
          instagramUpdated,
          twitchLive: twitchLive ?? null,
          errors,
        },
      },
      { merge: true }
    );

  return NextResponse.json({
    success: true,
    instagramAdded,
    instagramUpdated,
    twitchLive,
    errors,
  });
}
