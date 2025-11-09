"use client";

import { useMemo, useState } from "react";
import { app } from "../config/firebaseClient";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";

type Form = {
  displayName: string;
  favouriteTeam: string;
  avatarUrl: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  suburb: string;
  state: string;
  password: string;
  dob: string; // yyyy-mm-dd
};

const teams = [
  "", "Adelaide", "Brisbane", "Carlton", "Collingwood", "Essendon",
  "Fremantle", "Geelong", "Gold Coast", "GWS", "Hawthorn", "Melbourne",
  "North Melbourne", "Port Adelaide", "Richmond", "St Kilda", "Sydney", "West Coast",
];

export default function AuthPage() {
  const auth = useMemo(() => getAuth(app), []);
  const db = useMemo(() => getFirestore(app), []);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [f, setF] = useState<Form>({
    displayName: "",
    favouriteTeam: "",
    avatarUrl: "",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    suburb: "",
    state: "",
    password: "",
    dob: "",
  });

  const onChange =
    (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  async function handleSignup() {
    setMsg(null);
    setLoading(true);
    try {
      // Password: min 8 incl capital + number
      if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(f.password)) {
        throw new Error("Password must be 8+ chars, include a capital letter and a number.");
      }

      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      if (f.displayName) {
        await updateProfile(cred.user, { displayName: f.displayName, photoURL: f.avatarUrl || undefined });
      }

      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        displayName: f.displayName,
        favouriteTeam: f.favouriteTeam || null,
        avatarUrl: f.avatarUrl || null,
        firstName: f.firstName || null,
        lastName: f.lastName || null,
        email: f.email.trim(),
        mobile: f.mobile || null,
        suburb: f.suburb || null,
        state: f.state || null,
        dob: f.dob || null,
        createdAt: serverTimestamp(),
      });

      setMsg("Account created. Redirecting to Picks…");
      window.location.href = "/picks";
    } catch (e: any) {
      setMsg(e.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setMsg(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, f.email.trim(), f.password);
      setMsg("Welcome back! Redirecting…");
      window.location.href = "/picks";
    } catch (e: any) {
      setMsg(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white antialiased">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm text-white/70 hover:text-white">← Back to Home</Link>
          <button
            className="rounded-lg bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "Have an account? Log in" : "New here? Sign up"}
          </button>
        </div>

        <h1 className="mb-6 text-3xl font-extrabold">
          {mode === "signup" ? "Create your STREAKr account" : "Log in to STREAKr"}
        </h1>

        {mode === "signup" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Text label="Display name" value={f.displayName} onChange={onChange("displayName")} />
            <Select
              label="Favourite team"
              value={f.favouriteTeam}
              onChange={onChange("favouriteTeam")}
              options={teams}
            />
            <Text label="Avatar URL (optional)" value={f.avatarUrl} onChange={onChange("avatarUrl")} />
            <Text label="First name" value={f.firstName} onChange={onChange("firstName")} />
            <Text label="Last name" value={f.lastName} onChange={onChange("lastName")} />
            <Text label="Email" type="email" value={f.email} onChange={onChange("email")} />
            <Text label="Mobile" value={f.mobile} onChange={onChange("mobile")} />
            <Text label="Suburb" value={f.suburb} onChange={onChange("suburb")} />
            <Text label="State" value={f.state} onChange={onChange("state")} />
            <Text label="Password" type="password" value={f.password} onChange={onChange("password")} />
            <Text label="Date of birth" type="date" value={f.dob} onChange={onChange("dob")} />
          </div>
        )}

        {mode === "login" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Text label="Email" type="email" value={f.email} onChange={onChange("email")} />
            <Text label="Password" type="password" value={f.password} onChange={onChange("password")} />
          </div>
        )}

        {msg && <p className="mt-4 text-sm text-white/80">{msg}</p>}

        <div className="mt-8">
          {mode === "signup" ? (
            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-400 disabled:opacity-60"
            >
              {loading ? "Creating…" : "Sign Up"}
            </button>
          ) : (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-400 disabled:opacity-60"
            >
              {loading ? "Logging in…" : "Log In"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Text({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-white/80">{label}</span>
      <input
        className="rounded-lg border border-white/10 bg-[#11161c] px-3 py-2 outline-none ring-orange-500/40 focus:ring-2"
        value={value}
        onChange={onChange}
        type={type}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-white/80">{label}</span>
      <select
        className="rounded-lg border border-white/10 bg-[#11161c] px-3 py-2 outline-none ring-orange-500/40 focus:ring-2"
        value={value}
        onChange={onChange}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "— Select —"}
          </option>
        ))}
      </select>
    </label>
  );
}
