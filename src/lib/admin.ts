import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function normalizePem(s: string) {
  return s.replace(/\r?\n/g, "\n").replace(/\\r?\\n/g, "\n").replace(/^\uFEFF/, "").trim();
}

function fromBase64Env() {
  const b64 = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64;
  const fallbackProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const fallbackClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  if (!b64) throw new Error("FIREBASE_ADMIN_PRIVATE_KEY_BASE64 is missing");

  let decoded = Buffer.from(b64, "base64").toString("utf8").replace(/^\uFEFF/, "").trim();

  // Case A: full JSON
  try {
    const json = JSON.parse(decoded);
    return {
      projectId: json.project_id ?? fallbackProjectId,
      clientEmail: json.client_email ?? fallbackClientEmail,
      privateKey: normalizePem(String(json.private_key || "")),
    };
  } catch {
    // Case B: PEM only
    if (!fallbackProjectId || !fallbackClientEmail) {
      throw new Error("PEM-only mode requires FIREBASE_ADMIN_PROJECT_ID and FIREBASE_ADMIN_CLIENT_EMAIL");
    }
    return { projectId: fallbackProjectId, clientEmail: fallbackClientEmail, privateKey: normalizePem(decoded) };
  }
}

const sa = fromBase64Env();
const app = getApps()[0] ?? initializeApp({ credential: cert(sa), projectId: sa.projectId });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
