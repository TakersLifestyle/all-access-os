import { adminDb } from "@/lib/firebase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { name, email, instagram, message } = await request.json();

    if (!name?.trim() || !email?.trim()) {
      return Response.json({ error: "Name and email are required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: "Invalid email address" }, { status: 400 });
    }

    const leadData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      instagram: instagram?.trim().replace(/^@/, "") || null,
      message: message?.trim() || null,
      source: "openclaw_widget",
      capturedAt: new Date().toISOString(),
      status: "new",
    };

    const docRef = await adminDb().collection("leads").add(leadData);

    // Notify admin — fire and forget, don't block the response
    resend.emails.send({
      from: "ALL ACCESS <hello@allaccesswinnipeg.ca>",
      to: "tharealprincecharles@gmail.com",
      subject: `🔥 New Lead — ${leadData.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0e0a1a;color:#fff;border-radius:12px;padding:32px;">
          <h2 style="margin:0 0 8px;color:#a78bfa;">New OpenClaw Lead</h2>
          <p style="color:#ffffff80;margin:0 0 24px;font-size:13px;">Captured via allaccesswinnipeg.ca chat widget</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#ffffff60;font-size:13px;width:110px;">Name</td><td style="padding:8px 0;font-weight:600;">${leadData.name}</td></tr>
            <tr><td style="padding:8px 0;color:#ffffff60;font-size:13px;">Email</td><td style="padding:8px 0;">${leadData.email}</td></tr>
            ${leadData.instagram ? `<tr><td style="padding:8px 0;color:#ffffff60;font-size:13px;">Instagram</td><td style="padding:8px 0;">@${leadData.instagram}</td></tr>` : ""}
            ${leadData.message ? `<tr><td style="padding:8px 0;color:#ffffff60;font-size:13px;vertical-align:top;">Message</td><td style="padding:8px 0;">${leadData.message}</td></tr>` : ""}
            <tr><td style="padding:8px 0;color:#ffffff60;font-size:13px;">Lead ID</td><td style="padding:8px 0;font-size:12px;color:#ffffff40;">${docRef.id}</td></tr>
          </table>
          <a href="https://allaccesswinnipeg.ca/admin/users" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Admin Dashboard</a>
        </div>
      `,
    }).catch(() => {}); // don't fail the request if email fails

    return Response.json({ success: true, leadId: docRef.id });
  } catch (err) {
    console.error("Lead capture error:", err);
    return Response.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
