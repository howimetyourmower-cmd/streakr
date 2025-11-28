// src/lib/admin.ts

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

type ServiceAccountLike = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * Try to resolve a service account from the various env var formats
 * you’ve used in this project.
 *
 * Supported:
 *  - FIREBASE_SERVICE_ACCOUNT_KEY = full JSON
 *  - FIREBASE_ADMIN_PRIVATE_KEY_BASE64 =
 *      * PEM text
 *      * base64(PEM)
 *      * base64(JSON with private_key)
 *  - FIREBASE_PRIVATE_KEY with \n escapes
 *  - Project / email from FIREBASE_ADMIN_* or FIREBASE_* / NEXT_PUBLIC_FIREBASE_*
 */
function resolveServiceAccount(): ServiceAccountLike {
  // 1️⃣ Full JSON in FIREBASE_SERVICE_ACCOUNT_KEY (optional but nice)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const json = JSON.parse(raw);
    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: (json.private_key as string).replace(/\\n/g, "\n"),
    };
  }

  let projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "";

  let clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    "";

  // Helper to ensure we always fix \n
  const fixNewlines = (key: string) =>
    key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;

  // 2️⃣ Your "BASE64" env – but we’ll accept multiple possibilities
  const rawAdminKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64;
  if (rawAdminKey) {
    // 2a) If it already looks like a PEM, use it as-is
    if (rawAdminKey.includes("BEGIN PRIVATE KEY")) {
      const privateKey = fixNewlines(rawAdminKey);
      if (!projectId || !clientEmail) {
        // we still need these; force the error to be explicit if missing
        return { projectId, clientEmail, privateKey };
      }
      return { projectId, clientEmail, privateKey };
    }

    // 2b) Otherwise, try to base64-decode it
    try {
      const decoded = Buffer.from(rawAdminKey, "base64").toString("utf8");

      if (decoded.includes("BEGIN PRIVATE KEY")) {
        const privateKey = fixNewlines(decoded);
        return { projectId, clientEmail, privateKey };
      }

      // 2c) Maybe it’s base64 of the full service account JSON
      if (decoded.trim().startsWith("{")) {
        const json = JSON.parse(decoded);
        const privateKey = fixNewlines(json.private_key as string);
        projectId = projectId || json.project_id;
        clientEmail = clientEmail || json.client_email;
        return { projectId, clientEmail, privateKey };
      }
    } catch (e) {
      console.warn(
        "[firebase-admin] Could not decode FIREBASE_ADMIN_PRIVATE_KEY_BASE64 as base64; will try other envs."
      );
    }
  }

  // 3️⃣ Classic separate envs style
  if (process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = fixNewlines(process.env.FIREBASE_PRIVATE_KEY);
    projectId =
      projectId ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "";
    clientEmail = clientEmail || process.env.FIREBASE_CLIENT_EMAIL || "";
    return { projectId, clientEmail, privateKey };
  }

  throw new Error(
    "[firebase-admin] No usable service account credentials found. " +
      "Check FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_ADMIN_* / FIREBASE_* env vars."
  );
}

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const { projectId, clientEmail, privateKey } = resolveServiceAccount();

  if (!projectId) {
    throw new Error(
      "[firebase-admin] Service account is missing projectId. Check your env vars."
    );
  }
  if (!clientEmail) {
    throw new Error(
      "[firebase-admin] Service account is missing clientEmail. Check your env vars."
    );
  }

  const app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    } as any),
  });

  return app;
}

const app = createAdminApp();

// ✅ Exports used by server routes
export const db = getFirestore(app);
export const auth = getAdminAuth(app);
