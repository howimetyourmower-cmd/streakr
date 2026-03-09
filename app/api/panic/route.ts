// /app/api/panic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

export const dynamic = "force-dynamic";

const SEASON = 2026;

type PanicBody = {
  roundNumber?: number;
  gameId?: string;
  questionId?: string;
};

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  isSponsorQuestion?: boolean;
};

type ApiGame = {
  id: string;
  match: string;
  venue?: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games?: ApiGame[];
};

type ResolvedGameState = {
  gameId: string;
  startTimeUtc: string;
  nowUtc: string;
  countdownMs: number;
  isLocked: boolean;
  status: "scheduled" | "live" | "final";
  currentQuarter: number; // 0 pregame, 1-4 live quarters, 5 final
  source: "manual" | "squiggle" | "local";
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid ?? null;
  } catch (error) {
    console.error("[/api/panic] Failed to verify ID token", error);
    return null;
  }
}

function getBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function getSponsorQuestionIdForSeason(): Promise<string | null> {
  try {
    const snap = await db.collection("config").doc(`season-${SEASON}`).get();
    if (!snap.exists) return null;
    const data = snap.data() as Record<string, unknown>;
    const sponsorQuestion = (data?.sponsorQuestion ?? {}) as Record<string, unknown>;
    const qid = String(sponsorQuestion?.questionId ?? "").trim();
    return qid ? qid : null;
  } catch (e) {
    console.warn("[/api/panic] Failed to read sponsorQuestion config", e);
    return null;
  }
}

async function fetchRoundGames(req: NextRequest, roundNumber: number): Promise<ApiGame[]> {
  const base = getBaseUrl(req);
  const url = `${base}/api/picks?round=${encodeURIComponent(String(roundNumber))}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load round games (${res.status})`);
  }

  const json = (await res.json()) as PicksApiResponse;
  return Array.isArray(json.games) ? json.games : [];
}

async function fetchResolvedState(req: NextRequest, gameId: string, roundNumber: number): Promise<ResolvedGameState> {
  const base = getBaseUrl(req);
  const url = `${base}/api/games/resolve-state?gameId=${encodeURIComponent(gameId)}&roundNumber=${encodeURIComponent(
    String(roundNumber)
  )}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to resolve game state (${res.status})`);
  }

  return (await res.json()) as ResolvedGameState;
}

function panicAllowedForQuarter(questionQuarter: number, currentQuarter: number): boolean {
  if (!Number.isFinite(currentQuarter)) return false;
  if (currentQuarter < 1 || currentQuarter > 4) return false;

  // Full-game question: allow Panic only through Q3
  if (questionQuarter === 0) {
    return currentQuarter >= 1 && currentQuarter <= 3;
  }

  // Quarter-specific question: only during that quarter
  return currentQuarter === questionQuarter;
}

/**
 * PANIC BUTTON
 * - Requires the question already answered (a pick exists)
 * - One per round per user
 * - Decision is final
 * - Does NOT apply to sponsor question
 * - Only allowed during the valid live quarter window
 *
 * Writes:
 * panic/{uid}__{roundNumber}
 * panicVoids/{uid}__{roundNumber}__{questionId}
 *
 * Deletes:
 * picks/{uid}_{questionId}
 */
