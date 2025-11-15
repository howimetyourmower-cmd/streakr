// app/components/SponsorBanner.tsx
import Link from "next/link";

export default function SponsorBanner() {
  return (
    <div className="bg-gradient-to-r from-[#0b2447] via-[#0b3565] to-[#041322] shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#f9d548] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black">
            Sponsored
          </span>

          <p className="text-white/90">
            Brought to you by{" "}
            <span className="font-semibold text-white">
              Your Sponsor Here
            </span>
            . Please tip responsibly.
          </p>
        </div>

        <Link
          href="#"
          className="hidden shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#f9d548] hover:bg-white/15 sm:inline-flex"
        >
          View offer
        </Link>
      </div>
    </div>
  );
}
