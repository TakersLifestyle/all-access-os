import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { yourName, yourEmail, nomineeName, nomineeRole, nomineeOrganization, socialLinks, whyFeature, winnipegImpact, nomineeContact, category, notes } = body;

    if (!yourName || !yourEmail || !nomineeName || !nomineeRole || !whyFeature || !winnipegImpact) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    await Promise.all([
      // Email to ALL ACCESS team
      resend.emails.send({
        from: "ALL ACCESS <hello@allaccesswinnipeg.ca>",
        to: "hello@allaccesswinnipeg.ca",
        subject: `OUR CULTURE — Guest Nomination: ${nomineeName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0e0a1a;color:#fff;padding:32px;border-radius:12px;">
            <p style="color:#e879a0;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 8px;">OUR CULTURE — Guest Nomination</p>
            <h1 style="font-size:24px;font-weight:900;margin:0 0 24px;">${nomineeName}</h1>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#ffffff60;padding:8px 0;font-size:13px;border-bottom:1px solid #ffffff10;">Nominee Role</td><td style="padding:8px 0;font-size:13px;text-align:right;">${nomineeRole}</td></tr>
              ${nomineeOrganization ? `<tr><td style="color:#ffffff60;padding:8px 0;font-size:13px;border-bottom:1px solid #ffffff10;">Organization</td><td style="padding:8px 0;font-size:13px;text-align:right;">${nomineeOrganization}</td></tr>` : ""}
              ${category ? `<tr><td style="color:#ffffff60;padding:8px 0;font-size:13px;border-bottom:1px solid #ffffff10;">Category</td><td style="padding:8px 0;font-size:13px;text-align:right;">${category}</td></tr>` : ""}
              ${socialLinks ? `<tr><td style="color:#ffffff60;padding:8px 0;font-size:13px;border-bottom:1px solid #ffffff10;">Social Links</td><td style="padding:8px 0;font-size:13px;text-align:right;">${socialLinks}</td></tr>` : ""}
              ${nomineeContact ? `<tr><td style="color:#ffffff60;padding:8px 0;font-size:13px;border-bottom:1px solid #ffffff10;">Nominee Contact</td><td style="padding:8px 0;font-size:13px;text-align:right;">${nomineeContact}</td></tr>` : ""}
            </table>
            <div style="margin:24px 0;padding:16px;background:#ffffff08;border-radius:8px;border-left:3px solid #e879a0;">
              <p style="color:#ffffff60;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">Why They Should Be Featured</p>
              <p style="font-size:14px;line-height:1.6;margin:0;">${whyFeature}</p>
            </div>
            <div style="margin:16px 0;padding:16px;background:#ffffff08;border-radius:8px;border-left:3px solid #f59e0b;">
              <p style="color:#ffffff60;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">Their Impact on Winnipeg</p>
              <p style="font-size:14px;line-height:1.6;margin:0;">${winnipegImpact}</p>
            </div>
            ${notes ? `<div style="margin:16px 0;padding:16px;background:#ffffff08;border-radius:8px;">
              <p style="color:#ffffff60;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">Additional Notes</p>
              <p style="font-size:14px;line-height:1.6;margin:0;">${notes}</p>
            </div>` : ""}
            <hr style="border:none;border-top:1px solid #ffffff10;margin:24px 0;" />
            <p style="color:#ffffff40;font-size:12px;margin:0;">Submitted by <strong style="color:#ffffff80;">${yourName}</strong> — <a href="mailto:${yourEmail}" style="color:#e879a0;">${yourEmail}</a></p>
          </div>
        `,
      }),

      // Confirmation email to the person who submitted
      resend.emails.send({
        from: "ALL ACCESS <hello@allaccesswinnipeg.ca>",
        to: yourEmail,
        subject: `We received your nomination — ${nomineeName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0e0a1a;color:#fff;padding:32px;border-radius:12px;">
            <p style="color:#e879a0;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 16px;">OUR CULTURE by ALL ACCESS Winnipeg</p>

            <h1 style="font-size:24px;font-weight:900;margin:0 0 8px;">Thank you, ${yourName}.</h1>
            <p style="color:#ffffff60;font-size:15px;margin:0 0 24px;line-height:1.6;">Your nomination for <strong style="color:#fff;">${nomineeName}</strong> has been received.</p>

            <div style="background:#ffffff08;border:1px solid #ffffff10;border-radius:12px;padding:20px;margin-bottom:24px;">
              <p style="color:#ffffff40;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 12px;">Your Nomination</p>
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;">${nomineeName}</p>
              <p style="margin:0;color:#ffffff50;font-size:13px;">${nomineeRole}${nomineeOrganization ? ` · ${nomineeOrganization}` : ""}${category ? ` · ${category}` : ""}</p>
            </div>

            <p style="color:#ffffff55;font-size:14px;line-height:1.7;margin:0 0 24px;">
              We review every nomination personally. If ${nomineeName} is a fit for The Couch, we will reach out to them directly when the timing is right.<br/><br/>
              We appreciate you helping us document the people building Winnipeg.
            </p>

            <hr style="border:none;border-top:1px solid #ffffff10;margin:24px 0;" />

            <p style="color:#ffffff30;font-size:12px;margin:0 0 4px;">Questions? Reply to this email or reach us at <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#e879a0;">hello@allaccesswinnipeg.ca</a></p>
            <p style="color:#ffffff20;font-size:11px;margin:0;">ALL ACCESS Winnipeg · Community First. Always.</p>
          </div>
        `,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Nomination email error:", err);
    return NextResponse.json({ error: "Failed to send nomination." }, { status: 500 });
  }
}
