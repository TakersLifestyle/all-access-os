import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export interface AuthUserRecord {
  uid: string;
  email: string | undefined;
  displayName: string | undefined;
  disabled: boolean;
  createdAt: string | undefined;
  lastSignIn: string | undefined;
  customClaims: Record<string, unknown> | null;
}

export async function GET() {
  try {
    const auth = adminAuth();
    const users: AuthUserRecord[] = [];
    let pageToken: string | undefined;

    do {
      const result = await auth.listUsers(1000, pageToken);
      for (const u of result.users) {
        users.push({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          disabled: u.disabled,
          createdAt: u.metadata.creationTime,
          lastSignIn: u.metadata.lastSignInTime,
          customClaims: (u.customClaims as Record<string, unknown>) ?? null,
        });
      }
      pageToken = result.pageToken;
    } while (pageToken);

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[api/admin/auth-users] Error:", err);
    return NextResponse.json({ error: "Failed to list auth users" }, { status: 500 });
  }
}
