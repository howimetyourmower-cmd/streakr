// app/auth/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";

// --------------------------
// Helpers
// --------------------------
function getAgeFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}
function clsx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type TeamOption =
  | "Adelaide Crows"
  | "Brisbane Lions"
  | "Carlton"
  | "Collingwood"
  | "Essendon"
  | "Fremantle"
  | "Geelong Cats"
  | "Gold Coast Suns"
  | "GWS Giants"
  | "Hawthorn"
  | "Melbourne"
  | "North Melbourne"
  | "Port Adelaide"
  | "Richmond"
  | "St Kilda"
  | "Sydney Swans"
  | "West Coast Eagles"
  | "Western Bulldogs";

const TEAMS: TeamOption[] = [
  "Adelaide Crows",
  "Brisbane Lions",
  "Carlton",
  "Collingwood",
  "Essendon",
  "Fremantle",
  "Geelong Cats",
  "Gold Coast Suns",
  "GWS Giants",
  "Hawthorn",
  "Melbourne",
  "North Melbourne",
  "Port Adelaide",
  "Richmond",
  "St Kilda",
  "Sydney Swans",
  "West Coast Eagles",
  "Western Bulldogs",
];

// --------------------------
// Page
// --------------------------
export default function AuthPage() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // If already logged in, push them to picks
      if (u) {
        router.push("/picks");
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            STREAK<span className="text-orange-500">r</span>
          </h1>
          <p className="text-sm text-zinc-300 mt-1">
            Real Streakr&apos;s don&apos;t get caught.
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-2">
            <button
              className={clsx(
                "py-3 text-center font-semibold transition",
                mode === "signup"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-950 text-zinc-400 hover:text-white"
              )}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
            <button
              className={clsx(
                "py-3 text-center font-semibold transition",
                mode === "login"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-950 text-zinc-400 hover:text-white"
              )}
              onClick={() => setMode("login")}
            >
              Log In
            </button>
          </div>

          {mode === "signup" ? <SignUpPanel /> : <LoginPanel />}
        </div>

        {user && (
          <p className="mt-4 text-center text-sm text-green-400">
            Signed in as{" "}
            <span className="font-semibold">{user.email}</span>.
          </p>
        )}
      </div>
    </main>
  );
}

// --------------------------
// Sign Up
// --------------------------
function SignUpPanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState(""); // yyyy-mm-dd
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("VIC");
  const [team, setTeam] = useState<TeamOption | "">("");
  const [consentMinor, setConsentMinor] = useState(false);
  const [agreeAge16, setAgreeAge16] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const age = useMemo(() => getAgeFromDob(dob), [dob]);
  const isMinor = age !== null && age < 18;

  const canSubmit = useMemo(() => {
    if (!name || !email || !password || !dob || !team) return false;
    if (!agreeAge16) return false;
    if (age === null || age < 16) return false;
    if (isMinor && !consentMinor) return false;
    return true;
  }, [name, email, password, dob, team, agreeAge16, age, isMinor, consentMinor]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!canSubmit) return;

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Create Firestore profile if missing
      const ref = doc(db, "users", cred.user.uid);
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          uid: cred.user.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          dob,
          suburb: suburb.trim(),
          state,
          team,
          createdAt: serverTimestamp(),
        });
      }

      await sendEmailVerification(cred.user);
      setMessage(
        "Sign-up successful! Check your email to verify, then log in to continue."
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSignUp} className="p-6 md:p-8 space-y-4">
      {message && (
        <div className="rounded-lg border border-green-700 bg-green-900/30 p-3 text-sm text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Your name"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password (min 8 chars)">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="••••••••"
          />
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            required
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
          />
          {age !== null && (
            <p
              className={clsx(
                "mt-1 text-xs",
                age < 16 ? "text-red-400" : "text-zinc-400"
              )}
            >
              Age: {age}
            </p>
          )}
        </Field>
        <Field label="Suburb">
          <input
            type="text"
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="e.g. Bentleigh"
          />
        </Field>
        <Field label="State">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
          >
            {"ACT,NSW,NT,QLD,SA,TAS,VIC,WA".split(",").map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Favourite team">
          <select
            required
            value={team}
            onChange={(e) => setTeam(e.target.value as TeamOption)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select team…</option>
            {TEAMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-orange-500"
            checked={agreeAge16}
            onChange={(e) => setAgreeAge16(e.target.checked)}
          />
          <span>
            I confirm I am{" "}
            <span className="font-semibold">16 years or older</span> and agree
            to the Streakr Rules.
          </span>
        </label>
        {isMinor && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-orange-500"
              checked={consentMinor}
              onChange={(e) => setConsentMinor(e.target.checked)}
            />
            <span>
              I am under 18 and have{" "}
              <span className="font-semibold">
                parent/guardian permission
              </span>{" "}
              to play.
            </span>
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className={clsx(
          "w-full rounded-xl py-3 font-semibold transition",
          canSubmit && !loading
            ? "bg-orange-500 hover:bg-orange-600 text-black"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
        )}
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-xs text-zinc-400">
        By creating an account you agree to our Terms and Privacy Policy.
      </p>
    </form>
  );
}

// --------------------------
// Login
// --------------------------
function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      setLoading(true);
      const { user } = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      if (!user.emailVerified) {
        setMessage(
          "You're signed in, but your email isn't verified yet. Please verify to access all features."
        );
      }
      // After login, onAuthStateChanged in AuthPage will push to /picks
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="p-6 md:p-8 space-y-4">
      {message && (
        <div className="rounded-lg border border-amber-700 bg-amber-900/30 p-3 text-sm text-amber-200">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Field label="Email">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="••••••••"
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className={clsx(
          "w-full rounded-xl py-3 font-semibold transition",
          !loading
            ? "bg-orange-500 hover:bg-orange-600 text-black"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
        )}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-xs text-zinc-400">
        Forgot password? Reset link coming soon.
      </p>
    </form>
  );
}

// --------------------------
// Small Field component
// --------------------------
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-300 mb-1 inline-block">{label}</span>
      {children}
    </label>
  );
}
