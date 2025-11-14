export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";

// GET /api/comments/{qid}
export async function GET(
  req: Request,
  { params }: { params: { qid: string } }
) {
  try {
    const ref = db
      .collection("comments")
      .doc(params.qid)
      .collection("items");

    const snapshot = await ref.orderBy("createdAt", "desc").get();

    const comments = snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        uid: data.uid ?? "",
        displayName: data.displayName ?? "",
        photoURL: data.photoURL ?? "",
        body: data.body ?? "",
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : null,
      };
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("GET /api/comments error", error);
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 }
    );
  }
}

// POST /api/comments/{qid}
export async function POST(
  req: Request,
  { params }: { params: { qid: string } }
) {
  try {
    const { uid, body, displayName, photoURL } = await req.json();

    if (!uid || !body) {
      return new NextResponse("Bad request", { status: 400 });
    }

    const ref = db
      .collection("comments")
      .doc(params.qid)
      .collection("items");

    await ref.add({
      uid,
      body: String(body).slice(0, 300),
      displayName: displayName ?? "",
      photoURL: photoURL ?? "",
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/comments error", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}
