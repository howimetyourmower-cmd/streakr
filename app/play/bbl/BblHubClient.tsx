"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";

export default function BblHubClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);

  const docId = (params.get("docId") || "").trim();

  const picksHref = useMemo(() => {
    if (!docId) return "";
    return `/picks?sport=BBL&docId=${encodeURIComponent(docId)}`;
  }, [docId]);

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
              No BBL match is selected right now.
            </p>
            <p className="mt-2 text-xs text-white/50">
              Admin/testing: open{" "}
              <span className="text-orange-300">/play/bbl?docId=YOUR_DOC_ID</span>
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className="mt-8 rounded-full bg-[#FF7A00] px-6 py-3 font-semibold text-black hover:bg-orange-500 transition"
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
              You need a free STREAKr account to make picks and build your streak.
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
