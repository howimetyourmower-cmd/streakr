import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { getAuth } from "firebase-admin/auth";   // ✅ this is now correct
import rounds2026 from "@/data/rounds-2026.json";

const serviceAccountBase64 = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64;

if (!serviceAccountBase64) {
  throw new Error("Missing FIREBASE_ADMIN_PRIVATE_KEY_BASE64 env variable");
}

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, "base64").toString("utf8")
);

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
      })
    : getApps()[0];

// ✔ THIS is what route.ts needs
export const db = getFirestore(app);
