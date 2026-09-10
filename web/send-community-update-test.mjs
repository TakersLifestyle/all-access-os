// send-community-update-test.mjs
// Sends the "A lot has happened since you signed up" email to ONE test address.
// Run: node send-community-update-test.mjs
// After approval, run send-community-update-all.mjs to reach all 53 users.

import { Resend } from "resend";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

const resend = new Resend(getEnv("RESEND_API_KEY"));
const FROM   = "ALL ACCESS <hello@allaccesswinnipeg.ca>";
const TO     = "tharealprincecharles@gmail.com";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A lot has happened since you signed up — ALL ACCESS Winnipeg</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<!-- Preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;">Two sold-out events. 4,000+ photos. DJ LANKZ &amp; SKALES on Oct 9. Here's everything you missed — and what's next.&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;">
<tr><td align="center" style="padding:24px 16px 48px;">

  <!-- Card -->
  <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#0f0f0f;border-radius:20px;overflow:hidden;border:1px solid #1e1e1e;">

    <!-- Wordmark -->
    <tr><td style="padding:28px 36px 0;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.22em;color:#ff007f;text-transform:uppercase;">ALL ACCESS <span style="color:rgba(255,255,255,0.2);font-weight:500;letter-spacing:0.1em;">· Winnipeg</span></p>
    </td></tr>

    <!-- Inner card -->
    <tr><td style="padding:20px 24px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:18px;overflow:hidden;">

      <!-- Greeting + Headline -->
      <tr><td style="padding:30px 30px 0;">
        <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.38);line-height:1.65;">Hey — you're part of the ALL ACCESS community. Whether you've been with us from the start or things got busy and life happened, we just wanted to reach out and show you everything that's been going on.</p>
        <p style="margin:0 0 6px;font-size:30px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-0.8px;">A lot has happened</p>
        <p style="margin:0 0 10px;font-size:30px;font-weight:900;color:#ff007f;line-height:1.1;letter-spacing:-0.8px;">since you signed up.</p>
        <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.38);line-height:1.65;">Two sold-out events. Seven community nights. Hundreds of people. Over 4,000 photos. And something big coming October 9th.</p>
      </td></tr>

      <!-- Stats strip -->
      <tr><td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="padding:18px 8px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:26px;font-weight:900;color:#ff007f;letter-spacing:-1px;">2</p>
              <p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.22);">Sold Out Events</p>
            </td>
            <td style="padding:18px 8px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:26px;font-weight:900;color:#ff007f;letter-spacing:-1px;">7+</p>
              <p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.22);">Community Nights</p>
            </td>
            <td style="padding:18px 8px;text-align:center;">
              <p style="margin:0;font-size:26px;font-weight:900;color:#ff007f;letter-spacing:-1px;">4K+</p>
              <p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.22);">Photos Captured</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- What we've been up to label -->
      <tr><td style="padding:22px 30px 10px;">
        <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.2);">What we've been up to</p>
      </td></tr>

      <!-- Sea Bears event -->
      <tr><td style="padding:0 20px 6px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.02);border-radius:12px;">
          <tr>
            <td style="padding:14px 12px;" width="52">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.2);text-align:center;line-height:38px;font-size:18px;">🏀</div>
            </td>
            <td style="padding:14px 0;">
              <p style="margin:0;font-size:13px;font-weight:800;color:rgba(255,255,255,0.85);">ALL ACCESS Founding 15 — Sea Bears Courtside</p>
              <p style="margin:3px 0 0;font-size:11px;color:rgba(255,255,255,0.28);">Private dinner · Group transport · Courtside seats · Winnipeg Sea Bears</p>
            </td>
            <td style="padding:14px 12px;" align="right">
              <span style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:4px 9px;border-radius:100px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.22);color:rgba(255,110,100,0.9);white-space:nowrap;">Sold Out</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- ROCAFIESTA event -->
      <tr><td style="padding:0 20px 6px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.02);border-radius:12px;">
          <tr>
            <td style="padding:14px 12px;" width="52">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(236,72,153,0.12);border:1px solid rgba(236,72,153,0.2);text-align:center;line-height:38px;font-size:18px;">🎉</div>
            </td>
            <td style="padding:14px 0;">
              <p style="margin:0;font-size:13px;font-weight:800;color:rgba(255,255,255,0.85);">ROCAFIESTA — A Spiritual Experience with Konfam</p>
              <p style="margin:3px 0 0;font-size:11px;color:rgba(255,255,255,0.28);">317 photos live on the platform now · Free to view</p>
            </td>
            <td style="padding:14px 12px;" align="right">
              <span style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:4px 9px;border-radius:100px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.22);color:rgba(255,110,100,0.9);white-space:nowrap;">Sold Out</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Skales event -->
      <tr><td style="padding:0 20px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(132,204,22,0.05);border:1px solid rgba(132,204,22,0.12);border-radius:12px;">
          <tr>
            <td style="padding:14px 12px;" width="52">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.18);text-align:center;line-height:38px;font-size:18px;">🎤</div>
            </td>
            <td style="padding:14px 0;">
              <p style="margin:0;font-size:13px;font-weight:800;color:rgba(255,255,255,0.85);">DJ LANKZ &amp; FRIENDS ft. SKALES — Oct 9, 2026</p>
              <p style="margin:3px 0 0;font-size:11px;color:rgba(255,255,255,0.28);">GA $35 · VIP Skip the Line $50 · Members pay $24.50</p>
            </td>
            <td style="padding:14px 12px;" align="right">
              <span style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:4px 9px;border-radius:100px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.22);color:rgba(163,230,53,0.9);white-space:nowrap;">Up Next</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:0 30px;"><hr style="border:none;border-top:1px dashed rgba(255,255,255,0.07);margin:0 0 24px;"></td></tr>

      <!-- Membership box -->
      <tr><td style="padding:0 20px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e0e0e;border:1px solid rgba(255,0,127,0.15);border-radius:14px;overflow:hidden;">
          <!-- Head -->
          <tr><td style="padding:14px 20px;background:rgba(255,0,127,0.07);border-bottom:1px solid rgba(255,0,127,0.1);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td><p style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#ff007f;">Go ALL ACCESS</p></td>
              <td align="right"><p style="margin:0;font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;">$10<span style="font-size:12px;font-weight:500;color:rgba(255,255,255,0.3);">/mo CAD</span></p></td>
            </tr></table>
          </td></tr>
          <!-- Perks -->
          <tr><td style="padding:4px 20px 14px;">
            <!-- Perk 1 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid rgba(255,255,255,0.04);">
              <tr><td style="padding:10px 0;" width="28">📸</td>
              <td style="padding:10px 0;">
                <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.8);">Download 4,000+ photos</p>
                <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.27);">Every event. Full resolution. Yours forever.</p>
              </td></tr>
            </table>
            <!-- Perk 2 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid rgba(255,255,255,0.04);">
              <tr><td style="padding:10px 0;" width="28">🎟</td>
              <td style="padding:10px 0;">
                <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.8);">30% off every ticket</p>
                <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.27);">Skales GA: <span style="text-decoration:line-through;">$35</span> → <span style="color:rgba(132,204,22,0.85);font-weight:700;">$24.50</span>. Pays for itself in one ticket.</p>
              </td></tr>
            </table>
            <!-- Perk 3 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid rgba(255,255,255,0.04);">
              <tr><td style="padding:10px 0;" width="28">⚡</td>
              <td style="padding:10px 0;">
                <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.8);">Early access — before events sell out</p>
                <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.27);">Both events above sold out. Members always get in first.</p>
              </td></tr>
            </table>
            <!-- Perk 4 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding:10px 0;" width="28">🖤</td>
              <td style="padding:10px 0;">
                <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.8);">Fund the community directly</p>
                <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.27);">ALL ACCESS is a non-profit. Your $10/mo keeps Winnipeg moving.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- CTAs -->
      <tr><td style="padding:0 20px 26px;">
        <a href="https://allaccesswinnipeg.ca/membership" style="display:block;background:#ff007f;color:#fff;text-align:center;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:16px 24px;border-radius:10px;margin-bottom:10px;">Go ALL ACCESS — $10/mo →</a>
        <a href="https://allaccesswinnipeg.ca/events" style="display:block;background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);text-align:center;text-decoration:none;font-size:12px;font-weight:600;padding:13px 24px;border-radius:10px;margin-bottom:8px;">Get Skales Tickets — Oct 9</a>
        <p style="margin:6px 0 0;text-align:center;font-size:11px;color:rgba(255,255,255,0.13);">Cancel anytime · No contracts · Community first</p>
      </td></tr>

      <!-- Card bottom -->
      <tr><td style="background:#0e0e0e;border-top:1px solid rgba(255,255,255,0.05);padding:16px 30px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.18);">Winnipeg, together. 🖤</p>
      </td></tr>

    </table><!-- /inner card -->
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:22px 36px 30px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#ff007f;">ALL ACCESS</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.13);line-height:1.7;">
        Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:rgba(255,255,255,0.22);text-decoration:none;">hello@allaccesswinnipeg.ca</a><br>
        Winnipeg, MB, Canada
      </p>
      <p style="margin:10px 0 0;font-size:10px;color:rgba(255,255,255,0.08);">You're receiving this because you have an account at allaccesswinnipeg.ca.</p>
    </td></tr>

  </table><!-- /card -->

</td></tr>
</table>

</body>
</html>`;

console.log("Sending test email to", TO, "...");
const { data, error } = await resend.emails.send({
  from: FROM,
  to: TO,
  subject: "A lot has happened since you signed up 🖤 — ALL ACCESS Winnipeg",
  html,
});

if (error) {
  console.error("❌ Failed:", error);
  process.exit(1);
}

console.log("✅ Test email sent! Resend ID:", data.id);
console.log("   Check your inbox at", TO);
process.exit(0);
