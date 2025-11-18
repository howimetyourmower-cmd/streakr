export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

type RouteParams = {
  params: { qid: string };
};

// GET /api/comments/:qid
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const questionId = params.qid;

  if (!questionId) {
    return NextResponse.json({ comments: [] });
  }

  try {
    // Simple query – only WHERE. No orderBy so we don't need a composite index.
    const snap = await db
      .collection("comments")
      .where("questionId", "==", questionId)
      .get();

    const comments = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as any;
        const ts = data.createdAt;
        let createdAt: Date | null = null;

        if (ts && typeof ts.toDate === "function") {
          createdAt = ts.toDate();
        }

        return {
          id: docSnap.id,
          body: data.body ?? "",
          displayName: data.displayName ?? null,
          createdAt,
        };
      })
      // sort newest → oldest in JS
      .sort(
        (a, b) =>
          (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      )
      // keep latest 50
      .slice(0, 50)
      // convert Date → ISO string for the client
      .map((c) => ({
        ...c,
        createdAt: c.createdAt ? c.createdAt.toISOString() : null,
      }));

    return NextResponse.json({ comments });
  } catch (err) {
    console.error("Error loading comments", err);
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 }
    );
  }
}

// POST /api/comments/:qid
// Body: { body: string }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const questionId = params.qid;

  try {
    const json = await req.json();
    const text = (json?.body ?? "").toString().trim();

    if (!text) {
      return NextResponse.json(
        { error: "Comment body required" },
        { status: 400 }
      );
    }

    const docRef = await db.collection("comments").add({
      questionId,
      body: text,
      createdAt: Timestamp.now(),
      // later: userId, displayName, etc.
    });

    return NextResponse.json({
      id: docRef.id,
      body: text,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error posting comment", err);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }
}
