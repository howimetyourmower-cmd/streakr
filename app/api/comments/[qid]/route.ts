export const runtime = "nodejs";
import { db } from "@/lib/admin";

export async function GET(_: Request, { params }: { params: { qid: string } }) {
  const ref = db.collection("comments").doc(params.qid).collection("items");
  const qs = await ref.orderBy("createdAt", "desc").limit(20).get();
  const items = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
  return Response.json({ items });
}

export async function POST(req: Request, { params }: { params: { qid: string } }) {
  const { uid, body, displayName, photoURL } = await req.json();
  if (!uid || !body) return new Response("Bad request", { status: 400 });
  const ref = adminDb.collection("comments").doc(params.qid).collection("items");
  await ref.add({
    uid,
    body: String(body).slice(0, 300),
    displayName: displayName ?? null,
    photoURL: photoURL ?? null,
    createdAt: Date.now(),
    isRemoved: false
  });
  return Response.json({ ok: true });
}
