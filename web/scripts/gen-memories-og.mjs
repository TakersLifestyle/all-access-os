/**
 * Generates /public/og/memories-og.jpg — 1200×630 static social preview
 * Run: node scripts/gen-memories-og.mjs  (from web/ directory)
 *
 * Layout:
 *   Left half (600×630): sea-bears-courtside — large anchor photo
 *   Right half — 4-panel grid (300×315 each):
 *     TR1 (600,0):   winnipeg-after-dark
 *     TR2 (900,0):   konfam-1
 *     BR1 (600,315): skales-live-2
 *     BR2 (900,315): danagog
 *
 *   Overlays:
 *     - Left-side dark gradient (so text is readable)
 *     - Bottom vignette
 *     - ALL ACCESS badge, 4,000+ headline, tagline
 *     - Pink accent bar (left edge)
 *     - Thin separator lines between panels
 */

import sharp from "sharp";
import { createReadStream } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const W = 1200;
const H = 630;

// Thin 1px gap between panels (black)
const GAP = 1;

async function panel(file, w, h) {
  return sharp(file)
    .resize(w, h, { fit: "cover", position: "center" })
    .toBuffer();
}

const svgText = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Strong left fade so text pops -->
    <linearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.88"/>
      <stop offset="55%"  stop-color="#000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <!-- Bottom vignette -->
    <linearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0"/>
      <stop offset="60%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.75"/>
    </linearGradient>
  </defs>

  <!-- Gradient overlays -->
  <rect width="${W}" height="${H}" fill="url(#fadeL)"/>
  <rect width="${W}" height="${H}" fill="url(#fadeB)"/>

  <!-- Pink left accent bar -->
  <rect x="0" y="0" width="5" height="${H}" fill="#ec4899"/>

  <!-- Brand badge -->
  <rect x="24" y="28" rx="6" ry="6" width="170" height="26" fill="#ec489922" stroke="#ec489955" stroke-width="1"/>
  <text x="36" y="45" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700"
        fill="#f9a8d4" letter-spacing="2.5">ALL ACCESS WINNIPEG</text>

  <!-- "4,000+" — main headline -->
  <!-- "4,000" in white -->
  <text x="22" y="230" font-family="Arial Black,Impact,Helvetica,sans-serif"
        font-size="138" font-weight="900" fill="white">4,000</text>
  <!-- "+" in pink immediately after — positioned manually -->
  <text x="380" y="230" font-family="Arial Black,Impact,Helvetica,sans-serif"
        font-size="138" font-weight="900" fill="#ec4899">+</text>

  <!-- "COMMUNITY MEMORIES" label -->
  <text x="24" y="275" font-family="Arial,Helvetica,sans-serif"
        font-size="20" font-weight="700" fill="white" letter-spacing="4.5"
        text-transform="uppercase">COMMUNITY MEMORIES</text>

  <!-- Thin rule under label -->
  <rect x="24" y="284" width="450" height="1" fill="#ec4899" opacity="0.55"/>

  <!-- Tagline -->
  <text x="24" y="316" font-family="Arial,Helvetica,sans-serif"
        font-size="16" fill="white" opacity="0.7">
    Winnipeg, you might be in here.
  </text>

  <!-- Bottom domain label -->
  <text x="24" y="${H - 22}" font-family="Arial,Helvetica,sans-serif"
        font-size="13" fill="white" opacity="0.45" letter-spacing="0.5">
    allaccesswinnipeg.ca/memories
  </text>

  <!-- Separator lines between panels -->
  <rect x="599" y="0" width="${GAP}" height="${H}" fill="#000" opacity="0.6"/>
  <rect x="899" y="0" width="${GAP}" height="${H}" fill="#000" opacity="0.6"/>
  <rect x="600" y="314" width="600" height="${GAP}" fill="#000" opacity="0.6"/>
</svg>`;

async function generate() {
  console.log("Building Memories OG collage…");

  const [leftBuf, tr1, tr2, br1, br2] = await Promise.all([
    panel("public/events/sea-bears-courtside.jpg", 600, H),
    panel("public/events/winnipeg-after-dark.jpg", 300, 315),
    panel("public/events/konfam-1.jpg",            300, 315),
    panel("public/events/skales-live-2.jpg",       300, 315),
    panel("public/events/danagog.jpg",              300, 315),
  ]);

  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  })
    .composite([
      { input: leftBuf, top: 0,   left: 0   },
      { input: tr1,     top: 0,   left: 600 },
      { input: tr2,     top: 0,   left: 900 },
      { input: br1,     top: 315, left: 600 },
      { input: br2,     top: 315, left: 900 },
      { input: Buffer.from(svgText), top: 0, left: 0 },
    ])
    .jpeg({ quality: 88 })
    .toFile("public/og/memories-og.jpg");

  console.log("✓  public/og/memories-og.jpg written (1200×630)");
}

generate().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
