// web/src/lib/firebase-admin.ts
// Server-only — never import this in Client Components or browser code.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let dbInstance: ReturnType<typeof getFirestore> | null = null;

function ensureInitialized() {
  if (getApps().length) return;

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ?? process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (raw && raw.trim().length > 0) {
    const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");

    // Guard: if the value looks like an env var name or doesn't start with {,
    // it was misconfigured — throw a clear error rather than a cryptic parse crash.
    if (!cleaned.startsWith("{")) {
      throw new Error(
        `Firebase credentials env var does not contain valid JSON. ` +
        `Value starts with: "${cleaned.slice(0, 30)}...". ` +
        `Check GOOGLE_APPLICATION_CREDENTIALS_JSON in Vercel Environment Variables.`
      );
    }

    let creds: Record<string, string>;
    try {
      creds = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(
        `Failed to parse Firebase credentials JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. ` +
        `Ensure GOOGLE_APPLICATION_CREDENTIALS_JSON is a valid JSON string in Vercel Environment Variables.`
      );
    }

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
      `[firebase-admin] Initialized with service account (project: ${creds.project_id})`
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
    // On Vercel, GOOGLE_APPLICATION_CREDENTIALS_JSON MUST be set — ADC is not available.
    console.warn(
      "[firebase-admin] No credentials env var found. " +
      "Attempting Application Default Credentials (only works on GCP/Firebase App Hosting)."
    );
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
