"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type LB = {
  displayName: string;
  team?: string;
  avatarUrl?: string;
  currentStreak: number;
  longestStreak: number;
  totalWins: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LB[]>([]);
  const [sortKey, setSortKey] = useState<"currentStreak"|"longestStreak"|"totalWins">("currentStreak");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "leaderboard"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map(d => d.data() as LB));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const sorted = useMemo(() => {
    const k = sortKey;
    return [...rows].sort((a, b) => (b[k] as number) - (a[k] as number));
  }, [rows, sortKey]);

  /* ...render table exactly as you have now... */
  return /* your table JSX with sorted rows */;
}
