import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (raw && raw.trim().length > 0) {
    try {
      console.log("[functions] Using LOCAL Firebase credentials");

      const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
      const creds = JSON.parse(cleaned);

      if (typeof creds.private_key === "string") {
        creds.private_key = creds.private_key.replace(/\\n/g, "\n");
      }

      if (!creds.project_id || !creds.client_email || !creds.private_key) {
        throw new Error("Invalid service account JSON");
      }

      return initializeApp({
        credential: cert({
          projectId: creds.project_id,
          clientEmail: creds.client_email,
          privateKey: creds.private_key,
        }),
      });
    } catch (err) {
      console.error("[functions] Failed parsing credentials:", err);
      throw new Error("Firebase Admin init failed (functions)");
    }
  }

  console.log("[functions] Using DEFAULT credentials (Cloud)");
  return initializeApp();
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function adminAuth() {
  return getAuth(getAdminApp());
}