// src/lib/admin.ts

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

/**
 * Initialise Firebase Admin using YOUR existing env vars:
 *
 * - FIREBASE_ADMIN_PROJECT_ID
 * - FIREBASE_ADMIN_CLIENT_EMAIL
 * - FIREBASE_ADMIN_PRIVATE_KEY_BASE64  (base64 of the full private key)
 *
 * No fallbacks. If anything is missing, we throw a clear error.
 */

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyBase64 = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64;

  if (!projectId) {
    throw new Error(
      "[firebase-admin] Missing FIREBASE_ADMIN_PROJECT_ID env variable"
    );
  }
  if (!clientEmail) {
    throw new Error(
      "[firebase-admin] Missing FIREBASE_ADMIN_CLIENT_EMAIL env variable"
    );
  }
  if (!privateKeyBase64) {
    throw new Error(
      "[firebase-admin] Missing FIREBASE_ADMIN_PRIVATE_KEY_BASE64 env variable"
    );
  }

  // Decode the base64 private key to the actual PEM text
  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8");

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
