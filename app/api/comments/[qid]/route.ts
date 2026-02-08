// /app/api/comments/[qid]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";

type RouteParams = {
  params: { qid: string };
};

// GET /api/comments/:qid
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const questionId = params?.qid?.trim();

  if (!questionId) {
    return NextResponse.json({ comments: [] }, { status: 200 });
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
          body: typeof data.body === "string" ? data.body : "",
          displayName:
            typeof data.displayName === "string" ? data.displayName : null,
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

    return NextResponse.json({ comments }, { status: 200 });
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
  const questionId = params?.qid?.trim();

  if (!questionId) {
    return NextResponse.json(
      { error: "questionId required" },
      { status: 400 }
    );
  }

  try {
    const json = await req.json().catch(() => null);
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
      createdAt: FieldValue.serverTimestamp(),
      // later: userId, displayName, etc.
    });

    // createdAt is a serverTimestamp; it may not be resolved immediately.
    // Client should re-fetch comments for canonical ordering/time.
    return NextResponse.json(
      {
        id: docRef.id,
        body: text,
        createdAt: null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error posting comment", err);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }
}
