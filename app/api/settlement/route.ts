// app/api/settlement/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";
import { CURRENT_SEASON } from "@/lib/rounds";

type QuestionStatus = "open" | "pending" | "final" | "void";

type SettlementQuestion = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  round?: number;
};

function toIso(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
}

/**
 * Find a question by its ID inside rounds/games/questions
 * (searches all rounds for CURRENT_SEASON).
 */
async function findQuestionById(questionId: string) {
  const roundsSnap = await db
    .collection("rounds")
    .where("season", "==", CURRENT_SEASON)
    .get();

  for (const roundDoc of roundsSnap.docs) {
    const data = roundDoc.data() as any;
    const games = data.games ?? [];

    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi];
      const questions = g.questions ?? [];

      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        const id = q.id ?? `${roundDoc.id}_game_${gi}_q${qi + 1}`;
        if (id === questionId) {
          return {
            roundDocId: roundDoc.id,
            roundNumber: data.roundNumber ?? null,
            games,
            gameIndex: gi,
            questionIndex: qi,
            question: { ...q, id },
          };
        }
      }
    }
  }

  return null;
}

/** GET – list questions to settle for the console */
export async function GET() {
  try {
    // Only show questions from PUBLISHED rounds for this season
    const roundsSnap = await db
      .collection("rounds")
      .where("season", "==", CURRENT_SEASON)
      .where("published", "==", true)
      .get();

    const questions: SettlementQuestion[] = [];

    roundsSnap.forEach((roundDoc) => {
      const data = roundDoc.data() as any;
      const roundNumber: number | undefined = data.roundNumber;
      const games = data.games ?? [];

      games.forEach((g: any, gi: number) => {
        const gameId = `${roundDoc.id}_game_${gi}`;
        const match = g.match ?? g.fixture ?? "TBD match";
        const venue = g.venue ?? "TBD venue";
        const startTimeIso = toIso(g.startTime ?? g.kickoffTime);

        (g.questions ?? []).forEach((q: any, qi: number) => {
          const id = q.id ?? `${gameId}_q${qi + 1}`;
          const status: QuestionStatus =
            q.status === "pending" ||
            q.status === "final" ||
            q.status === "void"
              ? q.status
              : "open";

          questions.push({
            id,
            gameId,
            match,
            venue,
            startTime: startTimeIso,
            quarter: Number(q.quarter ?? 1),
            question: q.question ?? "",
            status,
            round: roundNumber,
          });
        });
      });
    });

    questions.sort((a, b) => {
      const t = a.startTime.localeCompare(b.startTime);
      if (t !== 0) return t;
      return a.quarter - b.quarter;
    });

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("Error in GET /api/settlement:", err);
    return NextResponse.json(
      { error: "Failed to load questions for settlement" },
      { status: 500 }
    );
  }
}

/** POST – lock / settle / void / reopen a question and update streaks */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const questionId: string | undefined = body.questionId;
    const action: string | undefined = body.action;

    if (!questionId || !action) {
      return NextResponse.json(
        { error: "Missing questionId or action" },
        { status: 400 }
      );
    }

    const found = await findQuestionById(questionId);
    if (!found) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const {
      roundDocId,
      roundNumber,
      games,
      gameIndex,
      questionIndex,
      question,
    } = found;

    const roundRef = db.collection("rounds").doc(roundDocId);
    const now = Timestamp.now();

    // Reference to questionStatus overrides used by /api/picks
    const qsRef = db.collection("questionStatus").doc(questionId);

    // ───────────────── LOCK ─────────────────
    if (action === "lock") {
      const updatedQuestion = {
        ...question,
        status: "pending" as QuestionStatus,
        lockedAt: now,
      };

      games[gameIndex].questions[questionIndex] = updatedQuestion;
      await roundRef.update({ games });

      // Override for Picks page
      await qsRef.set(
        {
          questionId,
          roundNumber: roundNumber ?? null,
          status: "pending" as QuestionStatus,
          updatedAt: now,
        },
        { merge: true }
      );

      await db.collection("settlementHistory").add({
        questionId,
        action: "lock",
        round: roundNumber ?? null,
        season: CURRENT_SEASON,
        lockedAt: now,
      });

      return NextResponse.json({ ok: true, status: "pending" });
    }

    // ──────────────── REOPEN (back to OPEN) ────────────────
    if (action === "reopen") {
      const updatedQuestion = {
        ...question,
        status: "open" as QuestionStatus,
        lockedAt: null,
        settledAt: null,
        outcome: undefined,
      };

      games[gameIndex].questions[questionIndex] = updatedQuestion;
      await roundRef.update({ games });

      // Tell Picks that this question is open again
      await qsRef.set(
        {
          questionId,
          roundNumber: roundNumber ?? null,
          status: "open" as QuestionStatus,
          updatedAt: now,
        },
        { merge: true }
      );

      await db.collection("settlementHistory").add({
        questionId,
        action: "reopen",
        round: roundNumber ?? null,
        season: CURRENT_SEASON,
        reopenedAt: now,
      });

      return NextResponse.json({ ok: true, status: "open" });
    }

    // ──────────────── Determine outcome for settle / void ────────────────
    let outcome: "yes" | "no" | "void";
    if (action === "void") {
      outcome = "void";
    } else if (action === "yes" || action === "settleYes") {
      outcome = "yes";
    } else if (action === "no" || action === "settleNo") {
      outcome = "no";
    } else {
      return NextResponse.json(
        { error: "Unknown action" },
        { status: 400 }
      );
    }

    const finalStatus: QuestionStatus =
      outcome === "void" ? "void" : "final";

    const updatedQuestion: any = {
      ...question,
      status: finalStatus,
      outcome,
      settledAt: now,
    };

    games[gameIndex].questions[questionIndex] = updatedQuestion;
    await roundRef.update({ games });

    // Is this the sponsor question for this round?
    const isSponsorQuestion =
      updatedQuestion && updatedQuestion.isSponsorQuestion === true;

    // ──────────────── Update questionStatus for Picks ────────────────
    await qsRef.set(
      {
        questionId,
        roundNumber: roundNumber ?? null,
        status: finalStatus,
        outcome,
        updatedAt: now,
      },
      { merge: true }
    );

    // ──────────────── Update streaks + picks ────────────────
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
          lastSettledRound: roundNumber ?? null,
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
          round: roundNumber ?? null,
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
            roundNumber: roundNumber ?? null,
            questionId,
            outcome,
            season: CURRENT_SEASON,
            createdAt: now,
          },
          { merge: true }
        );
      });
    }

    // History record
    batch.set(db.collection("settlementHistory").doc(), {
      questionId,
      outcome,
      action:
        outcome === "void"
          ? "void"
          : outcome === "yes"
          ? "settleYes"
          : "settleNo",
      round: roundNumber ?? null,
      season: CURRENT_SEASON,
      settledAt: now,
      isSponsorQuestion: !!isSponsorQuestion,
      sponsorWinnerCount: isSponsorQuestion ? sponsorWinners.length : 0,
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      status: finalStatus,
      outcome,
    });
  } catch (err) {
    console.error("Error in POST /api/settlement:", err);
    return NextResponse.json(
      { error: "Failed to update settlement" },
      { status: 500 }
    );
  }
}
