export const runtime = "nodejs";
import { adminDb } from "@/lib/admin";

export async function GET(_: Request, { params }: { params: { qid: string } }) {
  const snap = await adminDb.collection("questionStats").doc(params.qid).get();
  const d = snap.exists ? snap.data()! as any : { total: 0, yes: 0, no: 0 };
  const yesPct = d.total ? Math.round((d.yes / d.total) * 100) : 0;
  return Response.json({ total: d.total, yesPct, noPct: 100 - yesPct });
}
