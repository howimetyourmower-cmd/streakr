"use client";
export default function FreeKickModal({
  open, onUse, onEnd,
}: { open: boolean; onUse: () => Promise<void>|void; onEnd: () => Promise<void>|void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-[92%] max-w-[560px] rounded-2xl bg-[#0F2236] p-6 ring-1 ring-white/10 shadow-2xl">
        <h3 className="text-2xl font-extrabold text-white mb-2 text-center">Your streak has lost.</h3>
        <p className="text-white/80 text-center">
          But it doesn’t have to be that way. Use your <span className="text-[#ff9130] font-bold">FREE KICK</span> to keep your streak alive.
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={onUse} className="rounded-xl bg-[#ff9130] px-4 py-3 font-semibold text-black hover:opacity-90">Use Free Kick</button>
          <button onClick={onEnd} className="rounded-xl bg-white/10 px-4 py-3 font-semibold text-white hover:bg-white/15">Let it End</button>
        </div>
        <p className="mt-4 text-xs text-white/60 text-center">Shown only if you have a Free Kick available for your latest loss.</p>
      </div>
    </div>
  );
}
