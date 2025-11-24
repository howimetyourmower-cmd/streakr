// app/admin/marketing/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

type MarketingUser = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  surname?: string;
  team?: string;
  state?: string;
  suburb?: string;
  createdAt?: string;
};

export default function MarketingAdminPage() {
  const [users, setUsers] = useState<MarketingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        // All users who have marketingOptIn === true
        const usersRef = collection(db, "users");
        const qRef = query(
          usersRef,
          where("marketingOptIn", "==", true),
          orderBy("email", "asc")
        );

        const snap = await getDocs(qRef);

        const list: MarketingUser[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            email: data.email ?? "",
            username: data.username ?? "",
            firstName: data.firstName ?? "",
            surname: data.surname ?? "",
            team: data.team ?? "",
            state: data.state ?? "",
            suburb: data.suburb ?? "",
            createdAt: data.createdAt ?? "",
          };
        });

        setUsers(list);
      } catch (err) {
        console.error("Failed to load marketing users", err);
        setError("Failed to load marketing list.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleExportCsv = () => {
    try {
      setExporting(true);
      const header = [
        "email",
        "username",
        "firstName",
        "surname",
        "team",
        "state",
        "suburb",
        "createdAt",
      ];

      const rows = users.map((u) => [
        u.email,
        u.username ?? "",
        u.firstName ?? "",
        u.surname ?? "",
        u.team ?? "",
        u.state ?? "",
        u.suburb ?? "",
        u.createdAt ?? "",
      ]);

      const csvLines = [
        header.join(","),
        ...rows.map((r) =>
          r
            .map((field) => {
              const value = (field ?? "").toString().replace(/"/g, '""');
              return `"${value}"`;
            })
            .join(",")
        ),
      ];

      const blob = new Blob([csvLines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "streakr-marketing-optin.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export error", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Marketing opt-in list
            </h1>
            <p className="text-sm text-white/70">
              All players who have opted in to receive STREAKr news and
              promotions.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || users.length === 0}
            className="inline-flex items-center rounded-full bg-orange-500 px-4 py-2 text-xs sm:text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </header>

        {loading && <p className="text-sm text-white/70">Loading…</p>}
        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && users.length === 0 && (
          <p className="text-sm text-white/70">
            No players have opted in to marketing yet.
          </p>
        )}

        {!loading && !error && users.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-800/80 text-white/80">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Username</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Team</th>
                  <th className="px-4 py-2">Suburb / State</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={idx % 2 === 0 ? "bg-slate-900" : "bg-slate-900/60"}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.email}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.username || "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {(u.firstName || u.surname)
                        ? `${u.firstName ?? ""} ${u.surname ?? ""}`.trim()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.team || "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.suburb || u.state
                        ? `${u.suburb ?? ""}${u.suburb && u.state ? ", " : ""}${
                            u.state ?? ""
                          }`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-white/70">
                      {u.createdAt || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
