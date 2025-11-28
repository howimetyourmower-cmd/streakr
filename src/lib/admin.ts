// src/lib/admin.ts

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

/**
 * Initialise a single Firebase Admin app instance.
 * This version is wired to your existing env var names:
 *
 * - FIREBASE_ADMIN_PROJECT_ID
 * - FIREBASE_ADMIN_CLIENT_EMAIL
 * - FIREBASE_ADMIN_PRIVATE_KEY_BASE64
 *
 * plus a couple of fallbacks if you ever add:
 *
 * - FIREBASE_SERVICE_ACCOUNT_KEY  (full JSON)
 * - FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 */
function initFirebaseAdmin(): App {
  // Re-use existing app in dev / serverless environments
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  try {
    // 1️⃣ Preferred: full service account JSON in one env var (optional)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );

      return initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    // 2️⃣ Your current setup: project/client email + base64 private key
    const adminProjectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    const adminClientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;

    let adminPrivateKey: string | undefined;

    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64) {
      // Private key stored as base64 – decode to normal PEM text
      const b64 = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64;
      adminPrivateKey = Buffer.from(b64, "base64").toString("utf8");
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
      // Classic env style with \n – convert to real newlines
      adminPrivateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
    }

    if (adminProjectId && adminClientEmail && adminPrivateKey) {
      const serviceAccount = {
        projectId: adminProjectId,
        clientEmail: adminClientEmail,
        privateKey: adminPrivateKey,
      };

      return initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    // 3️⃣ Last resort: default credentials (will error if nothing configured)
    console.warn(
      "[firebase-admin] No admin service account env vars found. " +
        "Falling back to default application credentials."
    );

    return initializeApp();
  } catch (error) {
    console.error("[firebase-admin] Error initializing Firebase Admin:", error);
    // As a final safety net, still try to init without explicit options
    return initializeApp();
  }
}

const app = initFirebaseAdmin();

// ✅ Exports used by all server routes
export const db = getFirestore(app);
export const auth = getAdminAuth(app);
