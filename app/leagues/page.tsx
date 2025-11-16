"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

type LeagueRow = {
  id: string;
  name: string;
  code: string;
  ownerUid: string;
  memberCount: number;
  isOwner: boolean;
};

export default function MyLeaguesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load leagues the user belongs to
  useEffect(() => {
    const loadLeagues = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const q = query(
          collection(db, "leagues"),
          where("memberIds", "array-contains", user.uid),
          orderBy("createdAt", "desc"),
          limit(50)
        );

        const snap = await getDocs(q);
        const rows: LeagueRow[] = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const memberIds: string[] = data.memberIds ?? [];

          rows.push({
            id: docSnap.id,
            name: data.name || "Untitled league",
            code: data.code || "",
            ownerUid: data.ownerUid || "",
            memberCount: memberIds.length,
            isOwner: data.ownerUid === user.uid,
          });
        });

        setLeagues(rows);
      } catch (err) {
        console.error("Failed to load leagues:", err);
        setError("Failed to load your leagues. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadLeagues();
    }
  }, [user, authLoading]);

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
        <h1 className="text-3xl font-bold mb-3">Private leagues</h1>
        <p className="text-gray-300 mb-6 text-sm">
          Log in to create or join private leagues and see your mates-only
          ladders.
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Private leagues</h1>
          <p className="text-sm text-gray-300">
            Create a league for your mates, or join theirs with a simple code.
            Everyone still plays the same global game – these ladders are just
            for bragging rights.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => router.push("/leagues/create")}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black text-sm font-semibold transition"
          >
            Create league
          </button>
          <button
            type="button"
            onClick={() => router.push("/leagues/join")}
            className="px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-700 hover:border-orange-400 hover:text-orange-300 text-sm font-semibold transition"
          >
            Join with code
          </button>
        </div>
      </div>

      {/* Status / errors */}
      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {loading && (
        <p className="text-sm text-gray-300">Loading your leagues…</p>
      )}

      {/* Empty state */}
      {!loading && leagues.length === 0 && !error && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-gray-200">
          <p className="font-semibold mb-2">You’re not in any leagues yet.</p>
          <p className="text-gray-300 mb-4">
            Create a league for your mates, or join one using an invite code.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/leagues/create")}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black text-sm font-semibold transition"
            >
              Create your first league
            </button>
            <button
              type="button"
              onClick={() => router.push("/leagues/join")}
              className="px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-700 hover:border-orange-400 hover:text-orange-300 text-sm font-semibold transition"
            >
              Join with a code
            </button>
          </div>
        </div>
      )}

      {/* List of leagues */}
      {!loading && leagues.length > 0 && (
        <section className="mt-4 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/90 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Your leagues
              </h2>
              <p className="text-xs text-gray-400">
                Tap a league to view its ladder and invite code.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              {leagues.length}{" "}
              {leagues.length === 1 ? "league" : "leagues"}
            </p>
          </div>

          <div className="divide-y divide-slate-800">
            {leagues.map((lg) => (
              <button
                key={lg.id}
                type="button"
                onClick={() => router.push(`/leagues/${lg.id}`)}
                className="w-full px-5 py-3 text-left text-sm flex items-center gap-4 hover:bg-slate-900/80 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">
                      {lg.name}
                    </p>
                    {lg.isOwner && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-400/40">
                        Commissioner
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Code:{" "}
                    <span className="font-mono tracking-wide text-orange-300">
                      {lg.code}
                    </span>{" "}
                    • {lg.memberCount}{" "}
                    {lg.memberCount === 1 ? "player" : "players"}
                  </p>
                </div>

                <div className="text-xs text-gray-400">
                  View ladder →
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
