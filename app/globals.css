// app/components/FreeKickModal.tsx
"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onUse: () => void;
  onDismiss: () => void;
  title?: string;
  message?: string;
};

export default function FreeKickModal({
  open,
  onUse,
  onDismiss,
  title = "Use your FREE KICK?",
  message = "Your streak has just lost… but it doesn’t have to end here. Use your Free Kick to revive your streak and keep playing.",
}: Props) {
  // prevent background scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#111827] shadow-2xl ring-1 ring-white/10">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-bold text-orange-400">{title}</h2>
        </div>

        <div className="space-y-3 p-5 text-sm text-white/90">
          <p>{message}</p>
          <ul className="list-inside list-disc text-white/70">
            <li>Free Kick revives your current streak (no loss recorded).</li>
            <li>One Free Kick per user unless more are granted.</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 p-5">
          <button
            onClick={onDismiss}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          >
            Let it End
          </button>
          <button
            onClick={onUse}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
          >
            Use Free Kick
          </button>
        </div>
      </div>
    </div>
  );
}
