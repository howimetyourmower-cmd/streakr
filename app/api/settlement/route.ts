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

/** Convert Firestore Timestamp | Date | string -> ISO string */
function toIso(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
}

/** Map numeric roundNumber -> code used in JSON IDs, e.g. 0 -> "OR", 1 -> "R1" */
function getRoundCodeForId(roundNumber: number | null | undefined): string {
  if (roundNumber === 0) return "OR";
  if (typeof roundNumber === "number") return `R${roundNumber}`;
  return "R?";
}

/**
 * Find a question by its ID inside rounds/games/questions
 * Looks through ALL rounds for CURRENT_SEASON (published or not),
 * since settlement might need to adjust older data.
 *
 * Supports both:
 * - legacy IDs:  <roundDoc.id>_game_<gi>_q<qi+1>
 * - new JSON IDs: <roundCode>-G<gi+1>-Q<qi+1>  (e.g. OR-G1-Q1)
 */
async function findQuestionById(questionId: string) {
  const roundsSnap = await db
    .collection("rounds")
    .where("season", "==", CURRENT_SEASON)
    .get();

  for (const roundDoc of roundsSnap.docs) {
    const data = roundDoc.data() as any;
    const games = data.games ?? [];
    const roundNumber: number | null =
      typeof data.roundNumber === "number" ? data.roundNumber : null;
    const roundCode = getRoundCodeForId(roundNumber);

    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi];
      const questions = g.questions ?? [];

      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];

        // Legacy ID (old system)
        const legacyId =
          q.id ?? `${roundDoc.id}_game_${gi}_q${qi + 1}`;

        // New ID, matching /api/picks and the JSON: OR-G1-Q1, R1-G3-Q5, etc.
        const jsonStyleId = `${roundCode}-G${gi + 1}-Q${qi + 1}`;

        if (questionId === legacyId || questionId === jsonStyleId) {
          return {
            roundDocId: roundDoc.id,
            roundNumber,
            games,
            gameIndex: gi,
            questionIndex: qi,
            // normalise the id to the JSON style so future lookups are consistent
            question: { ...q, id: jsonStyleId },
          };
        }
      }
    }
  }

  return null;
}

/** Helper to upsert the questionStatus doc used by /api/picks */
async function writeQuestionStatus(
  questionId: string,
  roundNumber: number | null,
  status: QuestionStatus,
  now: Timestamp
) {
  const ref = db.collection("questionStatus").doc(questionId);
  await ref.set(
    {
      questionId,
      roundNumber: roundNumber ?? null,
      status,
      updatedAt: now,
    },
    { merge: true }
  );
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
          const id =
            q.id ?? `${gameId}_q${qi + 1}`; // display can use either, POST uses the json-style id from /api/picks
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

    // sort by start time then quarter
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

/** POST – lock / reopen / settle / void a question and update streaks */
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

    // ───────────── LOCK ─────────────
    if (action === "lock") {
      const updatedQuestion = {
        ...question,
        status: "pending" as QuestionStatus,
        lockedAt: now,
      };

      games[gameIndex].questions[questionIndex] = updatedQuestion;
      await roundRef.update({ games });

      await writeQuestionStatus(question.id, roundNumber, "pending", now);

      await db.collection("settlementHistory").add({
        questionId: question.id,
        action: "lock",
        round: roundNumber ?? null,
        season: CURRENT_SEASON,
        lockedAt: now,
      });

      return NextResponse.json({ ok: true, status: "pending" });
    }

    // ───────────── REOPEN ─────────────
    if (action === "reopen") {
      const updatedQuestion = {
        ...question,
        status: "open" as QuestionStatus,
        reopenedAt: now,
      };

      games[gameIndex].questions[questionIndex] = updatedQuestion;
      await roundRef.update({ games });

      await writeQuestionStatus(question.id, roundNumber, "open", now);

      await db.collection("settlementHistory").add({
        questionId: question.id,
        action: "reopen",
        round: roundNumber ?? null,
        season: CURRENT_SEASON,
        reopenedAt: now,
      });

      return NextResponse.json({ ok: true, status: "open" });
    }

    // ───────────── SETTLE / VOID ─────────────
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

    await writeQuestionStatus(question.id, roundNumber, finalStatus, now);

    const isSponsorQuestion =
      updatedQuestion && updatedQuestion.isSponsorQuestion === true;

    // ---- Update streaks + picks for users whose ACTIVE pick is this question ----
    const usersSnap = await db
      .collection("users")
      .where("activeQuestionId", "==", question.id)
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
        typeof data.currentStreak === "number" ? data.currentStreak : 0;
      let longest =
        typeof data.longestStreak === "number" ? data.longestStreak : 0;

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
          lastSettledQuestionId: question.id,
          activeQuestionId: null,
          activePick: null,
        },
        { merge: true }
      );

      const pickId = `${userId}_${question.id}`;
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
            questionId: question.id,
            outcome,
            season: CURRENT_SEASON,
            createdAt: now,
          },
          { merge: true }
        );
      });
    }

    // history record
    batch.set(db.collection("settlementHistory").doc(), {
      questionId: question.id,
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
