   "use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  match: string;
  venue: string;
  startTime: string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

type QuestionRow = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
};

export default function AflHubPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const t1 = setTimeout(() => setFade(true), 3500);
    const t2 = setTimeout(() => {
      setShowPreloader(false);
      document.body.style.overflow = "";
    }, 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks?sport=AFL", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data: PicksApiResponse = await res.json();
        if (typeof data.roundNumber === "number") {
          setRoundNumber(data.roundNumber);
        }
        const flat = data.games.flatMap((g) =>
          g.questions
            .filter((q) => q.status === "open")
            .map((q) => ({
              id: q.id,
              match: g.match,
              venue: g.venue,
              startTime: g.startTime,
              quarter: q.quarter,
              question: q.question,
            }))
        );
        setQuestions(flat.slice(0, 6));
      } catch {
        setError("Failed to load preview questions.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePreviewPick = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    router.push("/picks?sport=AFL");
  };

  return (
    <main className="min-h-screen bg-black text-white relative">
      {showPreloader && (
        <div
          className={`fixed inset-0 z-50 bg-black transition-opacity duration-700 ${
            fade ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <video
            src="/preloadervideo.mp4"
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <Link href="/" className="text-sm text-white/70 hover:text-white">
          ← Back to sports
        </Link>

        <h1 className="mt-10 text-5xl font-extrabold text-[#FF7A00]">
          How Long Can You Last?
        </h1>

        <p className="mt-3 text-white/80 max-w-xl">
          Think you know your AFL? One wrong call and your streak is cooked.
        </p>

        <Link
          href="/picks?sport=AFL"
          className="inline-block mt-6 rounded-full bg-[#FF7A00] px-6 py-3 font-semibold text-black"
        >
          Play now
        </Link>

        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">Live preview</h2>

          {loading && <p className="text-white/60">Loading…</p>}
          {error && <p className="text-red-400">{error}</p>}

          <div className="space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-orange-500/30 bg-[#020617] p-4"
              >
                <p className="text-sm text-orange-300 mb-1">
                  Q{q.quarter} · {q.match}
                </p>
                <p className="font-semibold">{q.question}</p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handlePreviewPick}
                    className="rounded-full bg-green-600 px-4 py-1 text-sm font-bold"
                  >
                    Yes
                  </button>
                  <button
                    onClick={handlePreviewPick}
                    className="rounded-full bg-red-600 px-4 py-1 text-sm font-bold"
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#050816] p-6 rounded-xl max-w-sm w-full">
            <p className="mb-4 text-white/80">
              Log in to make picks and build your streak.
            </p>
            <div className="flex gap-3">
              <Link
                href="/auth?mode=login&returnTo=/picks?sport=AFL"
                className="flex-1 text-center rounded-full bg-orange-500 py-2 font-semibold text-black"
              >
                Login
              </Link>
              <Link
                href="/auth?mode=signup&returnTo=/picks?sport=AFL"
                className="flex-1 text-center rounded-full border border-white/20 py-2"
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
