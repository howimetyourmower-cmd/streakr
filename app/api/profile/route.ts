// app/admin/marketing/page.tsx
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
  doc,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

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
  const router = useRouter();
  const { user, loading } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<MarketingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  // 1) Auth redirect + admin check
  useEffect(() => {
    const checkAdmin = async () => {
      if (loading) return;

      if (!user) {
        // Not logged in – send to auth
        router.push("/auth");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setIsAdmin(false);
          return;
        }

        const data = snap.data() as any;
        // Use whatever flag you prefer: isAdmin === true OR role === "admin"
        const adminFlag =
          data.isAdmin === true || data.role === "admin" || data.admin === true;

        setIsAdmin(adminFlag);
      } catch (err) {
        console.error("Admin check failed", err);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user, loading, router]);

  // 2) Load marketing users once we know it's an admin
  useEffect(() => {
    const load = async () => {
      if (isAdmin !== true) return;

      try {
        setLoadingUsers(true);
        setError("");

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
        setLoadingUsers(false);
      }
    };

    if (isAdmin === true) {
      load();
    }
  }, [isAdmin]);

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

  // -------------- RENDER STATES -------------- //

  // Still checking auth/admin
  if (loading || isAdmin === null) {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-8 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-white/70">Checking access…</p>
        </div>
      </main>
    );
  }

  // Logged in but not admin
  if (isAdmin === false) {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-8 sm:px-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">No access</h1>
          <p className="text-sm text-white/70">
            This page is for STREAKr admins only. If you think this is a
            mistake, contact the site owner.
          </p>
        </div>
      </main>
    );
  }

  // Admin view
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

        {loadingUsers && (
          <p className="text-sm text-white/70">Loading players…</p>
        )}
        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        {!loadingUsers && !error && users.length === 0 && (
          <p className="text-sm text-white/70">
            No players have opted in to marketing yet.
          </p>
        )}

        {!loadingUsers && !error && users.length > 0 && (
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
                    className={
                      idx % 2 === 0 ? "bg-slate-900" : "bg-slate-900/60"
                    }
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.email}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.username || "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.firstName || u.surname
                        ? `${u.firstName ?? ""} ${u.surname ?? ""}`.trim()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.team || "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {u.suburb || u.state
                        ? `${u.suburb ?? ""}${
                            u.suburb && u.state ? ", " : ""
                          }${u.state ?? ""}`
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
