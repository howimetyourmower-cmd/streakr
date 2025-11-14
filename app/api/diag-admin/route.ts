export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin"; // FIXED

// Simple diagnostic endpoint to read Firestore
export async function GET() {
  try {
    // Example: count users
    const usersSnap = await db.collection("users").get();

    return NextResponse.json({
      ok: true,
      firestoreConnected: true,
      userCount: usersSnap.size,
    });
  } catch (error) {
    console.error("diag-admin GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Firestore connection failed" },
      { status: 500 }
    );
  }
}
