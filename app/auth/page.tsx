// app/auth/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

// ✅ uses your existing client
import { app } from "../config/firebaseClient";

import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

type FormState = {
  displayName: string;
  favouriteTeam: string;
  avatarFile?: File | null;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  suburb: string;
  state: string;
  password: string;
  dob: string; // yyyy-mm-dd
  terms: boolean;
};

const AFL_TEAMS = [
  "Adelaide Crows","Brisbane Lions","Carlton","Collingwood","Essendon","Fremantle",
  "Geelong Cats","Gold Coast Suns","GWS Giants","Hawthorn","Melbourne","North Melbourne",
  "Port Adelaide","Richmond","St Kilda","Sydney Swans","West Coast Eagles","Western Bulldogs",
];

const AU_STATES = ["VIC","NSW","QLD","SA","WA","TAS","ACT","NT"];

// Simple password rule: ≥8, one upper, one number
const PASS_RX = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]{8,}$/;

export default function AuthSignUpPage() {
  const auth = useMemo(() => getAuth(app), []);
  const db = useMemo(() => getFirestore(app), []);
  const storage = useMemo(() => getStorage(app), []);
  const [busy, setBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    displayName: "",
    favouriteTeam: "",
    avatarFile: null,
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    suburb: "",
    state: "",
    password: "",
    dob: "",
    terms: false,
  });

  // If user is already logged in, nudge
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setNotice("You're already logged in. You can head to Picks.");
    });
    return () => unsub();
  }, [auth]);

  // local validators
  const isAdult = (dob: string) => {
    if (!dob) return false;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    const adult = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
    return adult <= now;
  };

  const passwordOK = PASS_RX.test(form.password);

  const canSubmit =
    form.displayName.trim().length >= 2 &&
    form.firstName.trim().length >= 1 &&
    form.lastName.trim().length >= 1 &&
    form.email.includes("@") &&
    form.suburb.trim().length >= 2 &&
    AU_STATES.includes(form.state) &&
    isAdult(form.dob) &&
    passwordOK &&
    form.terms &&
    !busy;

  const onChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v =
        key === "avatarFile"
          ? (e as any).target.files?.[0] ?? null
          : (e.target as any).value;
      setForm((s) => ({ ...s, [key]: v }));
      if (key === "avatarFile") {
        const file = (e as any).target.files?.[0] as File | undefined;
        setAvatarPreview(file ? URL.createObjectURL(file) : null);
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!canSubmit) return;

    try {
      setBusy(true);

      // 1) Create auth account
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );

      // 2) Optional avatar upload
      let photoURL: string | null = null;
      if (form.avatarFile) {
        const path = `avatars/${cred.user.uid}/${Date.now()}_${form.avatarFile.name}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, form.avatarFile);
        photoURL = await getDownloadURL(ref);
      }

      // 3) Update auth profile (displayName + photo)
      await updateProfile(cred.user, {
        displayName: form.displayName.trim(),
        photoURL: photoURL ?? undefined,
      });

      // 4) Save profile doc
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        displayName: form.displayName.trim(),
        favouriteTeam: form.favouriteTeam || null,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim() || null,
        suburb: form.suburb.trim(),
        state: form.state,
        dob: form.dob, // ISO yyyy-mm-dd
        photoURL: photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNotice("Account created! You can now make picks.");
    } catch (err: any) {
      console.error(err);
      let msg = "Could not create your account. Please try again.";
      if (err?.code === "auth/email-already-in-use") msg = "That email is already in use.";
      if (err?.code === "auth/weak-password") msg = "Password is too weak.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Create your STREAKr account
        </h1>
        <p className="mt-3 text-zinc-300">
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Log in
          </Link>
          .
        </p>

        {notice && (
          <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          {/* Identity */}
          <fieldset className="rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-5">
            <legend className="px-2 text-lg font-semibold">Profile</legend>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextInput
                label="Display name*"
                placeholder="e.g. GlennM"
                value={form.displayName}
                onChange={onChange("displayName")}
              />
              <Select
                label="Favourite team"
                value={form.favouriteTeam}
                onChange={onChange("favouriteTeam")}
                options={["", ...AFL_TEAMS]}
              />
              <TextInput
                label="First name*"
                value={form.firstName}
                onChange={onChange("firstName")}
              />
              <TextInput
                label="Last name*"
                value={form.lastName}
                onChange={onChange("lastName")}
              />
              <TextInput
                label="Suburb*"
                value={form.suburb}
                onChange={onChange("suburb")}
              />
              <Select
                label="State*"
                value={form.state}
                onChange={onChange("state")}
                options={["", ...AU_STATES]}
              />
              <TextInput
                label="Mobile"
                type="tel"
                placeholder="04xx xxx xxx"
                value={form.mobile}
                onChange={onChange("mobile")}
              />
              <div className="flex flex-col">
                <label className="mb-1 text-sm text-zinc-300">Avatar (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onChange("avatarFile")}
                  className="rounded-xl border border-zinc-700 bg-black/40 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200 hover:file:bg-zinc-700"
                />
                {avatarPreview && (
                  <div className="mt-3">
                    <Image
                      src={avatarPreview}
                      alt="Avatar preview"
                      width={96}
                      height={96}
                      className="h-24 w-24 rounded-xl object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </fieldset>

          {/* Contact & Security */}
          <fieldset className="rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-5">
            <legend className="px-2 text-lg font-semibold">Sign up details</legend>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextInput
                label="Email*"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={onChange("email")}
              />
              <TextInput
                label="Password*"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={onChange("password")}
                help="Min 8 characters, include a capital and a number."
                valid={form.password.length > 0 ? passwordOK : undefined}
              />
              <TextInput
                label="Date of birth*"
                type="date"
                value={form.dob}
                onChange={onChange("dob")}
                help="You must be 18+ to play."
                valid={form.dob ? isAdult(form.dob) : undefined}
              />
            </div>
            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.terms}
                onChange={(e) => setForm((s) => ({ ...s, terms: e.target.checked }))}
                className="mt-1 h-5 w-5 rounded border-zinc-600 bg-black"
              />
              <span className="text-sm text-zinc-300">
                I confirm I’m 18+ and agree to the{" "}
                <Link href="/faq#integrity" className="underline underline-offset-4">
                  fair play
                </Link>{" "}
                and{" "}
                <Link href="/faq#privacy" className="underline underline-offset-4">
                  privacy
                </Link>{" "}
                policies.
              </span>
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>

          <div className="text-center text-sm text-zinc-400">
            By creating an account, you agree to our rules. You must be logged in to make a pick.
          </div>
        </form>
      </section>
    </main>
  );
}

/* ——— UI helpers ——— */

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
  valid,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  help?: string;
  valid?: boolean;
}) {
  const stateRing =
    valid === undefined
      ? "focus:ring-zinc-600/60"
      : valid
      ? "ring-1 ring-emerald-500 focus:ring-emerald-500"
      : "ring-1 ring-rose-500 focus:ring-rose-500";

  return (
    <div className="flex flex-col">
      <label className="mb-1 text-sm text-zinc-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`rounded-xl border border-zinc-700 bg-black/40 p-3 text-white placeholder-zinc-500 ${stateRing}`}
      />
      {help && <p className="mt-1 text-xs text-zinc-400">{help}</p>}
    </div>
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
    <div className="flex flex-col">
      <label className="mb-1 text-sm text-zinc-300">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="rounded-xl border border-zinc-700 bg-black/40 p-3"
      >
        {options.map((opt) => (
          <option key={opt || "none"} value={opt}>
            {opt || "Select…"}
          </option>
        ))}
      </select>
    </div>
  );
}
