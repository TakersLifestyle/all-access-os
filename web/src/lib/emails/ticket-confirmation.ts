// Event ticket confirmation email HTML template
// Sent once after checkout.session.completed confirms an event_ticket purchase

export interface TicketConfirmationData {
  firstName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  quantity: number;
  unitPrice: string;     // e.g. "$45.00"
  totalPaid: string;     // e.g. "$90.00"
  orderId: string;
  transactionId: string;
  paidAt: string;
  eventsUrl: string;
  accentColor?: string;  // e.g. "#D4AF37" for Sip & Paint, defaults to ROCAFIESTA pink
}

export function ticketConfirmationHtml(d: TicketConfirmationData): string {
  const ticketWord = d.quantity === 1 ? "ticket" : "tickets";
  const accent = d.accentColor ?? "#ec4899";
  const accentLight = d.accentColor ? d.accentColor + "cc" : "#f9a8d4";
  const accentBg = d.accentColor ? d.accentColor + "12" : "#ec489912";
  const accentBorder = d.accentColor ? d.accentColor + "30" : "#ec489930";
  const accentDim = d.accentColor ? d.accentColor + "20" : "#ec489920";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket Confirmed &mdash; ${escHtml(d.eventTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <span style="font-size:13px;font-weight:700;letter-spacing:0.2em;color:${accent};text-transform:uppercase;">ALL ACCESS</span>
              <span style="font-size:13px;color:#ffffff30;margin:0 8px;">by</span>
              <span style="font-size:13px;font-weight:600;letter-spacing:0.05em;color:#ffffff50;text-transform:uppercase;">TakersLifestyle</span>
            </td>
          </tr>

          <!-- HERO CARD -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a121a 0%,#0f0f0f 50%,#0f0a12 100%);border:1px solid ${accentBorder};border-radius:20px;padding:48px 40px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#86efac20;border:1px solid #86efac30;border-radius:50%;margin-bottom:24px;font-size:24px;">
                &#10003;
              </div>
              <h1 style="margin:0 0 12px;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-0.02em;">
                You&rsquo;re on the list, ${escHtml(d.firstName)}.
              </h1>
              <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:${accent};">
                ${escHtml(d.eventTitle)}
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#ffffff60;line-height:1.5;">
                ${d.quantity} ${ticketWord} confirmed &bull; Payment received
              </p>
              <a href="${d.eventsUrl}"
                 style="display:inline-block;background:${accent};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.01em;">
                View All Events &rarr;
              </a>
            </td>
          </tr>

          <tr><td style="height:24px;"></td></tr>

          <!-- EVENT DETAILS -->
          <tr>
            <td style="background:#0f0f0f;border:1px solid #ffffff10;border-radius:16px;padding:28px 32px;">
              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff30;">Event Details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:13px;color:#ffffff50;">Event</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:14px;font-weight:700;color:#ffffff;">${escHtml(d.eventTitle)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:13px;color:#ffffff50;">Date</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:13px;color:#ffffff80;">${escHtml(d.eventDate)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:13px;color:#ffffff50;">Location</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:13px;color:#ffffff80;">${escHtml(d.eventLocation)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:13px;color:#ffffff50;">Tickets</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:13px;color:#ffffff80;">${d.quantity} &times; ${escHtml(d.unitPrice)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="font-size:13px;color:#ffffff50;">Total paid</span>
                  </td>
                  <td style="padding:10px 0;text-align:right;">
                    <span style="font-size:16px;font-weight:800;color:#86efac;">${escHtml(d.totalPaid)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:16px;"></td></tr>

          <!-- ORDER REFERENCE -->
          <tr>
            <td style="background:#0f0f0f;border:1px solid #ffffff10;border-radius:16px;padding:20px 32px;">
              <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff30;">Order Reference</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:12px;color:#ffffff40;">Order ID</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:11px;font-family:monospace;color:#ffffff50;letter-spacing:0.03em;">${escHtml(d.orderId)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #ffffff08;">
                    <span style="font-size:12px;color:#ffffff40;">Transaction ID</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #ffffff08;text-align:right;">
                    <span style="font-size:11px;font-family:monospace;color:#ffffff50;letter-spacing:0.03em;">${escHtml(d.transactionId)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="font-size:12px;color:#ffffff40;">Purchase date</span>
                  </td>
                  <td style="padding:8px 0;text-align:right;">
                    <span style="font-size:12px;color:#ffffff50;">${escHtml(d.paidAt)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:24px;"></td></tr>

          <!-- QR CODE TICKET -->
          <tr>
            <td style="background:#0f0f0f;border:1px solid #ffffff10;border-radius:16px;padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff30;">Your Entry QR Code</p>
              <p style="margin:0 0 20px;font-size:12px;color:#ffffff25;">Screenshot this or show email at the door</p>
              <div style="display:inline-block;background:#ffffff;border-radius:12px;padding:12px;margin-bottom:16px;">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&amp;data=${escHtml(d.orderId)}&amp;margin=8&amp;bgcolor=ffffff&amp;color=000000"
                  alt="Entry QR Code"
                  width="180"
                  height="180"
                  style="display:block;border-radius:4px;"
                />
              </div>
              <p style="margin:0;font-size:10px;font-family:monospace;color:#ffffff20;letter-spacing:0.08em;">${escHtml(d.orderId)}</p>
            </td>
          </tr>

          <tr><td style="height:16px;"></td></tr>

          <!-- REMINDER -->
          <tr>
            <td style="background:${accentBg};border:1px solid ${accentDim};border-radius:12px;padding:20px 24px;">
              <p style="margin:0;font-size:13px;color:#ffffff60;line-height:1.6;">
                <strong style="color:${accentLight};">At the door:</strong> Have this QR code ready on your screen &mdash; staff will scan it to check you in instantly. Keep this email as your proof of purchase.
              </p>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>

          <!-- FOOTER -->
          <tr>
            <td style="text-align:center;padding:0 20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.15em;color:${accent};text-transform:uppercase;">ALL ACCESS</p>
              <p style="margin:0 0 16px;font-size:12px;color:#ffffff30;line-height:1.6;">
                Questions? Reply to this email or reach us at<br/>
                <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#ffffff40;text-decoration:none;">hello@allaccesswinnipeg.ca</a>
              </p>
              <p style="margin:0;font-size:11px;color:#ffffff20;line-height:1.6;">
                You&rsquo;re receiving this because you purchased a ticket through ALL ACCESS.<br/>
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
