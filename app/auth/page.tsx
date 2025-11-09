"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../config/firebaseClient";

const TEAMS = [
  "Adelaide Crows","Brisbane Lions","Carlton","Collingwood","Essendon","Fremantle",
  "Geelong","Gold Coast","GWS Giants","Hawthorn","Melbourne","North Melbourne",
  "Port Adelaide","Richmond","St Kilda","Sydney","West Coast","Western Bulldogs",
];

export default function AuthPage() {
  const auth = getAuth(app);
  const db = getFirestore(app);
  const router = useRouter();

  const [mode, setMode] = useState<"login"|"signup">("signup");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [favouriteTeam, setFavouriteTeam] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/picks");
    });
    return () => unsub();
  }, [auth, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(cred.user, { displayName, photoURL: avatarUrl || undefined });
        }
        await setDoc(doc(db, "users", cred.user.uid), {
          displayName: displayName || null,
          email,
          favouriteTeam: favouriteTeam || null,
          avatarUrl: avatarUrl || null,
          createdAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.replace("/picks");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="mb-6 text-3xl font-extrabold">
          {mode === "signup" ? "Create your account" : "Log in"}
        </h1>

        <div className="mb-6 text-sm text-white/70">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            className="text-orange-400 underline"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "Log in" : "Create one"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {mode === "signup" && (
            <>
              <div>
                <label className="mb-1 block text-sm text-white/70">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
                  placeholder="Your name (shown on leaderboard)"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Favourite team</label>
                <select
                  value={favouriteTeam}
                  onChange={(e) => setFavouriteTeam(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
                >
                  <option value="">Select a team (optional)</option>
                  {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Avatar URL (optional)</label>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
                  placeholder="https://…"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm text-white/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/70">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
              placeholder="••••••••"
              required
            />
          </div>

          {err && <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div>}

          <button
            disabled={busy}
            className="w-full rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600 disabled:opacity-60"
          >
            {busy ? (mode === "signup" ? "Creating…" : "Logging in…") : (mode === "signup" ? "Sign up" : "Log in")}
          </button>

          <p className="text-xs text-white/50">
            By continuing, you confirm you’re 18+ and agree to our rules.
          </p>
        </form>
      </div>
    </main>
  );
}
