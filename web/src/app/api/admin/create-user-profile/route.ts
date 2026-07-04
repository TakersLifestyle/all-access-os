// POST /api/admin/create-user-profile
// Admin-only — creates a missing users/{uid} Firestore doc for orphaned Auth accounts.
// Client SDK rules block admin from creating another user's profile, so Admin SDK required.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  // 1. Verify admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // 2. Parse body
  const { uid, email, displayName } = (await req.json()) as {
    uid: string;
    email?: string;
    displayName?: string;
  };
  if (!uid?.trim()) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  // 3. Check profile doesn't already exist
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  const existing = await ref.get();
  if (existing.exists) {
    return NextResponse.json({ message: "Profile already exists" });
  }

  // 4. Create minimal profile
  const now = new Date().toISOString();
  await ref.set({
    email: email ?? "",
    displayName: displayName ?? null,
    role: "member",
    status: "inactive",
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[create-user-profile] Created users/${uid} for ${email}`);
  return NextResponse.json({ success: true });
}
