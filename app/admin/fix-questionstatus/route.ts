// /app/api/admin/fix-questionstatus/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type QuestionStatusDoc = {
  roundNumber?: number;
  questionId?: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock" | string;
  result?: QuestionOutcome | "lock" | string; // legacy
  updatedAt?: any;
};

function requireAdmin(req: NextRequest): string | null {
  const token = req.headers.get("x-admin-token") || "";
  const expected = process.env.ADMIN_TOKEN || "";
  if (!expected) return "Missing ADMIN_TOKEN env var on server.";
  if (!token || token !== expected) return "Unauthorized.";
  return null;
}

function normaliseOutcomeValue(val: unknown): QuestionOutcome | undefined {
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (["yes", "y", "correct", "win", "winner"].includes(s)) return "yes";
  if (["no", "n", "wrong", "loss", "loser"].includes(s)) return "no";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  return undefined;
}

function isValidQuestionId(qid: string): boolean {
  // expected exact format: OR-G1-Q1 or R12-G3-Q7
  return /^(OR|R\d+)-G\d+-Q\d+$/.test(qid);
}

function deriveBaseQuestionId(qid: string): string | null {
  // If it contains a valid base at the start, extract it.
  // Examples:
  //  OR-G1-Q1-abc123 -> OR-G1-Q1
  //  R2-G3-Q4-x9z -> R2-G3-Q4
  const m = qid.match(/^(OR|R\d+)-G\d+-Q\d+/);
  if (!m) return null;
  return m[0];
}

function docId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

export async function GET(req: NextRequest) {
  const authErr = requireAdmin(req);
  if (authErr) return NextResponse.json({ ok: false, error: authErr }, { status: 401 });

  const url = new URL(req.url);
  const roundParam = url.searchParams.get("round"); // optional
  const dryRun = url.searchParams.get("dryRun") === "1";

  let roundNumberFilter: number | null = null;
  if (roundParam !== null) {
    const n = Number(roundParam);
    roundNumberFilter = Number.isFinite(n) ? n : null;
  }

  const bad: Array<{
    firestoreDocId: string;
    roundNumber: number;
    fromQuestionId: string;
    toQuestionId: string;
    status?: string;
    outcome?: string;
  }> = [];

  let scanned = 0;

  // Query per round if provided, else scan all (MVP scale)
  const snap = roundNumberFilter === null
    ? await db.collection("questionStatus").get()
    : await db.collection("questionStatus").where("roundNumber", "==", roundNumberFilter).get();

  scanned = snap.size;

  // We'll do batched writes in chunks
  let migrated = 0;
  let deleted = 0;

  const ops: Array<Promise<any>> = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data() as QuestionStatusDoc;

    const rn = typeof d.roundNumber === "number" ? d.roundNumber : null;
    const qid = String(d.questionId || "").trim();

    if (rn === null || !qid) return;

    if (isValidQuestionId(qid)) return; // already good

    const base = deriveBaseQuestionId(qid);
    if (!base) return; // can't safely map

    const status = d.status as QuestionStatus | undefined;
    const outcome = normaliseOutcomeValue((d.outcome as any) ?? (d.result as any));

    bad.push({
      firestoreDocId: docSnap.id,
      roundNumber: rn,
      fromQuestionId: qid,
      toQuestionId: base,
      status,
      outcome,
    });

    if (dryRun) return;

    const targetRef = db.collection("questionStatus").doc(docId(rn, base));
    const sourceRef = db.collection("questionStatus").doc(docSnap.id);

    // Merge onto the correct doc id
    const payload: any = {
      roundNumber: rn,
      questionId: base,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (status) payload.status = status;
    if (outcome) payload.outcome = outcome;

    ops.push(
      targetRef.set(payload, { merge: true }).then(() => { migrated += 1; })
    );

    // Delete the bad doc
    ops.push(
      sourceRef.delete().then(() => { deleted += 1; })
    );
  });

  // Execute ops safely (avoid huge concurrency)
  for (let i = 0; i < ops.length; i += 50) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(ops.slice(i, i + 50));
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned,
    badFound: bad.length,
    migrated,
    deleted,
    examples: bad.slice(0, 25),
  });
}
