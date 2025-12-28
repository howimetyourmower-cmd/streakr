// /app/leagues/LeaguesClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
  description?: string;
  memberCount?: number;
  sport?: string;
};

type MyLeagueRow = {
  league: League;
  uiRole: "manager" | "member";
};

function safeStr(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function normalizeLeagueFromDoc(id: string, data: any): League {
  const managerId = safeStr(data?.managerId ?? data?.managerUid ?? data?.managerUID, "");
  const inviteCode = safeStr(data?.inviteCode ?? data?.code ?? data?.leagueCode, "");

  return {
    id,
    name: safeStr(data?.name, "Unnamed league"),
    inviteCode,
    managerId,
    description: safeStr(data?.description, ""),
    memberCount:
      typeof data?.memberCount === "number"
        ? data.memberCount
        : Array.isArray(data?.memberIds)
          ? data.memberIds.length
          : 0,
    sport: safeStr(data?.sport, "afl"),
  };
}

function uniqByLeagueId(list: MyLeagueRow[]) {
  const map = new Map<string, MyLeagueRow>();
  for (const x of list) map.set(x.league.id, x);
  return Array.from(map.values());
}

export default function LeaguesClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [myLeagues, setMyLeagues] = useState<MyLeagueRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => myLeagues.find((x) => x.league.id === selectedLeagueId) || null,
    [myLeagues, selectedLeagueId]
  );

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setMyLeagues([]);
        setSelectedLeagueId("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const uid = user.uid;

        // ✅ Primary source: users/{uid}.leagueIds (no indexes, very reliable)
        const userSnap = await getDoc(doc(db, "users", uid));
        const leagueIds: string[] = Array.isArray(userSnap.data()?.leagueIds)
          ? userSnap.data()!.leagueIds
          : [];

        const fromUserDoc: MyLeagueRow[] = await Promise.all(
          leagueIds.slice(0, 50).map(async (leagueId) => {
            const ls = await getDoc(doc(db, "leagues", leagueId));
            if (!ls.exists()) return null;

            const league = normalizeLeagueFromDoc(ls.id, ls.data());
            const uiRole: "manager" | "member" =
              league.managerId === uid ? "manager" : "member";

            return { league, uiRole };
          })
        ).then((x) => x.filter(Boolean) as MyLeagueRow[]);

        // ✅ Fallback: leagues where I’m manager (covers cases where user doc wasn’t updated)
        const leaguesRef = collection(db, "leagues");
        const managerQ = query(leaguesRef, where("managerId", "==", uid), limit(50));
        const managerSnap = await getDocs(managerQ);

        const fromManagerQuery: MyLeagueRow[] = managerSnap.docs.map((d) => {
          const league = normalizeLeagueFromDoc(d.id, d.data());
          return { league, uiRole: "manager" };
        });

        const merged = uniqByLeagueId([...fromUserDoc, ...fromManagerQuery]).sort((a, b) =>
          a.league.name.localeCompare(b.league.name)
        );

        setMyLeagues(merged);

        if (merged.length > 0) {
          setSelectedLeagueId((prev) => {
            if (prev && merged.some((x) => x.league.id === prev)) return prev;
            return merged[0].league.id;
          });
        } else {
          setSelectedLeagueId("");
        }
      } catch (e) {
        console.error(e);
        setError("Could not load your leagues. Please try again.");
        setMyLeagues([]);
        setSelectedLeagueId("");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.uid]);

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-orange-300">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
            Private leagues are live
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold">Leagues</h1>
          <p className="mt-2 text-sm text-white/70 max-w-3xl">
            Play STREAKr with your mates, work crew or fantasy league. Create a private league,
            invite your friends with a code, and battle it out on your own ladder while still
            counting towards the global streak leaderboard.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* LEFT: My leagues (home base) */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h2 className="text-xl font-bold">My leagues</h2>
            <p className="text-sm text-white/70">
              This is your home base. Jump into a league and hit the ladder.
            </p>

            {loading ? (
              <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-sm text-white/70">
                Loading…
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-sm text-white/70">
                No leagues yet — create one or join with a code.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-white/60">Select a league</label>
                  <select
                    value={selectedLeagueId}
                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                    className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  >
                    {myLeagues.map((x) => (
                      <option key={x.league.id} value={x.league.id}>
                        {x.league.name} {x.uiRole === "manager" ? "(Manager)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {selected.league.name} {selected.uiRole === "manager" ? "👑" : ""}
                        </div>

                        <div className="text-xs text-white/60 mt-1 flex items-center gap-2">
                          <span>Invite:</span>
                          <span className="font-mono bg-white/5 border border-white/10 rounded-md px-2 py-0.5">
                            {selected.league.inviteCode || "—"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!selected.league.inviteCode) return;
                              navigator.clipboard.writeText(selected.league.inviteCode);
                            }}
                            className="text-sky-400 hover:text-sky-300"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* BIG ORANGE VIEW LADDER */}
                    <button
                      type="button"
                      onClick={() => router.push(`/leagues/${selected.league.id}/ladder`)}
                      className="w-full inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-base px-5 py-3 transition-colors"
                    >
                      View ladder →
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/leagues/${selected.league.id}`)}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2 transition-colors"
                      >
                        Open league
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push(`/leagues/${selected.league.id}/manage`)}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2 transition-colors"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT: Create / Join shortcuts */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h2 className="text-xl font-bold">Create a league</h2>
            <p className="text-sm text-white/70">
              You&apos;re the commish. Name your league and share one invite code with the crew.
            </p>

            <ul className="text-sm text-white/70 list-disc pl-5 space-y-1">
              <li>Automatically become League Manager</li>
              <li>Share one code to invite players</li>
              <li>Everyone&apos;s streak still counts globally</li>
            </ul>

            <Link
              href="/leagues/create"
              className="w-full inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
            >
              Create league
            </Link>

            <Link
              href="/leagues/join"
              className="w-full inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2 transition-colors"
            >
              Join with a code
            </Link>

            <p className="text-xs text-white/50">
              Tip: your league ladder is separate bragging rights — your global streak still lives on the main leaderboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
