// Takers AI — Get single conversation with messages
// GET /api/takers-ai/conversations/[convId]

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    return decoded.role === "admin" ? decoded : null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ convId: string }> }
) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { convId } = await params;
  const db = adminDb();
  const [convDoc, messagesSnap] = await Promise.all([
    db.collection("conversations").doc(convId).get(),
    db.collection("conversations").doc(convId).collection("messages").orderBy("createdAt").get(),
  ]);
  if (!convDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = messagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ conversation: { id: convDoc.id, ...convDoc.data() }, messages });
}
