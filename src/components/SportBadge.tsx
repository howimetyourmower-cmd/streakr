// src/components/SportBadge.tsx
"use client";

import Image from "next/image";
import { SPORTS, SportType } from "@/lib/sports";

type Props = {
  sport: SportType;
  className?: string;
};

export default function SportBadge({ sport, className }: Props) {
  const data = SPORTS[sport];
  if (!data) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium uppercase tracking-wide ${className ?? ""}`}
    >
      <Image
        src={data.icon}
        alt={data.name}
        width={14}
        height={14}
        className="opacity-90"
      />
      <span>{data.name}</span>
    </span>
  );
}
