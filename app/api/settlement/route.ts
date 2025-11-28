// /app/api/settlement/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";
import { CURRENT_SEASON } from "@/lib/rounds";

type QuestionStatus = "open" | "pending" | "final" | "void";
type Action = "lock" | "yes" | "no" | "void" | "reopen";

function isValidAction(action: string): action is Action {
  return ["lock", "yes", "no", "void", "reopen"].includes(action);
}

/**
 * POST /api/settlement
 *
 * Body:
 * {
 *   questionId: string;          // e.g. "OR-G1-Q1"
 *   action: "lock" | "yes" | "no" | "void" | "reopen";
 *   roundNumber?: number;        // e.g. 0 for OR, 1 for R1 (optional but recommended)
 * }
 *
 * We no longer touch the "rounds" collection here.
 * Source of truth for status/outcome for Picks is:
 *   - questionStatus/{questionId}
 *   - plus users / picks for streaks & results
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const questionId: string | undefined = body.questionId;
    const actionRaw: string | undefined = body.action;
    const roundNumber: number | null =
      typeof body.roundNumber === "number" ? body.roundNumber : null;

    if (!questionId || !actionRaw) {
      return NextResponse.json(
        { error: "Missing questionId or action" },
        { status: 400 }
      );
    }

    if (!isValidAction(actionRaw)) {
      return NextResponse.json(
        { error: `Invalid action: ${actionRaw}` },
        { status: 400 }
      );
    }

    const action: Action = actionRaw as Action;
    const now = Timestamp.now();

    // Read season config so we can:
    // - know which round doc is current (for sponsor entries)
    // - know sponsor question (for sponsor draw)
    const configSnap = await db
      .collection("config")
      .doc(`season-${CURRENT_SEASON}`)
      .get();

    const configData = configSnap.exists ? (configSnap.data() as any) : {};
    const sponsorConfig = configData.sponsorQuestion || null;
    const configRoundNumber: number | null =
      typeof configData.currentRoundNumber === "number"
        ? configData.currentRoundNumber
        : null;
    const roundForWrite: number | null = roundNumber ?? configRoundNumber;

    const roundDocId: string =
      typeof configData.currentRoundId === "string"
        ? configData.currentRoundId
        : `season-${CURRENT_SEASON}-round-${roundForWrite ?? "unknown"}`;

    const isSponsorQuestion =
      sponsorConfig &&
      sponsorConfig.questionId === questionId &&
      (roundForWrite === null ||
        sponsorConfig.roundNumber === undefined ||
        sponsorConfig.roundNumber === roundForWrite);

    // ---- Simple branches that do NOT touch streaks ----

    // LOCK → status = pending
    if (action === "lock") {
      await db
        .collection("questionStatus")
        .doc(questionId)
        .set(
          {
            questionId,
            roundNumber: roundForWrite,
            status: "pending" as QuestionStatus,
            outcome: "lock",
            updatedAt: now,
          },
          { merge: true }
        );

      await db.collection("settlementHistory").add({
        questionId,
        action: "lock",
        round: roundForWrite,
        season: CURRENT_SEASON,
        lockedAt: now,
      });

      return NextResponse.json({ ok: true, status: "pending" });
    }

    // REOPEN → status = open, clear outcome/lock info
    if (action === "reopen") {
      await db
        .collection("questionStatus")
        .doc(questionId)
        .set(
          {
            questionId,
            roundNumber: roundForWrite,
            status: "open" as QuestionStatus,
            outcome: null,
            updatedAt: now,
          },
          { merge: true }
        );

      await db.collection("settlementHistory").add({
        questionId,
        action: "reopen",
        round: roundForWrite,
        season: CURRENT_SEASON,
        reopenedAt: now,
      });

      return NextResponse.json({ ok: true, status: "open" });
    }

    // ---- YES / NO / VOID – these do streaks & picks ----

    let outcome: "yes" | "no" | "void";
    if (action === "void") {
      outcome = "void";
    } else if (action === "yes") {
      outcome = "yes";
    } else if (action === "no") {
      outcome = "no";
    } else {
      return NextResponse.json(
        { error: `Unsupported action: ${action}` },
        { status: 400 }
      );
    }

    const finalStatus: QuestionStatus =
      outcome === "void" ? "void" : "final";

    // Users whose active streak pick is this question
    const usersSnap = await db
      .collection("users")
      .where("activeQuestionId", "==", questionId)
      .get();

    const batch = db.batch();
    const sponsorWinners: string[] = [];

    usersSnap.forEach((userDoc) => {
      const userId = userDoc.id;
      const data = userDoc.data() as any;
      const activePick = data.activePick as "yes" | "no" | undefined;

      if (!activePick) return;

      const win = outcome !== "void" && activePick === outcome;

      let current =
        typeof data.currentStreak === "number"
          ? data.currentStreak
          : 0;
      let longest =
        typeof data.longestStreak === "number"
          ? data.longestStreak
          : 0;

      if (outcome === "void") {
        // streak unchanged
      } else if (win) {
        current += 1;
        if (current > longest) longest = current;
      } else {
        current = 0;
      }

      const userRef = db.collection("users").doc(userId);
      batch.set(
        userRef,
        {
          currentStreak: current,
          longestStreak: longest,
          lastResult: outcome === "void" ? "void" : win ? "win" : "loss",
          lastSettledAt: now,
          lastSettledRound: roundForWrite,
          lastSettledQuestionId: questionId,
          activeQuestionId: null,
          activePick: null,
        },
        { merge: true }
      );

      const pickId = `${userId}_${questionId}`;
      const pickRef = db.collection("picks").doc(pickId);

      batch.set(
        pickRef,
        {
          outcome,
          result: outcome === "void" ? "void" : win ? "win" : "loss",
          settledAt: now,
          round: roundForWrite,
          season: CURRENT_SEASON,
        },
        { merge: true }
      );

      if (isSponsorQuestion && outcome !== "void" && win) {
        sponsorWinners.push(userId);
      }
    });

    // Sponsor draw entries
    if (isSponsorQuestion && outcome !== "void" && sponsorWinners.length > 0) {
      const sponsorRoundRef = db
        .collection("sponsorDrawEntries")
        .doc(roundDocId);

      sponsorWinners.forEach((userId) => {
        const entryRef = sponsorRoundRef.collection("entries").doc(userId);
        batch.set(
          entryRef,
          {
            uid: userId,
            roundId: roundDocId,
            roundNumber: roundForWrite,
            questionId,
            outcome,
            season: CURRENT_SEASON,
            createdAt: now,
          },
          { merge: true }
        );
      });
    }

    // Settlement history
    batch.set(db.collection("settlementHistory").doc(), {
      questionId,
      outcome,
      action:
        outcome === "void"
          ? "void"
          : outcome === "yes"
          ? "settleYes"
          : "settleNo",
      round: roundForWrite,
      season: CURRENT_SEASON,
      settledAt: now,
      isSponsorQuestion: !!isSponsorQuestion,
      sponsorWinnerCount: isSponsorQuestion ? sponsorWinners.length : 0,
    });

    await batch.commit();

    // Mirror into questionStatus so Picks sees the new status/outcome
    await db
      .collection("questionStatus")
      .doc(questionId)
      .set(
        {
          questionId,
          roundNumber: roundForWrite,
          status: finalStatus,
          outcome,
          updatedAt: now,
        },
        { merge: true }
      );

    return NextResponse.json({
      ok: true,
      status: finalStatus,
      outcome,
    });
  } catch (err: any) {
    console.error("Error in POST /api/settlement:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update settlement" },
      { status: 500 }
    );
  }
}
