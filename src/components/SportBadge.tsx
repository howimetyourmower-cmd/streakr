import Image from "next/image";
import { SPORTS, SportType } from "@/lib/sports";

export default function SportBadge({ sport }: { sport: SportType }) {
  const data = SPORTS[sport];

  if (!data) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 text-white text-xs">
      <Image
        src={data.icon}
        alt={data.name}
        width={14}
        height={14}
        className="opacity-90"
      />
      {data.name}
    </span>
  );
}
