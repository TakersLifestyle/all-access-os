// Takers AI — RBAC Permissions API
//
// GET    /api/takers-ai/permissions              → list all AI role assignments
// GET    /api/takers-ai/permissions?uid=<uid>    → get role for a user
// GET    /api/takers-ai/permissions?self=true    → get your own permissions
// POST   /api/takers-ai/permissions             → grant a role (admin only)
// PATCH  /api/takers-ai/permissions             → update role or revoke
// DELETE /api/takers-ai/permissions?uid=<uid>   → revoke role (soft delete)

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  resolvePermissions,
  createRoleRecord,
  AI_ROLE_LABELS,
  PERMISSION_LABELS,
  isFirebaseAdmin,
} from "@/lib/takers-ai/rbac";
import type { AIRole } from "@/lib/takers-ai/rbac";

async function verifyToken(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return await adminAuth().verifyIdToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const decoded = await verifyToken(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  const self = searchParams.get("self") === "true";

  // Self: any authenticated user can get their own permissions
  if (self) {
    const perm = await resolvePermissions(decoded, db);
    return NextResponse.json({
      uid: perm.uid,
      aiRole: perm.aiRole,
      firebaseRole: perm.firebaseRole,
      roleLabel: AI_ROLE_LABELS[perm.aiRole],
      permissions: perm.allPermissions,
      permissionLabels: perm.allPermissions.reduce(
        (acc, p) => ({ ...acc, [p]: PERMISSION_LABELS[p] }),
        {} as Record<string, string>
      ),
    });
  }

  // Admin-only from here
  if (!isFirebaseAdmin(decoded)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Single user
  if (uid) {
    const doc = await db.collection("aiRoles").doc(uid).get();
    if (!doc.exists) return NextResponse.json({ error: "No AI role assigned" }, { status: 404 });
    return NextResponse.json({ role: { uid, ...doc.data() } });
  }

  // List all
  const snap = await db
    .collection("aiRoles")
    .orderBy("grantedAt", "desc")
    .limit(100)
    .get();
  const roles = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  return NextResponse.json({ roles, total: snap.size });
}

// ── POST: Grant a role ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyToken(req);
  if (!decoded || !isFirebaseAdmin(decoded)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { uid, email, displayName, role, notes } = body as {
    uid: string;
    email: string;
    displayName: string;
    role: AIRole;
    notes?: string;
  };

  if (!uid || !email || !role) {
    return NextResponse.json({ error: "uid, email, role required." }, { status: 400 });
  }

  const validRoles: AIRole[] = ["admin", "operator", "reviewer", "tool_executor", "read_only"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({
      error: `Invalid role. Valid: ${validRoles.join(", ")}`,
    }, { status: 400 });
  }

  const db = adminDb();
  const record = createRoleRecord(uid, email, displayName ?? email, role, decoded.uid, notes ?? null);
  await db.collection("aiRoles").doc(uid).set(record);

  return NextResponse.json({ uid, role, success: true }, { status: 201 });
}

// ── PATCH: Update or revoke ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyToken(req);
  if (!decoded || !isFirebaseAdmin(decoded)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { uid, role, isActive, notes } = body as {
    uid: string;
    role?: AIRole;
    isActive?: boolean;
    notes?: string;
  };

  if (!uid) return NextResponse.json({ error: "uid required." }, { status: 400 });

  const db = adminDb();
  const doc = await db.collection("aiRoles").doc(uid).get();
  if (!doc.exists) return NextResponse.json({ error: "Role record not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) {
    updates.isActive = isActive;
    if (!isActive) updates.revokedAt = new Date().toISOString();
  }
  if (notes !== undefined) updates.notes = notes;

  await doc.ref.update(updates);
  return NextResponse.json({ uid, success: true });
}

// ── DELETE: Revoke role ───────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const decoded = await verifyToken(req);
  if (!decoded || !isFirebaseAdmin(decoded)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required." }, { status: 400 });

  const db = adminDb();
  // Soft delete — mark inactive rather than deleting (preserves audit trail)
  await db.collection("aiRoles").doc(uid).update({
    isActive: false,
    revokedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
