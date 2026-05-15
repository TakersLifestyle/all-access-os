/**
 * POST /api/social-feed
 *
 * Auto-fetches metadata (thumbnail, caption) from a TikTok or Instagram URL
 * using public oEmbed APIs. Returns structured data ready to save to Firestore.
 *
 * TikTok oEmbed: works without auth for public videos.
 * Instagram oEmbed: requires Graph API token — returns null for now.
 *                   Phase 2: add INSTAGRAM_GRAPH_TOKEN env var to unlock.
 *
 * Body: { url: string }
 * Returns: { platform, imageUrl, caption, title, authorName } | { error }
 */

import { NextRequest, NextResponse } from "next/server";

interface OEmbedResult {
  platform: "instagram" | "tiktok";
  imageUrl: string | null;
  caption: string;
  title: string;
  authorName: string;
}

async function fetchTikTokOEmbed(url: string): Promise<OEmbedResult | null> {
  try {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "ALL ACCESS Social Feed Bot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      platform: "tiktok",
      imageUrl: data.thumbnail_url ?? null,
      caption: data.title ?? "",
      title: data.title ?? "",
      authorName: data.author_name ?? "@allaccesswinnipeg",
    };
  } catch {
    return null;
  }
}

async function fetchInstagramOEmbed(url: string): Promise<OEmbedResult | null> {
  const token = process.env.INSTAGRAM_GRAPH_TOKEN;
  if (!token) {
    // Phase 2: add INSTAGRAM_GRAPH_TOKEN to unlock auto-fetch
    return null;
  }
  try {
    const endpoint = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${token}&fields=thumbnail_url,title,author_name`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      platform: "instagram",
      imageUrl: data.thumbnail_url ?? null,
      caption: data.title ?? "",
      title: data.title ?? "",
      authorName: data.author_name ?? "@allaccesswinnipeg",
    };
  } catch {
    return null;
  }
}

function detectPlatform(url: string): "instagram" | "tiktok" | null {
  if (url.includes("instagram.com") || url.includes("instagr.am")) return "instagram";
  if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) return "tiktok";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return NextResponse.json(
        { error: "URL must be from Instagram or TikTok" },
        { status: 400 }
      );
    }

    let result: OEmbedResult | null = null;
    if (platform === "tiktok") {
      result = await fetchTikTokOEmbed(url);
    } else {
      result = await fetchInstagramOEmbed(url);
    }

    if (!result) {
      // Return partial result — admin fills in the rest manually
      return NextResponse.json({
        platform,
        imageUrl: null,
        caption: "",
        title: "",
        authorName: "@allaccesswinnipeg",
        autoFetched: false,
        note:
          platform === "instagram"
            ? "Instagram auto-fetch requires INSTAGRAM_GRAPH_TOKEN. Fill in image + caption manually."
            : "Could not auto-fetch TikTok data. Fill in image + caption manually.",
      });
    }

    return NextResponse.json({ ...result, autoFetched: true });
  } catch (err) {
    console.error("[social-feed] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
