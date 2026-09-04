// Event ticket confirmation email HTML template
// Sent once after checkout.session.completed confirms an event_ticket purchase
// QR code encodes the Order ID — scanned by the Door Check-In scanner at the event

export interface TicketConfirmationData {
  firstName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  quantity: number;
  unitPrice: string;     // e.g. "$25.00"
  totalPaid: string;     // e.g. "$50.00"
  orderId: string;
  transactionId: string;
  paidAt: string;
  eventsUrl: string;
  accentColor?: string;  // e.g. "#84cc16" for Skales, "#ec4899" for ROCAFIESTA
  qrCodeDataUri?: string; // PNG data URI — scanned at door to pull up order
}

export function ticketConfirmationHtml(d: TicketConfirmationData): string {
  const ticketWord = d.quantity === 1 ? "ticket" : "tickets";
  const accent = d.accentColor ?? "#84cc16";
  const accentBorder = accent + "35";
  const accentBg = accent + "12";
  const accentDim = accent + "22";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Ticket &mdash; ${escHtml(d.eventTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="padding:0 0 28px 0;text-align:center;">
              <span style="font-size:13px;font-weight:700;letter-spacing:0.18em;color:${accent};text-transform:uppercase;">ALL ACCESS</span>
              <span style="font-size:13px;color:#ffffff20;margin:0 8px;">&bull;</span>
              <span style="font-size:12px;font-weight:500;letter-spacing:0.06em;color:#ffffff35;text-transform:uppercase;">Winnipeg</span>
            </td>
          </tr>

          <!-- TICKET CARD -->
          <tr>
            <td style="background:#111111;border:1px solid ${accentBorder};border-radius:20px;overflow:hidden;">

              <!-- Top strip -->
              <div style="background:${accent};padding:18px 36px;text-align:center;">
                <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.22em;color:#000000;text-transform:uppercase;">&#10003;&nbsp; Ticket Confirmed</p>
              </div>

              <!-- Main content -->
              <div style="padding:36px 36px 32px;">

                <!-- Event title -->
                <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.01em;color:#ffffff;">
                  ${escHtml(d.eventTitle)}
                </h1>
                <p style="margin:0 0 28px;font-size:14px;color:#ffffff50;">
                  ${d.quantity} ${ticketWord} &bull; ${escHtml(d.totalPaid)} paid
                </p>

                <!-- Dotted divider -->
                <div style="border-top:1px dashed #ffffff15;margin-bottom:24px;"></div>

                <!-- Event details grid -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:9px 0;vertical-align:top;">
                      <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Date</span>
                    </td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="font-size:13px;font-weight:600;color:#ffffff90;">${escHtml(d.eventDate)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:9px 0;vertical-align:top;">
                      <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Location</span>
                    </td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="font-size:13px;font-weight:600;color:#ffffff90;">${escHtml(d.eventLocation)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:9px 0;vertical-align:top;">
                      <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Tickets</span>
                    </td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="font-size:13px;font-weight:600;color:#ffffff90;">${d.quantity} &times; ${escHtml(d.unitPrice)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:9px 0;vertical-align:top;">
                      <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Total Paid</span>
                    </td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="font-size:16px;font-weight:800;color:${accent};">${escHtml(d.totalPaid)}</span>
                    </td>
                  </tr>
                </table>

                <!-- Dotted divider -->
                <div style="border-top:1px dashed #ffffff15;margin:24px 0;"></div>

                <!-- Order number -->
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff25;">Order Confirmation</p>
                <p style="margin:0;font-size:14px;font-family:monospace;font-weight:600;letter-spacing:0.06em;color:#ffffff60;word-break:break-all;">${escHtml(d.orderId)}</p>

              </div>

              <!-- QR Code section -->
              ${d.qrCodeDataUri ? `
              <div style="background:#ffffff;padding:28px 36px;text-align:center;border-top:1px solid #e5e5e5;">
                <p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#000000;">Scan at the Door</p>
                <img src="${d.qrCodeDataUri}" alt="Ticket QR Code" width="180" height="180"
                  style="display:block;margin:0 auto;border:none;width:180px;height:180px;" />
                <p style="margin:12px 0 0;font-size:10px;color:#999999;font-family:monospace;letter-spacing:0.04em;">${escHtml(d.orderId)}</p>
              </div>` : ''}

              <!-- Bottom CTA strip -->
              <div style="background:${accentBg};border-top:1px solid ${accentDim};padding:18px 36px;text-align:center;">
                <p style="margin:0;font-size:13px;font-weight:700;color:${accent};letter-spacing:0.03em;">
                  Show this email at the door &mdash; that&rsquo;s your ticket.
                </p>
                <p style="margin:6px 0 0;font-size:12px;color:#ffffff30;">
                  Staff will scan your QR code or look you up by name.
                </p>
              </div>

            </td>
          </tr>

          <tr><td style="height:24px;"></td></tr>

          <!-- ORDER REFERENCE (compact) -->
          <tr>
            <td style="background:#0f0f0f;border:1px solid #ffffff08;border-radius:14px;padding:18px 24px;">
              <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff20;">Receipt</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;">
                    <span style="font-size:12px;color:#ffffff30;">Order ID</span>
                  </td>
                  <td style="padding:6px 0;text-align:right;">
                    <span style="font-size:11px;font-family:monospace;color:#ffffff40;letter-spacing:0.03em;">${escHtml(d.orderId)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <span style="font-size:12px;color:#ffffff30;">Transaction</span>
                  </td>
                  <td style="padding:6px 0;text-align:right;">
                    <span style="font-size:11px;font-family:monospace;color:#ffffff40;letter-spacing:0.03em;">${escHtml(d.transactionId)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <span style="font-size:12px;color:#ffffff30;">Date</span>
                  </td>
                  <td style="padding:6px 0;text-align:right;">
                    <span style="font-size:12px;color:#ffffff40;">${escHtml(d.paidAt)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:28px;"></td></tr>

          <!-- FOOTER -->
          <tr>
            <td style="text-align:center;padding:0 16px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.15em;color:${accent};text-transform:uppercase;">ALL ACCESS</p>
              <p style="margin:0 0 14px;font-size:12px;color:#ffffff25;line-height:1.6;">
                Questions? Reach us at&nbsp;
                <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#ffffff35;text-decoration:none;">hello@allaccesswinnipeg.ca</a>
              </p>
              <p style="margin:0;font-size:11px;color:#ffffff18;line-height:1.6;">
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
