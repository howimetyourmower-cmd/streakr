// app/leagues/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebaseClient";
import { collection, getDocs, doc } from "firebase/firestore";

export default function LeaguesHomePage() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // We find all leagues where this user is in the members subcollection
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      const list: any[] = [];

      for (const leagueDoc of leaguesSnap.docs) {
        const memberRef = doc(
          db,
          `leagues/${leagueDoc.id}/members/${user.uid}`
        );
        const memberSnap = await getDocs(
          collection(db, `leagues/${leagueDoc.id}/members`)
        );

        const isMember = memberSnap.docs.some((d) => d.id === user.uid);

        if (isMember) {
          list.push({
            id: leagueDoc.id,
            ...leagueDoc.data(),
          });
        }
      }

      setLeagues(list);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">Private Leagues</h1>

      <div className="flex gap-4 mb-8">
        <Link
          href="/leagues/create"
          className="bg-orange-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-orange-600"
        >
          Create League
        </Link>

        <Link
          href="/leagues/join"
          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-500"
        >
          Join League
        </Link>
      </div>

      {loading && <p>Loading leagues…</p>}

      {!loading && leagues.length === 0 && (
        <p className="text-gray-300">You are not in any private leagues yet.</p>
      )}

      {!loading && leagues.length > 0 && (
        <div className="space-y-4">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="block bg-slate-900/60 border border-white/10 rounded-lg p-4 hover:bg-slate-800 transition"
            >
              <h3 className="text-lg font-bold">{league.name}</h3>
              <p className="text-sm text-gray-400">League code: {league.code}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
