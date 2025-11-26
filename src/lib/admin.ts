// src/lib/admin.ts

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

let app: App;

function initFirebaseAdmin(): App {
  if (getApps().length) {
    return getApps()[0]!;
  }

  try {
    // 1️⃣ Preferred: full service account JSON in one env var
    //    (this is very likely what you had working before)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );

      return initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    // 2️⃣ Fallback: separate env vars (PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };

      return initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    // 3️⃣ Last resort: no explicit credentials (will use default creds if available)
    console.warn(
      "[firebase-admin] No explicit service account env vars found. " +
        "Using default credentials. Ensure this is configured in Vercel."
    );

    return initializeApp();
  } catch (error) {
    console.error("[firebase-admin] Error initializing Firebase Admin:", error);
    // As a safety net, still try to init without options.
    return initializeApp();
  }
}

app = initFirebaseAdmin();

// ✅ Exports used by all server routes
export const db = getFirestore(app);
export const auth = getAdminAuth(app);
