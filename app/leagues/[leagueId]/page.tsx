"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/firebaseClient";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

type LeagueDoc = {
  name: string;
  code: string;
  ownerUid: string;
  memberIds?: string[];
  createdAt?: { seconds: number; nanoseconds: number };
};

type MemberRow = {
  uid: string;
  displayName: string;
  team: string;
  currentStreak: number;
  longestStreak: number;
  avatarUrl?: string;
  isYou: boolean;
};

export default function LeagueDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const { user, loading: authLoading } = useAuth();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notMember, setNotMember] = useState(false);

  // Load league + member profiles
  useEffect(() => {
    const loadLeague = async () => {
      if (!leagueId) return;
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setNotMember(false);

      try {
        // 1) Get league doc
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLeague(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        const leagueData = leagueSnap.data() as LeagueDoc;
        setLeague(leagueData);

        const memberIds = leagueData.memberIds ?? [];

        // If current user not in league, show friendly msg
        if (!memberIds.includes(user.uid)) {
          setNotMember(true);
        }

        if (memberIds.length === 0) {
          setMembers([]);
          setLoading(false);
          return;
        }

        // 2) Load member profiles one-by-one (leagues are small, so this is fine)
        const memberRows: MemberRow[] = [];

        for (const uid of memberIds) {
          const userRef = doc(db, "users", uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) continue;

          const data = userSnap.data() as any;

          const displayName =
            data.username ||
            [data.firstName, data.surname].filter(Boolean).join(" ") ||
            data.name ||
            data.email ||
            "Player";

          memberRows.push({
            uid,
            displayName,
            team: data.team || "—",
            currentStreak: typeof data.currentStreak === "number" ? data.currentStreak : 0,
            longestStreak: typeof data.longestStreak === "number" ? data.longestStreak : 0,
            avatarUrl: data.avatarUrl || "/default-avatar.png",
            isYou: uid === user.uid,
          });
        }

        // 3) Sort: longest streak, then current streak, then name
        memberRows.sort((a, b) => {
          if (b.longestStreak !== a.longestStreak) {
            return b.longestStreak - a.longestStreak;
          }
          if (b.currentStreak !== a.currentStreak) {
            return b.currentStreak - a.currentStreak;
          }
          return a.displayName.localeCompare(b.displayName);
        });

        setMembers(memberRows);
      } catch (err) {
        console.error("Failed to load league detail:", err);
        setError("Failed to load this league. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (leagueId && user) {
      loadLeague();
    } else if (leagueId && !user && !authLoading) {
      setLoading(false);
    }
  }, [leagueId, user, authLoading]);

  const commissionerText = useMemo(() => {
    if (!league || !user) return "";
    return league.ownerUid === user.uid ? "You’re the commissioner" : "";
  }, [league, user]);

  // While checking auth
  if (authLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white">
        <p className="text-sm text-gray-300">Checking your session…</p>
      </main>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-3">Private league</h1>
        <p className="text-gray-300 mb-6 text-sm">
          Log in to view private league ladders and streaks.
        </p>
        <button
          onClick={() => router.push("/auth")}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm transition"
        >
          Login / Sign up
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 text-white">
      {/* HEADER / META */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold">
              {league ? league.name : "League"}
            </h1>
            {commissionerText && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-400/40">
                {commissionerText}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-300">
            Private ladder for your mates. Streaks here are the same streaks you build on the global game.
          </p>

          {league && (
            <p className="text-xs text-gray-400 mt-3">
              League code:{" "}
              <span className="font-mono tracking-wide text-orange-300">
                {league.code}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/leagues")}
            className="text-xs text-gray-300 hover:text-orange-400 transition"
          >
            ← Back to my leagues
          </button>

          {league && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(league.code);
                  alert("League code copied.");
                } catch {
                  alert("Copy failed – you can highlight and copy the code manually.");
                }
              }}
              className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-700 hover:border-orange-400 hover:text-orange-300 text-xs font-medium transition"
            >
              Copy invite code
            </button>
          )}
        </div>
      </div>

      {/* STATUS MESSAGES */}
      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {notMember && !error && (
        <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-xs text-yellow-100">
          <p className="font-semibold mb-1">You’re not in this league.</p>
          <p>
            You can still see the ladder, but your streaks won’t appear here
            until you join using the league code.
          </p>
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-300">Loading league ladder…</p>
      )}

      {/* LADDER TABLE */}
      {!loading && !error && (
        <section className="mt-4 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/90 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                League ladder – longest streak
              </h2>
              <p className="text-xs text-gray-400">
                Ordered by longest streak, then current streak.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              {members.length}{" "}
              {members.length === 1 ? "player" : "players"}
            </p>
          </div>

          {members.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-300">
              No players in this league yet. Share the code with your mates and start building streaks.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {members.map((m, index) => (
                <div
                  key={m.uid}
                  className={`px-5 py-3 flex items-center gap-4 text-sm ${
                    m.isYou ? "bg-slate-900/70" : ""
                  }`}
                >
                  {/* Position */}
                  <div className="w-8 text-xs font-semibold text-gray-400">
                    {index + 1}
                  </div>

                  {/* Avatar + name */}
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="relative h-9 w-9 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
                      {m.avatarUrl ? (
                        <Image
                          src={m.avatarUrl}
                          alt={m.displayName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Image
                          src="/default-avatar.png"
                          alt="Avatar"
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {m.displayName}{" "}
                        {m.isYou && (
                          <span className="text-[11px] text-emerald-400 ml-1">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {m.team || "Team not set"}
                      </p>
                    </div>
                  </div>

                  {/* Current streak */}
                  <div className="w-28 text-right text-xs">
                    <div className="text-gray-400 uppercase tracking-wide text-[10px]">
                      Current
                    </div>
                    <div className="font-semibold">
                      {m.currentStreak}{" "}
                      <span className="text-gray-400">in a row</span>
                    </div>
                  </div>

                  {/* Longest streak */}
                  <div className="w-32 text-right text-xs">
                    <div className="text-gray-400 uppercase tracking-wide text-[10px]">
                      Longest
                    </div>
                    <div className="font-semibold">
                      {m.longestStreak}{" "}
                      <span className="text-gray-400">longest</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