export async function POST(req: NextRequest) {
  const uid = await getUserIdFromRequest(req);
  if (!uid) return jsonError("Unauthorized", 401);

  let body: PanicBody = {};
  try {
    body = (await req.json()) as PanicBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const roundNumber = Number(body.roundNumber);
  const gameId = String(body.gameId ?? "").trim();
  const questionId = String(body.questionId ?? "").trim();

  if (!Number.isFinite(roundNumber) || roundNumber < 0) return jsonError("roundNumber is required", 400);
  if (!gameId) return jsonError("gameId is required", 400);
  if (!questionId) return jsonError("questionId is required", 400);

  let question: ApiQuestion | null = null;

  try {
    const games = await fetchRoundGames(req, roundNumber);
    const game = games.find((g) => String(g.id) === gameId);

    if (!game) {
      return jsonError("Game not found for this round", 404);
    }

    question = (game.questions || []).find((q) => String(q.id) === questionId) ?? null;
    if (!question) {
      return jsonError("Question not found for this game", 404);
    }
  } catch (e) {
    console.error("[/api/panic] Failed to load game/question", e);
    return jsonError("Could not validate question", 500);
  }

  const sponsorQuestionId = await getSponsorQuestionIdForSeason();
  if (sponsorQuestionId && sponsorQuestionId === questionId) {
    return NextResponse.json({ ok: false, error: "Panic is not allowed on the sponsor question." }, { status: 409 });
  }

  if (question.isSponsorQuestion) {
    return NextResponse.json({ ok: false, error: "Panic is not allowed on sponsor questions." }, { status: 409 });
  }

  let resolved: ResolvedGameState;
  try {
    resolved = await fetchResolvedState(req, gameId, roundNumber);
  } catch (e) {
    console.error("[/api/panic] Failed to resolve game state", e);
    return jsonError("Could not validate Panic window", 500);
  }

  if (!resolved.isLocked || resolved.status !== "live") {
    return NextResponse.json({ ok: false, error: "Panic is only available during the live game." }, { status: 409 });
  }

  if (!panicAllowedForQuarter(Number(question.quarter ?? -1), Number(resolved.currentQuarter))) {
    return NextResponse.json(
      {
        ok: false,
        error: "Panic window closed for this question.",
        currentQuarter: resolved.currentQuarter,
        questionQuarter: question.quarter,
      },
      { status: 409 }
    );
  }

  const panicLockId = `${uid}__${roundNumber}`;
  const panicLockRef = db.collection("panic").doc(panicLockId);

  const pickRef = db.collection("picks").doc(`${uid}_${questionId}`);
  const panicVoidRef = db.collection("panicVoids").doc(`${uid}__${roundNumber}__${questionId}`);

  try {
    const result = await db.runTransaction(async (tx) => {
      // 1) One per round
      const lockSnap = await tx.get(panicLockRef);
      if (lockSnap.exists) {
        const data = lockSnap.data() as Record<string, unknown>;
        return {
          ok: false as const,
          error: "Panic already used for this round.",
          usedQuestionId: String(data?.questionId ?? "") || null,
        };
      }

      // 2) Must already have answered this question
      const pickSnap = await tx.get(pickRef);
      if (!pickSnap.exists) {
        return {
          ok: false as const,
          error: "Panic requires a question already answered.",
          usedQuestionId: null,
        };
      }

      const pickData = pickSnap.data() as Record<string, unknown>;
      const pickVal = String(pickData?.pick ?? "").toLowerCase();
      if (pickVal !== "yes" && pickVal !== "no") {
        return {
          ok: false as const,
          error: "Panic requires a valid YES/NO pick.",
          usedQuestionId: null,
        };
      }

      // 3) Write lock + marker
      tx.set(panicLockRef, {
        userId: uid,
        season: SEASON,
        roundNumber,
        gameId,
        questionId,
        createdAt: new Date(),
      });

      tx.set(panicVoidRef, {
        userId: uid,
        season: SEASON,
        roundNumber,
        gameId,
        questionId,
        previousPick: pickVal,
        createdAt: new Date(),
      });

      // 4) Remove the pick so it won't count
      tx.delete(pickRef);

      return { ok: true as const, questionId };
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, usedQuestionId: (result as { usedQuestionId?: string | null }).usedQuestionId ?? null },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      questionId: result.questionId,
      currentQuarter: resolved.currentQuarter,
      questionQuarter: question.quarter,
    });
  } catch (e) {
    console.error("[/api/panic] Transaction error", e);
    return jsonError("Server error", 500);
  }
}
