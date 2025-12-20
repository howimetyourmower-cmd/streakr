// /app/play/bbl/page.tsx
"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState, useEffect } from "react";

export default function BblHubClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [manualDocId, setManualDocId] = useState("");

  const docId = (params.get("docId") || "").trim();

  // Keep the input in sync if someone lands with ?docId=
  useEffect(() => {
    if (docId) setManualDocId(docId);
  }, [docId]);

  const picksHref = useMemo(() => {
    if (!docId) return "";
    return `/picks?sport=BBL&docId=${encodeURIComponent(docId)}`;
  }, [docId]);

  const goWithDocId = () => {
    const next = manualDocId.trim();
    if (!next) return;
    router.push(`/play/bbl?docId=${encodeURIComponent(next)}`);
  };

  const onPlay = () => {
    if (!docId) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    router.push(picksHref);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="text-sm text-white/70 hover:text-white">
          ← Back to sports
        </Link>

        <h1 className="mt-8 text-4xl font-extrabold text-[#FF7A00]">
          BBL STREAKr
        </h1>

        <p className="mt-3 max-w-xl text-white/80">
          Cricket Yes/No picks. Clean sweep per match — get one wrong and you’re
          back to zero.
        </p>

        {!docId ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#020617] p-5">
            <p className="text-sm text-white/70">
              Pick a match to start your BBL streak.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={manualDocId}
                onChange={(e) => setManualDocId(e.target.value)}
                placeholder="Enter match code (docId)"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-orange-400"
              />

              <button
                type="button"
                onClick={goWithDocId}
                disabled={!manualDocId.trim()}
                className="w-full sm:w-auto rounded-full bg-[#FF7A00] px-6 py-3 font-semibold text-black hover:bg-orange-500 transition disabled:opacity-40 disabled:hover:bg-[#FF7A00]"
              >
                Continue
              </button>
            </div>

            <p className="mt-3 text-xs text-white/45">
              (For now) you’ll enter a match code to load a specific BBL match.
              Next step is making this auto-load the next match.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className="mt-8 w-full sm:w-auto rounded-full bg-[#FF7A00] px-6 py-3 font-semibold text-black hover:bg-orange-500 transition"
          >
            Play BBL now
          </button>
        )}
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-2xl bg-[#050816] border border-white/10 p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold">Log in to play</h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-white/70 mb-4">
              You need a free STREAKr account to make picks and build your
              streak.
            </p>

            <div className="flex gap-3">
              <Link
                href={`/auth?mode=login&returnTo=${encodeURIComponent(
                  picksHref || "/picks?sport=BBL"
                )}`}
                className="flex-1 text-center rounded-full bg-orange-500 py-2 font-semibold text-black hover:bg-orange-400 transition"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodeURIComponent(
                  picksHref || "/picks?sport=BBL"
                )}`}
                className="flex-1 text-center rounded-full border border-white/20 py-2 hover:border-orange-400 hover:text-orange-300 transition"
                onClick={() => setShowAuthModal(false)}
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
