// /app/offline/page.tsx

export const dynamic = "force-dynamic";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-[12px] font-black tracking-[0.24em] text-white/60">SCREAMR</div>
        <h1 className="mt-2 text-2xl font-black">You’re offline</h1>
        <p className="mt-2 text-white/70">
          Reconnect to update picks, see live scores, and refresh questions.
        </p>

        <button
          type="button"
          className="mt-5 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-black tracking-[0.12em] text-white/85 hover:bg-white/10 transition"
          onClick={() => window.location.reload()}
        >
          RETRY
        </button>
      </div>
    </div>
  );
}
