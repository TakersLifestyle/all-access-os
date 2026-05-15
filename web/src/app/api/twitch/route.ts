/**
 * GET /api/twitch
 *
 * Checks if the takerslifestyle Twitch channel is currently live.
 * Returns stream metadata if live, null if offline.
 *
 * Requires env vars:
 *   TWITCH_CLIENT_ID     — from dev.twitch.tv app
 *   TWITCH_CLIENT_SECRET — from dev.twitch.tv app
 *
 * Without env vars: returns { live: false, configured: false }
 * so the embed still shows (Twitch handles the offline state).
 *
 * Response is cached for 60s at the edge to avoid hammering the API.
 */

import { NextResponse } from "next/server";

const TWITCH_CHANNEL = "takerslifestyle";

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TwitchStream {
  id: string;
  user_name: string;
  title: string;
  viewer_count: number;
  game_name: string;
  thumbnail_url: string;
  started_at: string;
  tags: string[];
}

async function getAppToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST", signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data: TwitchTokenResponse = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function getStreamStatus(
  clientId: string,
  token: string
): Promise<TwitchStream | null> {
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export const revalidate = 60; // cache 60s at edge

export async function GET() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  // No credentials configured — return safe fallback
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        live: false,
        configured: false,
        channel: TWITCH_CHANNEL,
        note: "Add TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET to Vercel env to enable live status.",
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  }

  const token = await getAppToken(clientId, clientSecret);
  if (!token) {
    return NextResponse.json(
      { live: false, configured: true, channel: TWITCH_CHANNEL, error: "Token fetch failed" },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }

  const stream = await getStreamStatus(clientId, token);

  if (!stream) {
    return NextResponse.json(
      { live: false, configured: true, channel: TWITCH_CHANNEL },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  }

  return NextResponse.json(
    {
      live: true,
      configured: true,
      channel: TWITCH_CHANNEL,
      title: stream.title,
      viewerCount: stream.viewer_count,
      game: stream.game_name,
      startedAt: stream.started_at,
      thumbnailUrl: stream.thumbnail_url
        .replace("{width}", "1280")
        .replace("{height}", "720"),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
