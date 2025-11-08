export const runtime = "nodejs";

import { adminDb } from "@/lib/admin";

export async function GET() {
  try {
    const cols = await adminDb.listCollections();
    return Response.json({
      ok: true,
      env: {
        b64: process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64 ? "set" : "absent",
        project: process.env.FIREBASE_ADMIN_PROJECT_ID ?? null,
        client: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? null,
        rawPemVar: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? "present" : "absent"
      },
      collections: cols.map((c) => c.id)
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message }), { status: 500 });
  }
}
