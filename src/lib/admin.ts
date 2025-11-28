// src/lib/admin.ts

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let app: App;

function initFirebaseAdmin(): App {
  // Reuse existing app in dev / serverless
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  // 1️⃣ Preferred: Vercel envs you already have
  const b64 = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;

  if (b64 && clientEmail && projectId) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8").trim();

      let serviceAccount: any;

      if (decoded.startsWith("{")) {
        // Case A: base64 encoded FULL service-account JSON
        serviceAccount = JSON.parse(decoded);
      } else {
        // Case B: base64 encoded PRIVATE KEY only
        const privateKey = decoded.replace(/\\n/g, "\n");
        serviceAccount = {
          projectId,
          clientEmail,
          privateKey,
        };
      }

      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (err) {
      console.error(
        "[firebase-admin] Failed to init with FIREBASE_ADMIN_PRIVATE_KEY_BASE64:",
        err
      );
      // fall through to next options
    }
  }

  // 2️⃣ Fallback: full JSON in FIREBASE_SERVICE_ACCOUNT_KEY
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({
        credential: cert(json),
      });
    } catch (err) {
      console.error(
        "[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:",
        err
      );
    }
  }

  // 3️⃣ Last resort: default credentials (only useful in some local setups)
  console.warn(
    "[firebase-admin] No valid admin credentials from env, using default credentials. " +
      "This may NOT work on Vercel unless you’ve configured a service account there."
  );
  return initializeApp();
}

app = initFirebaseAdmin();

// ✅ Exports for all server routes
export const db = getFirestore(app);
export const auth = getAuth(app);
