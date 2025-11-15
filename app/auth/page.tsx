"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Profile fields for sign up
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [dob, setDob] = useState(""); // yyyy-mm-dd
  const [suburb, setSuburb] = useState("");
  const [stateField, setStateField] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [team, setTeam] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const handleSignup = async () => {
    resetMessages();

    if (!email || !password || !confirmPassword || !username || !firstName || !dob) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      // Create Firestore user doc
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email,
        username,
        firstName,
        surname,
        dob,
        suburb,
        state: stateField,
        phone,
        gender,
        team,
        avatarUrl: "",
        currentStreak: 0,
        longestStreak: 0,
        createdAt: new Date().toISOString(),
      });

      // Send verification email
      await sendEmailVerification(user);

      setInfo(
        "Account created. We’ve sent a verification email – please check your inbox and verify before playing."
      );

      // optional: redirect to login after a short delay
      // router.push("/picks");
    } catch (err: any) {
      console.error("Sign up error", err);
      setError(err?.message || "Failed to sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    resetMessages();
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        setInfo(
          "You’re logged in, but your email is not verified yet. Please check your inbox and click the verification link."
        );
      }

      router.push("/picks");
    } catch (err: any) {
      console.error("Login error", err);
      setError(err?.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      void handleSignup();
    } else {
      void handleLogin();
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050816] text-white px-4">
      <div className="w-full max-w-xl bg-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl">
        {/* Toggle */}
        <div className="flex mb-6 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              resetMessages();
            }}
            className={`flex-1 py-2 text-sm font-semibold ${
              mode === "signup"
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-gray-400"
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
            className={`flex-1 py-2 text-sm font-semibold ${
              mode === "login"
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-gray-400"
            }`}
          >
            Log in
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          {/* EMAIL + PASSWORD (both modes) */}
          <div>
            <label className="block mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === "signup" && (
            <>
              <div>
                <label className="block mb-1">Confirm password</label>
                <input
                  type="password"
                  className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {/* Username / First name / Surname */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Username</label>
                  <input
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">First name</label>
                  <input
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">Surname (optional)</label>
                <input
                  className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>

              {/* DOB / Suburb / State */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1">Date of birth</label>
                  <input
                    type="date"
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Suburb (optional)</label>
                  <input
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">State (optional)</label>
                  <input
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={stateField}
                    onChange={(e) => setStateField(e.target.value)}
                  />
                </div>
              </div>

              {/* Phone / Gender / Team */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1">Phone (optional)</label>
                  <input
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">Gender (optional)</label>
                  <select
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Favourite team (optional)</label>
                  <select
                    className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option>Adelaide Crows</option>
                    <option>Brisbane Lions</option>
                    <option>Carlton</option>
                    <option>Collingwood</option>
                    <option>Essendon</option>
                    <option>Fremantle</option>
                    <option>Geelong Cats</option>
                    <option>Gold Coast Suns</option>
                    <option>GWS Giants</option>
                    <option>Hawthorn</option>
                    <option>Melbourne</option>
                    <option>North Melbourne</option>
                    <option>Port Adelaide</option>
                    <option>Richmond</option>
                    <option>St Kilda</option>
                    <option>Sydney Swans</option>
                    <option>West Coast Eagles</option>
                    <option>Western Bulldogs</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 mt-1">
                We&apos;ll send a verification link to your email before you can
                start building your streak.
              </p>
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
          {info && <p className="text-xs text-emerald-400">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-black font-semibold py-2 rounded-md text-sm"
          >
            {loading
              ? mode === "signup"
                ? "Creating account…"
                : "Logging in…"
              : mode === "signup"
              ? "Create account"
              : "Log in"}
          </button>
        </form>
      </div>
    </main>
  );
}
