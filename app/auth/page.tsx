// app/auth/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("signup");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign up extra fields
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");

  // Show/Hide passwords
  const [showPasswordSignup, setShowPasswordSignup] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);

  // UI state
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, send them to Picks
  useEffect(() => {
    if (!loading && user) {
      router.push("/picks");
    }
  }, [user, loading, router]);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email || !password) {
      setError("Please enter an email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!username.trim()) {
      setError("Please choose a username.");
      return;
    }

    setSubmitting(true);
    try {
      // Check if username is already taken (simple, non-indexed check)
      const usernameDocRef = doc(db, "usernames", username.trim().toLowerCase());
      const usernameSnap = await getDoc(usernameDocRef);
      if (usernameSnap.exists()) {
        setError("That username is already taken. Please choose another.");
        setSubmitting(false);
        return;
      }

      // Create auth account
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Firestore user profile
      const userRef = doc(db, "users", cred.user.uid);
      await setDoc(
        userRef,
        {
          uid: cred.user.uid,
          email: email.toLowerCase(),
          username: username.trim(),
          createdAt: new Date().toISOString(),
          currentStreak: 0,
          longestStreak: 0,
        },
        { merge: true }
      );

      // Reserve username -> uid mapping
      await setDoc(usernameDocRef, { uid: cred.user.uid });

      // Send verification email
      await sendEmailVerification(cred.user, {
        url: "https://streakr-mu.vercel.app/auth?mode=verified",
        handleCodeInApp: true,
      });

      setInfo(
        "Account created. We’ve sent a verification email – please check your inbox (and spam/promotions folder) and click the link to verify."
      );
      setError("");
    } catch (err: any) {
      console.error("Signup error", err);
      setError(err?.message || "Failed to sign up. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        setInfo(
          "You’re logged in, but your email isn’t verified yet. Some features may be limited until you click the link we sent."
        );
      }

      router.push("/picks");
    } catch (err: any) {
      console.error("Login error", err);
      setError(err?.message || "Failed to log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-2xl px-6 py-6 md:px-8 md:py-8 shadow-xl">
        {/* Tabs */}
        <div className="flex mb-6 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              resetMessages();
            }}
            className={`flex-1 pb-2 text-center text-sm font-semibold ${
              isSignup
                ? "text-orange-400 border-b-2 border-orange-400"
                : "text-white/60 border-b-2 border-transparent"
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
              !isSignup
                ? "text-orange-400 border-b-2 border-orange-400"
                : "text-white/60 border-b-2 border-transparent"
            }`}
          >
            Log in
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 text-xs rounded-md border border-red-500/60 bg-red-500/15 px-3 py-2 text-red-200">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 text-xs rounded-md border border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-emerald-200">
            {info}
          </div>
        )}

        {/* SIGN UP FORM */}
        {isSignup && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Username
              </label>
              <input
                type="text"
                className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                placeholder="E.g. BlueBaggers23"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Password
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPasswordSignup ? "text" : "password"}
                  className="flex-1 rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswordSignup((v) => !v)
                  }
                  className="text-[11px] px-3 py-2 rounded-md border border-white/20 bg-white/5 hover:bg-white/10"
                >
                  {showPasswordSignup ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Confirm password
              </label>
              <input
                type={showPasswordSignup ? "text" : "password"}
                className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <p className="text-[11px] text-white/50">
              By creating an account you confirm you&apos;re 18+ and agree to
              our Terms and Privacy Policy.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-full bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm py-2.5 transition disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Sign up"}
            </button>
          </form>
        )}

        {/* LOGIN FORM */}
        {!isSignup && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Password
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPasswordLogin ? "text" : "password"}
                  className="flex-1 rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswordLogin((v) => !v)
                  }
                  className="text-[11px] px-3 py-2 rounded-md border border-white/20 bg-white/5 hover:bg-white/10"
                >
                  {showPasswordLogin ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-full bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm py-2.5 transition disabled:opacity-60"
            >
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
