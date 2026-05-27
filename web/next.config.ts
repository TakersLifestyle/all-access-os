import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // ─────────────────────────────────────────────────────────────────────────
  // Monorepo: tell Next.js to trace files from the repo root so Vercel's
  // outputFileTracingRoot and this value agree (both resolve to the parent
  // of web/).  Fixes: "Both outputFileTracingRoot and turbopack.root are set
  // but must have the same value."
  // ─────────────────────────────────────────────────────────────────────────
  outputFileTracingRoot: path.resolve(__dirname, ".."),

  // ─────────────────────────────────────────────────────────────────────────
  // Expose image provider type to the client bundle at build time.
  // Reads server-side env vars during the Vercel build and bakes the result
  // into process.env.NEXT_PUBLIC_IMAGE_PROVIDER — no runtime API call needed.
  // Values: "openai" | "replicate" | "stability" | "none"
  // ─────────────────────────────────────────────────────────────────────────
  env: {
    NEXT_PUBLIC_IMAGE_PROVIDER: process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.REPLICATE_API_KEY
      ? "replicate"
      : process.env.STABILITY_API_KEY
      ? "stability"
      : "none",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 301 Permanent redirects — SEO-safe, HTTPS-enforced
  //
  // allaccesswinnipeg.com  →  allaccesswinnipeg.ca  (all paths preserved)
  // takerslifestyle.com    →  allaccesswinnipeg.ca  (brand consolidation)
  // takerslifestyle.ca     →  allaccesswinnipeg.ca
  //
  // Vercel handles HTTPS automatically. This redirect fires at the edge
  // before any page renders — fastest possible redirect, no JS needed.
  // ─────────────────────────────────────────────────────────────────────────
  async redirects() {
    return [
      // .com → .ca (all routes + query params preserved)
      {
        source: "/:path*",
        has: [{ type: "host", value: "allaccesswinnipeg.com" }],
        destination: "https://allaccesswinnipeg.ca/:path*",
        permanent: true,
      },
      // www.com → .ca
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.allaccesswinnipeg.com" }],
        destination: "https://allaccesswinnipeg.ca/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
