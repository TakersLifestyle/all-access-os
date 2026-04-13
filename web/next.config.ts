import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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
