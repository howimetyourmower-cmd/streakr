// /app/api/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type JsonRow = {
  Round: string;
  Game: number;
  Match: string;
  Venue: string;
  StartTime: string;
  Question: string;
  Quarter: number;
  Status: string;
};

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion?: boolean;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  correctOutcome?: QuestionOutcome;
  correctPick?: boolean | null;
};

type ApiGame = {
  id: string;
  match: string;
  sport: string;
  venue: string;
  startTime: string;
  isUnlockedForPicks: boolean;    // NEW 🔥
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

// ------------------------------------------------
// FETCH GAME UNLOCK STATES 🔓
// ------------------------------------------------
async function getGameUnlockMap(roundNumber:number){
  const unlockMap:Record<string,{isUnlockedForPicks:boolean}> = {};
  const snap = await db.collection("games2026").where("round", "==", roundNumber).get();

  snap.forEach(d=>{
    const data = d.data();
    unlockMap[d.id] = {
      isUnlockedForPicks: data?.isUnlockedForPicks === true
    };
  });

  return unlockMap;
}

// ------------------------------------------------
// MAIN GET
// ------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  try{
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");
    const roundNumber = Math.max(0, Number(roundParam ?? 0));
    const roundCode = roundNumber === 0 ? "OR" : `R${roundNumber}`;

    const roundRows = rounds2026.filter((r)=> r.Round===roundCode);
    if(!roundRows.length) return NextResponse.json({games:[],roundNumber});

    // UNLOCK MAP 🔓
    const unlockMap = await getGameUnlockMap(roundNumber);

    const gamesByKey:Record<string,ApiGame>={};
    let qIndexMap:Record<string,number>={};

    for(const row of roundRows){
      const gameKey = `${roundCode}-G${row.Game}`;

      if(!gamesByKey[gameKey]){
        const unlockState = unlockMap[gameKey]?.isUnlockedForPicks ?? false;

        gamesByKey[gameKey] = {
          id:gameKey,
          match:row.Match,
          venue:row.Venue,
          startTime:row.StartTime,
          sport:"AFL",
          isUnlockedForPicks:unlockState,
          questions:[]
        };
        qIndexMap[gameKey]=0;
      }

      const qid=`${gameKey}-Q${++qIndexMap[gameKey]}`

      let status = row.Status.toLowerCase() as QuestionStatus;

      // 🔥 if game locked → all questions returned as pending (cannot pick)
      if(!gamesByKey[gameKey].isUnlockedForPicks){
        status="pending";
      }

      gamesByKey[gameKey].questions.push({
        id:qid,
        quarter:row.Quarter,
        question:row.Question,
        status,
        sport:"AFL"
      });
    }

    return NextResponse.json({games:Object.values(gamesByKey), roundNumber});

  }catch(e){
    console.error(e);
    return NextResponse.json({games:[],roundNumber:0},{status:500});
  }
}
