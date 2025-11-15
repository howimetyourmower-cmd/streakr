// app/auth/page.tsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  FormEvent,
  ChangeEvent,
} from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  serverTimestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";

type Gender = "" | "female" | "male" | "nonbinary" | "other";

type SignUpForm = {
  email: string;
  password: string;
  username: string;
  firstName: string;
  surname: string;
  phone: string;
  dob: string;
  suburb: string;
  state: string;
  gender: Gender;
  team: string;
};

type LoginForm = {
  email: string;
  password: string;
};

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

export default function AuthPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signUpForm, setSignUpForm] = useState<SignUpForm>({
    email: "",
    password: "",
    username: "",
    firstName: "",
    surname: "",
    phone: "",
    dob: "",
    suburb: "",
    state: "",
    gender: "",
    team: "",
  });
  const [signUpError, setSignUpError] = useState("");
  const [signUpSubmitting, setSignUpSubmitting] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthLoading(false);
      if (u) {
        router.push("/picks");
      }
    });
    return () => unsub();
  }, [router]);

  const isSignUpValid = useMemo(() => {
    return (
      signUpForm.email.trim() &&
      signUpForm.password.trim().length >= 6 &&
      signUpForm.username.trim() &&
      signUpForm.firstName.trim() &&
      signUpForm.dob.trim()
    );
  }, [signUpForm]);

  const handleLoginChange = (field: keyof LoginForm, value: string) => {
    setLoginForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignUpChange = (field: keyof SignUpForm, value: string) => {
    setSignUpForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      setLoginError("Please enter your email and password.");
      return;
    }

    try {
      setLoginSubmitting(true);
      const cred = await signInWithEmailAndPassword(
        auth,
        loginForm.email.trim(),
        loginForm.password.trim()
      );

      if (!cred.user.emailVerified) {
        // not blocking, but we can nudge
        setLoginError("Logged in. Please verify your email to get full access.");
      } else {
        setLoginError("");
      }

      router.push("/picks");
    } catch (err: any) {
      console.error(err);
      let msg = "Failed to log in. Please try again.";
      if (err?.code === "auth/invalid-credential") {
        msg = "Incorrect email or password.";
      } else if (err?.code === "auth/user-not-found") {
        msg = "No account found with that email.";
      } else if (err?.code === "auth/wrong-password") {
        msg = "Incorrect password.";
      }
      setLoginError(msg);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSignUpError("");

    if (!isSignUpValid) {
      setSignUpError(
        "Please fill in email, password (6+ chars), username, first name and date of birth."
      );
      return;
    }

    try {
      setSignUpSubmitting(true);

      const email = signUpForm.email.trim();
      const password = signUpForm.password.trim();

      // Create auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      try {
        await sendEmailVerification(cred.user);
      } catch (err) {
        console.warn("Could not send verification email", err);
      }

      // Create Firestore user doc
      const userRef = doc(db, "users", cred.user.uid);
      const existingSnap = await getDoc(userRef);

      const baseData = {
        email,
        username: signUpForm.username.trim(),
        firstName: signUpForm.firstName.trim(),
        surname: signUpForm.surname.trim() || null,
        phone: signUpForm.phone.trim() || null,
        dob: signUpForm.dob.trim(),
        suburb: signUpForm.suburb.trim() || null,
        state: signUpForm.state.trim() || null,
        gender: (signUpForm.gender as Gender) || null,
        team: signUpForm.team || null,
        name: `${signUpForm.firstName.trim()} ${
          signUpForm.surname.trim() || ""
        }`.trim(),
        currentStreak: 0,
        longestStreak: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (existingSnap.exists()) {
        await setDoc(userRef, baseData, { merge: true });
      } else {
        await setDoc(userRef, baseData);
      }

      router.push("/picks");
    } catch (err: any) {
      console.error(err);
      let msg = "Failed to create account. Please try again.";
      if (err?.code === "auth/email-already-in-use") {
        msg = "That email is already in use.";
      } else if (err?.code === "auth/weak-password") {
        msg = "Password is too weak. Use at least 6 characters.";
      }
      setSignUpError(msg);
    } finally {
      setSignUpSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-300">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 text-white">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-center sm:text-left">
        Log in or create your STREAKr account
      </h1>

      <div className="grid gap-6 md:grid-cols-[1.1fr,1.4fr]">
        {/* LOGIN PANEL */}
        <form
          onSubmit={handleLoginSubmit}
          className="rounded-2xl bg-[#050818] border border-white/10 p-5 sm:p-6 shadow-xl flex flex-col"
        >
          <h2 className="text-xl font-semibold mb-4">Log in</h2>

          <label className="block text-xs mb-1 text-gray-400">
            Email address
          </label>
          <input
            type="email"
            value={loginForm.email}
            onChange={(e) => handleLoginChange("email", e.target.value)}
            className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />

          <label className="block text-xs mb-1 text-gray-400">Password</label>
          <div className="relative mb-2">
            <input
              type={showLoginPassword ? "text" : "password"}
              value={loginForm.password}
              onChange={(e) => handleLoginChange("password", e.target.value)}
              className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={() =>
                setShowLoginPassword((prev) => !prev)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
            >
              {showLoginPassword ? "Hide" : "Show"}
            </button>
          </div>

          {loginError && (
            <p className="text-xs text-red-400 mb-2">{loginError}</p>
          )}

          <button
            type="submit"
            disabled={loginSubmitting}
            className="mt-2 w-full rounded-md bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 px-4 py-2 text-sm font-semibold"
          >
            {loginSubmitting ? "Logging in…" : "Log in"}
          </button>

          <p className="mt-3 text-[11px] text-gray-400">
            Use the same account on web and mobile (when the app launches) to
            keep your streaks and rewards in sync.
          </p>
        </form>

        {/* SIGNUP PANEL */}
        <form
          onSubmit={handleSignUpSubmit}
          className="rounded-2xl bg-[#050818] border border-white/10 p-5 sm:p-6 shadow-xl flex flex-col gap-4"
        >
          <h2 className="text-xl font-semibold">Create an account</h2>
          <p className="text-xs text-gray-400 mb-1">
            We&apos;ll use these details for leaderboards and prizes. You can
            edit most of them later in your profile.
          </p>

          {/* Email + password */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Email address
              </label>
              <input
                type="email"
                value={signUpForm.email}
                onChange={(e) =>
                  handleSignUpChange("email", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showSignUpPassword ? "text" : "password"}
                  value={signUpForm.password}
                  onChange={(e) =>
                    handleSignUpChange("password", e.target.value)
                  }
                  className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowSignUpPassword((prev) => !prev)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
                >
                  {showSignUpPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          {/* Username / name / DOB */}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Username
              </label>
              <input
                type="text"
                value={signUpForm.username}
                onChange={(e) =>
                  handleSignUpChange("username", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="This will show on leaderboards"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                First name
              </label>
              <input
                type="text"
                value={signUpForm.firstName}
                onChange={(e) =>
                  handleSignUpChange("firstName", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Surname (optional)
              </label>
              <input
                type="text"
                value={signUpForm.surname}
                onChange={(e) =>
                  handleSignUpChange("surname", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Date of birth
              </label>
              <input
                type="date"
                value={signUpForm.dob}
                onChange={(e) =>
                  handleSignUpChange("dob", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Suburb
              </label>
              <input
                type="text"
                value={signUpForm.suburb}
                onChange={(e) =>
                  handleSignUpChange("suburb", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="e.g. Bentleigh"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                State
              </label>
              <input
                type="text"
                value={signUpForm.state}
                onChange={(e) =>
                  handleSignUpChange("state", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="e.g. VIC"
              />
            </div>
          </div>

          {/* Phone / gender / team */}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={signUpForm.phone}
                onChange={(e) =>
                  handleSignUpChange("phone", e.target.value)
                }
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Gender
              </label>
              <select
                value={signUpForm.gender}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleSignUpChange("gender", e.target.value as Gender)
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
              <label className="block text-xs mb-1 text-gray-400">
                Favourite AFL team
              </label>
              <select
                value={signUpForm.team}
                onChange={(e) =>
                  handleSignUpChange("team", e.target.value)
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

          {signUpError && (
            <p className="text-xs text-red-400">{signUpError}</p>
          )}

          <button
            type="submit"
            disabled={signUpSubmitting || !isSignUpValid}
            className="mt-2 w-full rounded-md bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 px-4 py-2 text-sm font-semibold"
          >
            {signUpSubmitting ? "Creating account…" : "Create account"}
          </button>

          <p className="mt-3 text-[11px] text-gray-400">
            By creating an account you agree to play fair and follow any
            competition terms. We&apos;ll only use your details for STREAKr
            (no spam).
          </p>
        </form>
      </div>
    </div>
  );
}
