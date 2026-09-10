/**
 * ROCAFIESTA — Apology / clarification email to all 10 buyers.
 * Addresses the 3 duplicate emails sent this morning.
 * Run: cd functions && node send-rocafiesta-apology.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";
const ACCENT = "#ec4899";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>One Quick Note — ROCAFIESTA</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- Brand -->
  <tr><td style="padding:0 0 24px;text-align:center;">
    <span style="font-size:12px;font-weight:800;letter-spacing:.22em;color:${ACCENT};text-transform:uppercase;">ALL ACCESS</span>
    <span style="color:#ffffff20;margin:0 8px;">&bull;</span>
    <span style="font-size:11px;font-weight:500;letter-spacing:.08em;color:#ffffff30;text-transform:uppercase;">Winnipeg</span>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#111;border:1px solid rgba(236,72,153,0.2);border-radius:20px;overflow:hidden;">
    <div style="padding:36px 36px 32px;">

      <!-- Eyebrow -->
      <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${ACCENT};">A note from the team</p>

      <!-- Heading -->
      <h1 style="margin:0 0 22px;font-size:22px;font-weight:800;line-height:1.25;letter-spacing:-.01em;color:#fff;">You may have received a few emails from us this morning &mdash; here&rsquo;s what to know.</h1>

      <!-- Apology block -->
      <div style="background:rgba(236,72,153,0.07);border-left:4px solid ${ACCENT};border-radius:0 10px 10px 0;padding:18px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:${ACCENT};letter-spacing:.02em;">We sincerely apologize. 🙏</p>
        <p style="margin:0;font-size:13px;color:#ffffffbb;line-height:1.75;">
          As part of our <strong style="color:#fff;">24-hour ROCAFIESTA countdown</strong>, we sent your ticket email this morning &mdash;
          but we ran into a couple of technical issues and ended up sending a few versions by mistake.
          That was on us, and we are truly sorry for the confusion.
        </p>
      </div>

      <p style="margin:0 0 16px;font-size:14px;color:#ffffffbb;line-height:1.75;">Here&rsquo;s all you need to know:</p>

      <!-- Use this email -->
      <div style="background:rgba(236,72,153,0.08);border:1px solid rgba(236,72,153,0.2);border-radius:12px;padding:18px 20px;margin-bottom:14px;">
        <p style="margin:0 0 4px;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${ACCENT};">✅ Use this email</p>
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#fff;">&ldquo;See You TOMORROW &mdash; Your ROCAFIESTA Ticket + QR Code Inside&rdquo;</p>
        <p style="margin:0;font-size:12px;color:#ffffff40;">Received at 9:58 AM &mdash; correct date, correct price, working QR code</p>
      </div>

      <!-- Disregard -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid #ffffff08;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffffff25;">Please disregard these earlier emails</p>
        <p style="margin:0 0 4px;font-size:12px;color:#ffffff30;"><span style="color:#ef4444;font-weight:700;">✕</span> &nbsp;&ldquo;See You TONIGHT &mdash; Your ROCAFIESTA Ticket + QR Code Inside&rdquo;</p>
        <p style="margin:0;font-size:12px;color:#ffffff30;"><span style="color:#ef4444;font-weight:700;">✕</span> &nbsp;&ldquo;Your Ticket &mdash; ROCAFIESTA (Sep 5, 2026) &mdash; Scan at Door&rdquo;</p>
      </div>

      <p style="margin:0 0 16px;font-size:14px;color:#ffffffbb;line-height:1.75;">
        Your latest email has your <strong style="color:#fff;">correct QR code</strong> &mdash;
        just show it at the door tomorrow night and you&rsquo;re in. That&rsquo;s all you need.
      </p>

      <p style="margin:0 0 24px;font-size:14px;color:#ffffffbb;line-height:1.75;">
        We cannot wait to see you. <strong style="color:#fff;">Tomorrow is going to be something special.</strong>
        Red carpet, great energy, great people &mdash; ROCAFIESTA is going to be a night to remember. 🖤
      </p>

      <p style="margin:0 0 24px;font-size:13px;color:#ffffff50;line-height:1.75;">
        Any questions? Reply to this email or reach us at
        <a href="mailto:hello@allaccesswinnipeg.ca" style="color:${ACCENT};text-decoration:none;">hello@allaccesswinnipeg.ca</a>.
      </p>

      <!-- Sign off -->
      <div style="padding-top:20px;border-top:1px dashed #ffffff10;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#ffffffcc;">With love,</p>
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${ACCENT};">ALL ACCESS <span style="font-weight:400;color:#ffffff30;letter-spacing:0;text-transform:none;">&middot; Winnipeg</span></p>
        <p style="margin:0;font-size:12px;color:#ffffff30;">Community first. Always.</p>
      </div>

    </div>
  </td></tr>

  <tr><td style="height:28px;"></td></tr>

  <!-- Footer -->
  <tr><td style="text-align:center;padding:0 16px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.18em;color:${ACCENT};text-transform:uppercase;">ALL ACCESS</p>
    <p style="margin:0;font-size:11px;color:#ffffff18;line-height:1.6;">
      <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#ffffff25;text-decoration:none;">hello@allaccesswinnipeg.ca</a>
      &nbsp;&bull;&nbsp; Winnipeg, MB, Canada
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

// Fetch all paid orders
const orders = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .where("paymentStatus", "==", "paid")
  .get();

console.log(`Found ${orders.size} paid orders\n`);

let sent = 0;
let failed = 0;

for (const doc of orders.docs) {
  const o = doc.data();
  const toEmail = o.userEmail ?? null;

  if (!toEmail) {
    console.log(`⚠  ${doc.id} — no email, skipping`);
    failed++;
    continue;
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    "ALL ACCESS <hello@allaccesswinnipeg.ca>",
      to:      [toEmail],
      subject: "One Quick Note Before Tomorrow Night — ROCAFIESTA 🖤",
      html,
    }),
  });

  const result = await resp.json();

  if (!resp.ok) {
    console.error(`✗ ${doc.id} → ${toEmail}: ${JSON.stringify(result)}`);
    failed++;
  } else {
    console.log(`✓ ${doc.id} → ${toEmail} | Resend: ${result.id}`);
    sent++;
  }

  await new Promise(r => setTimeout(r, 350));
}

console.log(`\n✅ Done — ${sent} sent, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
