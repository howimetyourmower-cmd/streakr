"use client";
import { useEffect, useState } from "react";
import { onToast } from "@/lib/toast";

type Item = { id: string; msg: string; kind: "success"|"info"|"error"; ms: number };

export default function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    return onToast(({ id, msg, kind = "info", ms = 3500 }) => {
      const item: Item = { id: id ?? crypto.randomUUID(), msg, kind, ms };
      setItems((prev) => [...prev, item]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== item.id)), ms);
    });
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[2500] mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            "pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1",
            t.kind === "success" && "bg-[#13361f] text-[#b6f7c3] ring-emerald-700/40",
            t.kind === "info" && "bg-[#0F2236] text-white ring-white/10",
            t.kind === "error" && "bg-[#3a0f0f] text-[#ffd4d4] ring-red-700/40",
          ].join(" ")}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
