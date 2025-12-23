// /app/auth/AuthClient.tsx
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

export default function AuthClient() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("signup");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign up extra fields
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [dob, setDob] = useState("");
  const [suburb, setSuburb] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [team, setTeam] = useState("");

  // New: consent checkboxes
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true); // pre-ticked

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

    // Basic validation
    if (!username.trim()) {
      setError("Please choose a username.");
      return;
    }
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

    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    if (!surname.trim()) {
      setError("Please enter your surname.");
      return;
    }
    if (!dob) {
      setError("Please enter your date of birth.");
      return;
    }
    if (!suburb.trim()) {
      setError("Please enter your suburb.");
      return;
    }
    if (!stateValue.trim()) {
      setError("Please select your state.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!team.trim()) {
      setError("Please select your favourite AFL team.");
      return;
    }

    // must accept T&Cs
    if (!acceptTerms) {
      setError("You must accept the Terms & Conditions to create an account.");
      return;
    }

    setSubmitting(true);
    try {
      // Check if username is already taken
      const cleanUsername = username.trim().toLowerCase();
      const usernameDocRef = doc(db, "usernames", cleanUsername);
      const usernameSnap = await getDoc(usernameDocRef);
      if (usernameSnap.exists()) {
        setError("That username is already taken. Please choose another.");
        setSubmitting(false);
        return;
      }

      // Create auth account
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const uid = cred.user.uid;
      const nowIso = new Date().toISOString();

      // Firestore user profile
      const userRef = doc(db, "users", uid);
      await setDoc(
        userRef,
        {
          uid,
          email: email.toLowerCase(),
          username: username.trim(),
          firstName: firstName.trim(),
          surname: surname.trim(),
          dob,
          suburb: suburb.trim(),
          state: stateValue.trim(),
          phone: phone.trim(),
          gender: gender || "",
          team,
          favouriteTeam: team,
          createdAt: nowIso,
          currentStreak: 0,
          longestStreak: 0,
          acceptedTerms: true,
          acceptedTermsAt: nowIso,
          marketingOptIn: !!marketingOptIn,
        },
        { merge: true }
      );

      // Reserve username -> uid mapping
      await setDoc(usernameDocRef, { uid });

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
            {/* Username */}
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

            {/* First name & Surname */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/70">
                  First name
                </label>
                <input
                  type="text"
                  className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/70">
                  Surname
                </label>
                <input
                  type="text"
                  className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>

            {/* DOB */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Date of birth
              </label>
              <input
                type="date"
                className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            {/* Suburb & State */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/70">
                  Suburb
                </label>
                <input
                  type="text"
                  className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/70">
                  State
                </label>
                <select
                  className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  value={stateValue}
                  onChange={(e) => setStateValue(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="VIC">VIC</option>
                  <option value="NSW">NSW</option>
                  <option value="QLD">QLD</option>
                  <option value="SA">SA</option>
                  <option value="WA">WA</option>
                  <option value="TAS">TAS</option>
                  <option value="ACT">ACT</option>
                  <option value="NT">NT</option>
                </select>
              </div>
            </div>

            {/* Phone */}
            <div className="
