"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  code: string;
  ownerUid: string;
  memberCount?: number;
};

export default function LeaguesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      setLoading(true);
      setError("");

      try {
        const leaguesRef = collection(db, "leagues");
        // We assume league docs have memberIds: string[]
        const q = query(leaguesRef, where("memberIds", "array-contains", user.uid));
        const snap = await getDocs(q);

        const list: League[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "Unnamed league",
            code: data.code ?? "—",
            ownerUid: data.ownerUid ?? "",
            memberCount: Array.isArray(data.memberIds) ? data.memberIds.length : undefined,
          };
        });

        setLeagues(list);
      } catch (err) {
        console.error("Failed to load leagues:", err);
        setError("Failed to load your leagues. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      load();
    } else {
      setLoading(false);
    }
  }, [user]);

  // If still checking auth
  if (authLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white">
        <p className="text-sm text-gray-300">Checking your session…</p>
      </main>
    );
  }

  // If not logged in
  if (!user) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-3">Private leagues</h1>
        <p className="text-gray-300 mb-6 text-sm">
          Log in or create an account to create a league with mates and track your streaks together.
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
          <h1 className="text-3xl font-bold mb-1">Private leagues</h1>
          <p className="text-gray-300 text-sm">
            Create a league for your mates or join one with a code. Your streaks will still count in the global ladder.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/leagues/create"
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black text-sm font-semibold transition"
          >
            Create league
          </Link>
          <Link
            href="/leagues/join"
            className="px-4 py-2 rounded-lg border border-white/20 hover:border-orange-400 hover:text-orange-400 text-sm font-semibold transition"
          >
            Join with code
          </Link>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {/* Loading state */}
      {loading && (
        <p className="text-gray-300 text-sm">Loading your leagues…</p>
      )}

      {/* No leagues */}
      {!loading && leagues.length === 0 && !error && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-gray-300">
          <p className="mb-3">
            You’re not in any private leagues yet.
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Create a league and share the code with your mates.</li>
            <li>Or join an existing league using a code they send you.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/leagues/create"
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black text-sm font-semibold transition"
            >
              Create league
            </Link>
            <Link
              href="/leagues/join"
              className="px-4 py-2 rounded-lg border border-white/20 hover:border-orange-400 hover:text-orange-400 text-sm font-semibold transition"
            >
              Join with code
            </Link>
          </div>
        </div>
      )}

      {/* League list */}
      {!loading && leagues.length > 0 && (
        <div className="mt-4 space-y-4">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="block rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-950/80 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10 transition p-5"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold">{league.name}</h2>
                    {league.ownerUid === user.uid && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-400/40">
                        You’re the commissioner
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Code:{" "}
                    <span className="font-mono tracking-wide text-orange-300">
                      {league.code}
                    </span>
                    {league.memberCount !== undefined && (
                      <span className="ml-3 text-gray-500">
                        • {league.memberCount}{" "}
                        {league.memberCount === 1 ? "player" : "players"}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="hidden md:inline">
                    View ladder &amp; members
                  </span>
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-orange-500 text-black font-bold text-sm">
                    &gt;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
