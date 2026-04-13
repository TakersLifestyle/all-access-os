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
}

export function ticketConfirmationHtml(d: TicketConfirmationData): string {
  const ticketWord = d.quantity === 1 ? "ticket" : "tickets";

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
              <span style="font-size:13px;font-weight:700;letter-spacing:0.2em;color:#ec4899;text-transform:uppercase;">ALL ACCESS</span>
              <span style="font-size:13px;color:#ffffff30;margin:0 8px;">by</span>
              <span style="font-size:13px;font-weight:600;letter-spacing:0.05em;color:#ffffff50;text-transform:uppercase;">TakersLifestyle</span>
            </td>
          </tr>

          <!-- HERO CARD -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a121a 0%,#0f0f0f 50%,#0f0a12 100%);border:1px solid #ec489930;border-radius:20px;padding:48px 40px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#86efac20;border:1px solid #86efac30;border-radius:50%;margin-bottom:24px;font-size:24px;">
                &#10003;
              </div>
              <h1 style="margin:0 0 12px;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-0.02em;">
                You&rsquo;re on the list, ${escHtml(d.firstName)}.
              </h1>
              <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#ec4899;">
                ${escHtml(d.eventTitle)}
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#ffffff60;line-height:1.5;">
                ${d.quantity} ${ticketWord} confirmed &bull; Payment received
              </p>
              <a href="${d.eventsUrl}"
                 style="display:inline-block;background:#ec4899;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.01em;">
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

          <!-- REMINDER -->
          <tr>
            <td style="background:#ec489908;border:1px solid #ec489920;border-radius:12px;padding:20px 24px;">
              <p style="margin:0;font-size:13px;color:#ffffff60;line-height:1.6;">
                <strong style="color:#f9a8d4;">Heads up:</strong> Keep this email as your proof of purchase.
                Show it (or your Order ID) at the door. No paper tickets needed &mdash; we check you in by name.
              </p>
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
