// app/auth/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // show / hide toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/picks");
    } catch (err: any) {
      console.error("Login error", err);
      setError(err?.message || "Failed to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (signupPassword !== signupPasswordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        signupPassword
      );

      // Fire off verification email (can fine-tune later)
      try {
        await sendEmailVerification(userCred.user);
      } catch (err) {
        console.warn("Failed to send verification email", err);
      }

      setSuccess(
        "Account created. Check your inbox for a verification email, then log in."
      );
      setMode("login");
      setPassword("");
      setSignupPassword("");
      setSignupPasswordConfirm("");
    } catch (err: any) {
      console.error("Signup error", err);
      setError(err?.message || "Failed to sign up. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-black/40 border border-white/10 shadow-2xl px-6 py-8">
        {/* Tabs */}
        <div className="flex mb-6 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              resetMessages();
            }}
            className={`flex-1 pb-2 text-center text-sm font-semibold ${
              mode === "signup"
                ? "text-orange-400 border-b-2 border-orange-500"
                : "text-white/50 border-b-2 border-transparent"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              resetMessages();
            }}
            className={`flex-1 pb-2 text-center text-sm font-semibold ${
              mode === "login"
                ? "text-orange-400 border-b-2 border-orange-500"
                : "text-white/50 border-b-2 border-transparent"
            }`}
          >
            Log in
          </button>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="mb-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 rounded-md px-3 py-2">
            {success}
          </p>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Password</label>
              <div className="relative">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wide text-slate-300 bg-white/5 px-2 py-1 rounded-full border border-white/10"
                >
                  {showLoginPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-md py-2.5 text-sm transition disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm mb-1">Password</label>
              <div className="relative">
                <input
                  type={showSignupPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wide text-slate-300 bg-white/5 px-2 py-1 rounded-full border border-white/10"
                >
                  {showSignupPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Minimum 6 characters.
              </p>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm mb-1">Confirm password</label>
              <div className="relative">
                <input
                  type={showSignupConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={signupPasswordConfirm}
                  onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSignupConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wide text-slate-300 bg-white/5 px-2 py-1 rounded-full border border-white/10"
                >
                  {showSignupConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-md py-2.5 text-sm transition disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </form>
        )}

        <p className="mt-4 text-[11px] text-slate-400 text-center">
          Free game of skill • No gambling • 18+ only
        </p>
      </div>
    </main>
  );
}
