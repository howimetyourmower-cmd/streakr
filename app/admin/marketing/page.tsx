"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import Link from "next/link";

type MarketingUser = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  surname?: string;
  suburb?: string;
  state?: string;
  team?: string;
  createdAt?: string;
};

export default function MarketingPage() {
  const { user, isAdmin, loading } = useAuth();

  const [users, setUsers] = useState<MarketingUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      // not admin – nothing else to do, UI below will handle
      setLoadingList(false);
    }
  }, [user, isAdmin, loading]);

  useEffect(() => {
    const load = async () => {
      if (!user || !isAdmin) return;

      setLoadingList(true);
      setError("");

      try {
        const usersRef = collection(db, "users");
        // Only users with marketingOptIn === true
        const qRef = query(
          usersRef,
          where("marketingOptIn", "==", true),
          // createdAt is stored as ISO string in your signup code; this
          // orderBy is optional but nice if you want newest first.
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(qRef);

        const mapped: MarketingUser[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;

          return {
            id: docSnap.id,
            email: data.email ?? "",
            username: data.username ?? "",
            firstName: data.firstName ?? "",
            surname: data.surname ?? "",
            suburb: data.suburb ?? "",
            state: data.state ?? "",
            team: data.team ?? "",
            createdAt: data.createdAt ?? "",
          };
        });

        setUsers(mapped);
      } catch (err) {
        console.error("Failed to load marketing list", err);
        setError("Failed to load marketing list. Please try again.");
      } finally {
        setLoadingList(false);
      }
    };

    if (user && isAdmin) {
      load();
    }
  }, [user, isAdmin]);

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(s) ||
      (u.username ?? "").toLowerCase().includes(s) ||
      (u.firstName ?? "").toLowerCase().includes(s) ||
      (u.surname ?? "").toLowerCase().includes(s) ||
      (u.suburb ?? "").toLowerCase().includes(s)
    );
  });

  const handleExportCsv = () => {
    if (!users.length) return;

    const header = [
      "uid",
      "email",
      "username",
      "firstName",
      "surname",
      "suburb",
      "state",
      "team",
      "createdAt",
    ];

    const rows = users.map((u) => [
      u.id,
      u.email,
      u.username ?? "",
      u.firstName ?? "",
      u.surname ?? "",
      u.suburb ?? "",
      u.state ?? "",
      u.team ?? "",
      u.createdAt ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const v = String(cell ?? "");
            // Escape quotes and wrap in quotes
            const safe = v.replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "streakr-marketing-optin.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  // ---------- RENDER ----------

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Checking admin access…</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="max-w-md rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 px-6 py-8 shadow-xl border border-slate-700/70">
          <h1 className="text-2xl font-semibold mb-3">Admin access only</h1>
          <p className="text-sm text-slate-400 mb-4">
            This page is restricted to STREAKr admins.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      {/* Header bar */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-2">
            Admin · Marketing
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            Marketing opt-in list
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            View all STREAKr players who have opted in to receive marketing and
            news. Export the list for your email platform.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Top controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Summary
            </span>
            <span className="text-sm text-slate-200 mt-1">
              {loadingList
                ? "Loading…"
                : `${filteredUsers.length} of ${users.length} players shown`}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by email, username, name or suburb…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-72 rounded-full bg-black/40 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/70"
            />
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!users.length}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-xs sm:text-sm font-semibold text-black hover:bg-amber-400 transition disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-red-500/60 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Table / list */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr,1.5fr,1.2fr,1fr,1.5fr] gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800">
            <div>Player</div>
            <div>Contact</div>
            <div>Location</div>
            <div>Team</div>
            <div>Joined</div>
          </div>

          {loadingList && (
            <div className="px-4 py-6 text-sm text-slate-300">
              Loading players…
            </div>
          )}

          {!loadingList && !filteredUsers.length && !error && (
            <div className="px-4 py-6 text-sm text-slate-300">
              No players have opted into marketing yet.
            </div>
          )}

          {!loadingList &&
            filteredUsers.map((u) => (
              <div
                key={u.id}
                className="border-t border-slate-900/80 px-4 py-3 text-sm flex flex-col gap-2 md:grid md:grid-cols-[2fr,1.5fr,1.2fr,1fr,1.5fr] md:items-center"
              >
                {/* Player */}
                <div>
                  <div className="font-semibold text-slate-100">
                    {u.username || u.email}
                  </div>
                  {(u.firstName || u.surname) && (
                    <div className="text-xs text-slate-400">
                      {(u.firstName ?? "") + " " + (u.surname ?? "")}
                    </div>
                  )}
                  <div className="mt-1 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/40">
                    Marketing opted in
                  </div>
                </div>

                {/* Contact */}
                <div className="text-xs md:text-sm text-slate-200">
                  <div>{u.email}</div>
                  <div className="text-[11px] text-slate-400">
                    UID: {u.id}
                  </div>
                </div>

                {/* Location */}
                <div className="text-xs md:text-sm text-slate-200">
                  {u.suburb || u.state ? (
                    <>
                      {u.suburb && <span>{u.suburb}</span>}
                      {u.suburb && u.state && <span>, </span>}
                      {u.state && <span>{u.state}</span>}
                    </>
                  ) : (
                    <span className="text-slate-500 italic">
                      Not provided
                    </span>
                  )}
                </div>

                {/* Team */}
                <div className="text-xs md:text-sm text-slate-200">
                  {u.team || (
                    <span className="text-slate-500 italic">
                      Not set
                    </span>
                  )}
                </div>

                {/* Joined */}
                <div className="text-xs md:text-sm text-slate-200">
                  {u.createdAt
                    ? new Date(u.createdAt).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
