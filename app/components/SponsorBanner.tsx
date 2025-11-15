// components/SponsorBanner.tsx
import Link from "next/link";

export default function SponsorBanner() {
  return (
    <div className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 text-white text-xs md:text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-2">
        <p className="font-medium tracking-wide text-center md:text-left">
          Sponsored by{" "}
          <span className="font-semibold">Your Sponsor Here</span>
        </p>

        <Link
          href="#"
          className="inline-flex items-center rounded-full bg-black/20 px-4 py-1 font-semibold hover:bg-black/30 transition text-[11px] md:text-xs"
        >
          Become a sponsor
        </Link>
      </div>
    </div>
  );
}
