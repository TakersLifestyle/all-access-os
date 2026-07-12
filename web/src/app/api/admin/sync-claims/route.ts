import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    // Verify caller is an admin
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.replace("Bearer ", "").trim();
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { uid, role, status } = await req.json();
    if (!uid || !role || !status) {
      return NextResponse.json({ error: "uid, role, status required" }, { status: 400 });
    }

    // Update Firestore + Auth claims atomically
    await Promise.all([
      adminDb().collection("users").doc(uid).set({ role, status, updatedAt: new Date() }, { merge: true }),
      adminAuth().setCustomUserClaims(uid, { role, status }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-claims]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
