// app/auth/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

const AFL_TEAMS = [
  "Adelaide Crows",
  "Brisbane Lions",
  "Carlton",
  "Collingwood",
  "Essendon",
  "Fremantle Dockers",
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

type SignupForm = {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  firstName: string;
  surname: string;
  phone: string;
  dob: string;
  suburb: string;
  state: string;
  gender: string;
  favouriteTeam: string;
};

type LoginForm = {
  email: string;
  password: string;
};

export default function AuthPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("signup");

  const [signup, setSignup] = useState<SignupForm>({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    firstName: "",
    surname: "",
    phone: "",
    dob: "",
    suburb: "",
    state: "",
    gender: "",
    favouriteTeam: "",
  });

  const [login, setLogin] = useState<LoginForm>({
    email: "",
    password: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // If already logged in, go to profile
  useEffect(() => {
    if (user) {
      router.push("/profile");
    }
  }, [user, router]);

  const handleSignupChange = (field: keyof SignupForm, value: string) => {
    setSignup((prev) => ({ ...prev, [field]: value }));
  };

  const handleLoginChange = (field: keyof LoginForm, value: string) => {
    setLogin((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        // LOGIN
        await signInWithEmailAndPassword(auth, login.email, login.password);
        router.push("/profile");
      } else {
        // SIGNUP
        if (!signup.email || !signup.password) {
          throw new Error("Email and password are required.");
        }
        if (signup.password !== signup.confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (!signup.username.trim()) {
          throw new Error("Username is required.");
        }

        const cred = await createUserWithEmailAndPassword(
          auth,
          signup.email,
          signup.password
        );

        // Set displayName = username
        await updateProfile(cred.user, {
          displayName: signup.username.trim(),
        });

        // Create / merge user doc with all details
        const uid = cred.user.uid;
        const userRef = doc(db, "users", uid);

        // In case a doc already exists, we merge
        const existing = await getDoc(userRef);
        const existingData = existing.exists() ? existing.data() : {};

        const nameCombined =
          signup.firstName || signup.surname
            ? `${signup.firstName} ${signup.surname}`.trim()
            : signup.username.trim();

        await setDoc(
          userRef,
          {
            ...existingData,
            email: signup.email,
            username: signup.username.trim(),
            firstName: signup.firstName.trim() || null,
            surname: signup.surname.trim() || null,
            phone: signup.phone.trim() || null,
            dob: signup.dob || null,
            suburb: signup.suburb.trim() || null,
            state: signup.state.trim() || null,
            gender: signup.gender || null,
            team: signup.favouriteTeam || null, // matches ProfilePage "team"
            name: nameCombined, // ProfilePage uses "name"
            currentStreak: existingData.currentStreak ?? 0,
            longestStreak: existingData.longestStreak ?? 0,
            createdAt: existingData.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Send verification email (best-effort; don't block on error)
        try {
          await sendEmailVerification(cred.user);
          setInfo("Account created. Verification email sent.");
        } catch (e) {
          console.warn("Failed to send verification email", e);
        }

        router.push("/profile");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#050818] border border-white/10 px-6 py-6 sm:px-8 sm:py-8 shadow-xl">
        {/* Header + toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {mode === "login" ? "Login to Streakr" : "Create your Streakr account"}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              One account for all your streaks and private leagues.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setMode((m) => (m === "login" ? "signup" : "login"))
            }
            className="self-start sm:self-auto text-xs text-orange-400 underline"
          >
            {mode === "login"
              ? "New here? Sign up"
              : "Already have an account? Login"}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <p className="mb-3 text-sm text-red-400 bg-red-900/30 rounded px-3 py-2">
            {error}
          </p>
        )}
        {info && (
          <p className="mb-3 text-sm text-green-400 bg-emerald-900/20 rounded px-3 py-2">
            {info}
          </p>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {mode === "signup" ? (
            <>
              {/* Email + Username */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={signup.email}
                    onChange={(e) =>
                      handleSignupChange("email", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={signup.username}
                    onChange={(e) =>
                      handleSignupChange("username", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="This will be shown on leaderboards"
                  />
                </div>
              </div>

              {/* Name row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    First name
                  </label>
                  <input
                    type="text"
                    value={signup.firstName}
                    onChange={(e) =>
                      handleSignupChange("firstName", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Surname
                  </label>
                  <input
                    type="text"
                    value={signup.surname}
                    onChange={(e) =>
                      handleSignupChange("surname", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Phone + DOB */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={signup.phone}
                    onChange={(e) =>
                      handleSignupChange("phone", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    value={signup.dob}
                    onChange={(e) =>
                      handleSignupChange("dob", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Suburb + State */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Suburb
                  </label>
                  <input
                    type="text"
                    value={signup.suburb}
                    onChange={(e) =>
                      handleSignupChange("suburb", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. Bentleigh"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    State
                  </label>
                  <input
                    type="text"
                    value={signup.state}
                    onChange={(e) =>
                      handleSignupChange("state", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. VIC"
                  />
                </div>
              </div>

              {/* Gender + team */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Gender
                  </label>
                  <select
                    value={signup.gender}
                    onChange={(e) =>
                      handleSignupChange("gender", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Favourite AFL team
                  </label>
                  <select
                    value={signup.favouriteTeam}
                    onChange={(e) =>
                      handleSignupChange("favouriteTeam", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select a team</option>
                    {AFL_TEAMS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Passwords */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={signup.password}
                    onChange={(e) =>
                      handleSignupChange("password", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-300">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    required
                    value={signup.confirmPassword}
                    onChange={(e) =>
                      handleSignupChange("confirmPassword", e.target.value)
                    }
                    className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* LOGIN FORM */}
              <div>
                <label className="block text-xs mb-1 text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={login.email}
                  onChange={(e) => handleLoginChange("email", e.target.value)}
                  className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs mb-1 text-gray-300">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={login.password}
                  onChange={(e) =>
                    handleLoginChange("password", e.target.value)
                  }
                  className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 rounded-md bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 px-3 py-2 text-sm font-semibold"
          >
            {submitting
              ? mode === "login"
                ? "Logging in…"
                : "Creating account…"
              : mode === "login"
              ? "Login"
              : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
