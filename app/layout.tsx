import Image from "next/image";
import Link from "next/link";

// …

<header className="sticky top-0 z-40 w-full bg-[#0b0f13] text-white">
  <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/streakrlogo.jpg"
        alt="STREAKr AFL"
        width={180}
        height={180}
        priority
        className="h-12 w-auto md:h-16"   // ⬅️ bigger: change to h-16/20 to taste
      />
      <span className="text-xl md:text-2xl font-extrabold tracking-wide">
        STREAK<span className="text-orange-500">r</span> AFL
      </span>
    </Link>

    {/* …your right-side nav */}
  </div>
</header>
