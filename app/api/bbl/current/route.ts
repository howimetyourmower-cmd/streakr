// /app/api/bbl/current/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

type CurrentBblResponse =
  | {
      ok: true;
      docId: string;
      match?: string;
      venue?: string;
      startTime?: string; // ISO string
    }
  | {
      ok: true;
      docId: null;
      reason: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Returns the "current or next" BBL match doc from Firestore.
 *
 * EXPECTED Firestore collection:
 *   bblMatches (you can rename this if you already have a different collection)
 *
 * EXPECTED document fields (recommended):
 *   - startTime: Firestore Timestamp (IMPORTANT for querying)
 *   - match: string (optional)
 *   - venue: string (optional)
 *
 * Logic:
 *   - include matches that started in the last BUFFER_HOURS (so a live match still counts)
 *   - otherwise return the next upcoming match
 */
export async function GET() {
  try {
    const COLLECTION = "bblMatches"; // 👈 change ONLY if your collection name differs
    const BUFFER_HOURS = 8;

    const now = new Date();
    const bufferFrom = new Date(now.getTime() - BUFFER_HOURS * 60 * 60 * 1000);

    // We only need the first match that hasn't started too long ago
    // startTime must be a Firestore Timestamp for this query.
    const snap = await db
      .collection(COLLECTION)
      .where("startTime", ">=", Timestamp.fromDate(bufferFrom))
      .orderBy("startTime", "asc")
      .limit(1)
      .get();

    if (snap.empty) {
      const payload: CurrentBblResponse = {
        ok: true,
        docId: null,
        reason: "No current/upcoming BBL match found.",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const doc = snap.docs[0];
    const data = doc.data() as {
      startTime?: Timestamp;
      match?: string;
      venue?: string;
      startTimeIso?: string;
    };

    const startTimeIso =
      data.startTime?.toDate().toISOString() || data.startTimeIso || "";

    const payload: CurrentBblResponse = {
      ok: true,
      docId: doc.id,
      match: data.match || undefined,
      venue: data.venue || undefined,
      startTime: startTimeIso || undefined,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/bbl/current error:", err);

    const payload: CurrentBblResponse = {
      ok: false,
      error:
        err?.message ||
        "Failed to load current BBL match. Check Firestore collection + fields.",
    };

    return NextResponse.json(payload, { status: 500 });
  }
}
