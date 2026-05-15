/**
 * GET /api/social/status
 *
 * Returns which social API integrations are configured.
 * Safe to call from the client — only returns booleans, no secrets.
 */

import { NextResponse } from "next/server";

export const revalidate = 0; // no caching — always fresh

export async function GET() {
  return NextResponse.json({
    instagram: Boolean(process.env.INSTAGRAM_GRAPH_TOKEN),
    twitch: Boolean(
      process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET
    ),
    instagramConfigured: Boolean(process.env.INSTAGRAM_GRAPH_TOKEN),
    twitchConfigured: Boolean(
      process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET
    ),
  });
}
