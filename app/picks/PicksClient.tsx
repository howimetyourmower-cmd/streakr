"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";

import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

// ---------- Types ----------
type Question = {
  id?: string;
  quarter: number;
  question: string;
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  match: string;
  venue?: string;
  startTime?: Timestamp | Date | string | null;
  status?: "open" | "pending" | "final" | "void";
  questions: Question[];
};

type RoundDoc = { games: Game[] };

type Row = {
  id: string;          // roundId-gi-qid
  roundId: string;
  match: string;
  venue: string;
  quarter: number;
  questionId: string;
  question: string;
  yesPercent: number;
  noPercent: number;
  startTime: Timestamp | Date | string | null;
  status: "open" | "pending" | "final" | "void";
};

// ---------- Utils ----------
const toDate = (v: Row["startTime"]): Date | null => {
  if (!v) return null;
  if (typeof (v as any)?.toDate === "function") {
    try { return (v as Timestamp).toDate(); } catch { /* ignore */ }
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "string") {
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
};

const fmtStart = (v: Row["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  return `${dayjs(d).format("ddd, D MMM")} • ${dayjs(d).format("h:mm A")} AEDT`;
};

// ---------- Component ----------
export default function PicksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<any>(null); // /users profile (for free kick tracking)
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // auth + load /users/{uid}
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setMe(snap.exists() ? snap.data() : null);
      } else {
        setMe(null);
      }
    });
    return () => unsub();
  }, []);

  // load rounds -> open rows
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const all: Row[] = [];
        snap.forEach((d) => {
          const roundId = d.id;
          const data = d.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            (Array.isArray(g.questions) ? g.questions : []).forEach((q, qi) => {
              const qid = String(q.id ?? qi);
              all.push({
                id: `${roundId}-${gi}-${qid}`,
                roundId,
                match: g.match ?? "TBD",
                venue: g.venue ?? "TBD",
                quarter: Number(q.quarter ?? 1),
                questionId: qid,
                question: q.question ?? "",
                yesPercent: Number(q.yesPercent ?? 0),
                noPercent: Number(q.noPercent ?? 0),
                startTime: g.startTime ?? null,
                status: (g.status as Row["status"]) ?? "open",
              });
            });
          });
        });

        const openSorted = all
          .filter((r) => r.status === "open")
          .sort((a, b) => {
            const ta = toDate(a.startTime)?.getTime() ?? 0;
            const tb = toDate(b.startTime)?.getTime() ?? 0;
            if (ta !== tb) return ta - tb;
            return a.quarter - b.quarter;
          });

        setRows(openSorted);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // simple Free Kick eligibility
  const canUseFreeKick = (roundId: string) => {
    if (!me) return false;
    if (!me.freeKickCredits || me.freeKickCredits <= 0) return false;
    const last = me.freeKickLastUsedRound as string | null | undefined;
    if (!last) return true;

    const toNum = (rid: string) => (rid === "OR" ? 0 : Number(rid.replace("R", "")));
    const nowN = toNum(roundId);
    const lastN = toNum(last);
    // usable every 4 rounds (adjust later to 3/5 per your rule)
    return (nowN - lastN) >= 4;
  };

  // render each card as its own component so we can keep independent state (useFreeKick)
  const Card: React.FC<{ r: Row }> = ({ r }) => {
    const [useFK, setUseFK] = useState(false);
    const eligibleFK = canUseFreeKick(r.roundId);

    const makePick = async (choice: "yes" | "no") => {
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const ref = doc(db, "picks", user.uid, r.roundId, r.questionId);
      await setDoc(
        ref,
        {
          roundId: r.roundId,
          questionId: r.questionId,
          match: r.match,
          quarter: r.quarter,
          choice,
          usedFreeKick: !!useFK,
          madeAt: serverTimestamp(),
        },
        { merge: true }
      );
      alert(`Saved: ${choice}${useFK ? " (Free Kick)" : ""}`);
    };

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
        <div className="flex items-center gap-2 text-xs md:text-sm text-white/70">
          <span className="inline-flex items-center justify-center rounded-md bg-white/10 px-2 py-0.5">Open</span>
          <span className="text-orange-400 font-semibold">{r.match}</span>
          <span className="ml-auto">{fmtStart(r.startTime)} • {r.venue}</span>
        </div>

        <div className="mt-2 font-semibold">{r.question}</div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => makePick("yes")}
            className="px-3 py-1.5 rounded-md bg-orange-500 text-black font-semibold hover:bg-orange-400"
          >
            Yes
          </button>
          <button
            onClick={() => makePick("no")}
            className="px-3 py-1.5 rounded-md bg-purple-600 text-white font-semibold hover:bg-purple-500"
          >
            No
          </button>

          <span className="ml-auto text-sm text-white/70">
            Yes {r.yesPercent}% · No {r.noPercent}%
          </span>
        </div>

        {user && (
          <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              className="h-4 w-4 accent-orange-500"
              disabled={!eligibleFK}
              checked={useFK}
              onChange={(e) => setUseFK(e.target.checked)}
            />
            <span>
              Use Free Kick on this pick {eligibleFK ? "" : "(not available this round)"}
            </span>
          </label>
        )}

        {!user && (
          <div className="mt-3 text-sm text-white/70">
            You must <Link className="underline text-orange-300" href="/login">sign in</Link> to make a pick.
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-10">
      <h1 className="text-3xl font-extrabold text-center text-orange-400 mb-2">Make Picks</h1>
      {/* Sponsor banner */}
      <div className="bg-white text-black text-center py-3 rounded-lg mb-6">Sponsor Banner • 970×90</div>

      {loading ? (
        <div className="text-white/70">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-white/70">No open selections.</div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => <Card key={r.id} r={r} />)}
        </div>
      )}
    </main>
  );
}
