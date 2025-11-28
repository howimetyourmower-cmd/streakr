// src/lib/admin.ts

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

function initFirebaseAdmin(): App {
  // Re-use existing app in dev / serverless environments
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  try {
    // 1️⃣ Preferred: full service account JSON in one env var
    //    This is usually the safest option on Vercel.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );

      return initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    // 2️⃣ Fallback: separate env vars
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // important: fix \n newlines when coming from env
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };

      return initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    // 3️⃣ Last resort: default credentials
    console.warn(
      "[firebase-admin] No explicit service account env vars found. " +
        "Using default credentials – make sure this is configured in Vercel."
    );

    return initializeApp();
  } catch (error) {
    console.error("[firebase-admin] Error initializing Firebase Admin:", error);
    // As a safety net, still try to init without explicit options
    return initializeApp();
  }
}

const app = initFirebaseAdmin();

// ✅ Exports used by all server routes (picks, settlement, etc.)
export const db = getFirestore(app);
export const auth = getAdminAuth(app);
