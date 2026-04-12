// web/src/lib/firebase-admin.ts
// Server-only — never import this in Client Components or browser code.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let dbInstance: ReturnType<typeof getFirestore> | null = null;

function ensureInitialized() {
  if (getApps().length) return;

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (raw && raw.trim().length > 0) {
    // Local development: parse service account JSON from env
    const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
    const creds = JSON.parse(cleaned);

    if (typeof creds.private_key === "string") {
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    }

    const missing = (["project_id", "client_email", "private_key"] as const).filter(
      (k) => !creds[k]
    );
    if (missing.length > 0) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS_JSON is missing required fields: ${missing.join(", ")}`
      );
    }

    console.log(
      `[firebase-admin] Using service account credentials (project: ${creds.project_id})`
    );

    initializeApp({
      credential: cert({
        projectId: creds.project_id,
        clientEmail: creds.client_email,
        privateKey: creds.private_key,
      }),
    });
  } else {
    // Production (Firebase App Hosting / Cloud Run): ADC is provided automatically.
    console.log("[firebase-admin] Using Application Default Credentials.");
    initializeApp();
  }
}

export function adminDb(): ReturnType<typeof getFirestore> {
  if (dbInstance) return dbInstance;
  ensureInitialized();
  dbInstance = getFirestore();
  return dbInstance;
}

export function adminAuth() {
  ensureInitialized();
  return getAuth();
}
