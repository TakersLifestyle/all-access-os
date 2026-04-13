// Membership welcome email HTML template
// Sent once after checkout.session.completed confirms a new subscription

export interface MembershipWelcomeData {
  firstName: string;
  amountPaid: string;   // e.g. "$50.00"
  date: string;         // e.g. "Saturday, April 12, 2026"
  transactionId: string;
  loginUrl: string;
}

export function membershipWelcomeHtml(d: MembershipWelcomeData): string {
  const perks: [string, string, string][] = [
    ["🎉", "Exclusive Events", "Private rooftop parties, VIP nights, courtside seats, mansion parties."],
    ["🎁", "Real Perks", "Restaurant discounts, free entry, photoshoots, gym passes — usable immediately."],
    ["👥", "The Network", "A curated group of people who actually move. Connect, collaborate, level up."],
    ["⭐", "Founding Member Status", "You locked in the founding rate. That never changes — even when we scale."],
  ];

  const perksRows = perks.map(([icon, title, desc]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #ffffff06;vertical-align:top;width:28px;">
        <span style="font-size:18px;">${icon}</span>
      </td>
      <td style="padding:10px 0 10px 12px;border-bottom:1px solid #ffffff06;vertical-align:top;">
        <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#ffffff;">${title}</p>
        <p style="margin:0;font-size:12px;color:#ffffff50;line-height:1.5;">${desc}</p>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ALL ACCESS</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <span style="font-size:13px;font-weight:700;letter-spacing:0.2em;color:#ec4899;text-transform:uppercase;">ALL ACCESS</span>
              <span style="font-size:13px;color:#ffffff30;margin:0 8px;">by</span>
              <span style="font-size:13px;font-weight:600;letter-spacing:0.05em;color:#ffffff50;text-transform:uppercase;">TakersLifestyle</span>
            </td>
          </tr>

          <!-- HERO CARD -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a0a12 0%,#0f0f0f 50%,#0a0f1a 100%);border:1px solid #ec489930;border-radius:20px;padding:48px 40px 40px;text-align:center;">
              <div style="display:inline-block;background:#ec489915;border:1px solid #ec489940;border-radius:999px;padding:6px 16px;margin-bottom:24px;">
                <span style="font-size:12px;font-weight:600;color:#f9a8d4;letter-spacing:0.05em;">&#10022; FOUNDING MEMBER</span>
              </div>
              <h1 style="margin:0 0 12px;font-size:36px;font-weight:800;line-height:1.15;letter-spacing:-0.02em;">
                You&rsquo;re in, ${escHtml(d.firstName)}.
              </h1>
              <p style="margin:0 0 32px;font-size:17px;color:#ffffff80;line-height:1.5;">
                Your ALL ACCESS membership is now <span style="color:#86efac;font-weight:600;">active</span>.<br/>
                Winnipeg&rsquo;s most exclusive network just got one more.
              </p>
              <a href="${d.loginUrl}"
                 style="display:inline-block;background:#ec4899;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.01em;">
                Enter ALL ACCESS &rarr;
              </a>
            </td>
          </tr>

          <tr><td style="height:24px;"></td></tr>

          <!-- PAYMENT DETAILS -->
          <tr>
            <td style="background:#0f0f0f;border:1px solid #ffffff10;border-radius:16px;padding:28px 32px;">
              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff30;">Payment Confirmed</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:13px;color:#ffffff50;">Amount paid</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:14px;font-weight:700;color:#86efac;">${escHtml(d.amountPaid)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:13px;color:#ffffff50;">Date</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:13px;color:#ffffff80;">${escHtml(d.date)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="font-size:13px;color:#ffffff50;">Transaction ID</span>
                  </td>
                  <td style="padding:10px 0;text-align:right;">
                    <span style="font-size:11px;font-family:monospace;color:#ffffff40;letter-spacing:0.03em;">${escHtml(d.transactionId)}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#ffffff30;line-height:1.5;">
                Then $99/month. Cancel anytime from your dashboard &mdash; no runaround, no fees.
              </p>
            </td>
          </tr>

          <tr><td style="height:24px;"></td></tr>

          <!-- WHAT YOU GET -->
          <tr>
            <td style="background:#0f0f0f;border:1px solid #ffffff10;border-radius:16px;padding:28px 32px;">
              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff30;">What you now have access to</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${perksRows}
              </table>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>

          <!-- FOOTER -->
          <tr>
            <td style="text-align:center;padding:0 20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.15em;color:#ec4899;text-transform:uppercase;">ALL ACCESS</p>
              <p style="margin:0 0 16px;font-size:12px;color:#ffffff30;line-height:1.6;">
                Questions? Reply to this email or reach us at<br/>
                <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#ffffff40;text-decoration:none;">hello@allaccesswinnipeg.ca</a>
              </p>
              <p style="margin:0;font-size:11px;color:#ffffff20;line-height:1.6;">
                You&rsquo;re receiving this because you just became a member of ALL ACCESS by TakersLifestyle.<br/>
                Winnipeg, MB, Canada
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
