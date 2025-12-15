import Link from "next/link";

type SportTile = {
  key: string;
  label: string;
  icon: JSX.Element;
  href?: string; // if missing => coming soon
};

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
      {children}
    </div>
  );
}

function FootballIcon() {
  return (
    <svg viewBox="0 0 128 128" className="h-full w-full">
      <ellipse cx="64" cy="64" rx="54" ry="34" fill="#FF7A00" />
      <path
        d="M25 64c14-16 64-34 78-34"
        fill="none"
        stroke="#020617"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M30 64c10 12 58 32 73 34"
        fill="none"
        stroke="#020617"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M38 64h52"
        fill="none"
        stroke="#020617"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M54 55v18M64 55v18M74 55v18"
        fill="none"
        stroke="#020617"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TennisIcon() {
  return (
    <svg viewBox="0 0 128 128" className="h-full w-full">
      <circle cx="64" cy="64" r="50" fill="#FF7A00" />
      <path
        d="M24 64c10-22 30-34 40-38"
        fill="none"
        stroke="#020617"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M104 64c-10 22-30 34-40 38"
        fill="none"
        stroke="#020617"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

function CricketIcon() {
  return (
    <svg viewBox="0 0 128 128" className="h-full w-full">
      <g transform="translate(6 6)">
        <path
          d="M88 8c8 8 8 20 0 28L42 82c-8 8-20 8-28 0s-8-20 0-28L60 8c8-8 20-8 28 0z"
          fill="#FF7A00"
        />
        <path
          d="M92 12c6 6 6 16 0 22L46 80c-6 6-16 6-22 0"
          fill="none"
          stroke="#020617"
          strokeWidth="7"
          opacity="0.45"
          strokeLinecap="round"
        />
        <circle cx="100" cy="92" r="10" fill="#FF7A00" />
      </g>
    </svg>
  );
}

function OlympicsIcon() {
  return (
    <svg viewBox="0 0 128 128" className="h-full w-full">
      {[
        [38, 52],
        [64, 52],
        [90, 52],
        [51, 76],
        [77, 76],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="14"
          fill="none"
          stroke="#FF7A00"
          strokeWidth="8"
        />
      ))}
    </svg>
  );
}

function MultiSportIcon() {
  return (
    <svg viewBox="0 0 128 128" className="h-full w-full">
      <circle cx="64" cy="34" r="16" fill="none" stroke="#FF7A00" strokeWidth="9" />
      <circle cx="42" cy="78" r="16" fill="none" stroke="#FF7A00" strokeWidth="9" />
      <circle cx="86" cy="78" r="16" fill="none" stroke="#FF7A00" strokeWidth="9" />
    </svg>
  );
}

function BasketballIcon() {
  return (
    <svg viewBox="0 0 128 128" className="h-full w-full">
      <circle cx="64" cy="64" r="50" fill="#FF7A00" />
      <path
        d="M14 64h100"
        fill="none"
        stroke="#020617"
        strokeWidth="7"
        opacity="0.55"
      />
      <path
        d="M64 14v100"
        fill="none"
        stroke="#020617"
        strokeWidth="7"
        opacity="0.35"
      />
      <path
        d="M28 28c18 10 30 26 32 36s-6 30-32 36"
        fill="none"
        stroke="#020617"
        strokeWidth="7"
        opacity="0.45"
        strokeLinecap="round"
      />
      <path
        d="M100 28c-18 10-30 26-32 36s6 30 32 36"
        fill="none"
        stroke="#020617"
        strokeWidth="7"
        opacity="0.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Tile({ tile }: { tile: SportTile }) {
  const clickable = Boolean(tile.href);

  const content = (
    <div
      className={[
        "rounded-2xl px-4 py-6 text-center transition",
        clickable
          ? "border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 hover:border-orange-500/40"
          : "border border-slate-800/60 bg-slate-900/10 opacity-70",
      ].join(" ")}
    >
      <IconWrap>{tile.icon}</IconWrap>

      <div className="mt-3 text-base font-extrabold tracking-wide sm:text-lg">
        {tile.label}
      </div>

      {!clickable && (
        <div className="mt-2 text-xs font-semibold text-slate-400">
          Coming soon
        </div>
      )}
    </div>
  );

  if (!clickable) return content;

  return (
    <Link href={tile.href as string} className="block">
      {content}
    </Link>
  );
}

export default function HomePage() {
  const tiles: SportTile[] = [
    { key: "afl", label: "AFL", icon: <FootballIcon />, href: "/play/afl" },
    { key: "tennis", label: "TENNIS", icon: <TennisIcon /> },
    { key: "cricket", label: "CRICKET", icon: <CricketIcon />, href: "/play/bbl" },
    { key: "olympics", label: "OLYMPICS", icon: <OlympicsIcon /> },
    { key: "multi", label: "MULTI-SPORTS", icon: <MultiSportIcon /> },
    { key: "basketball", label: "BASKETBALL", icon: <BasketballIcon /> },
  ];

  return (
    <div className="min-h-[calc(100vh-1px)] bg-black text-white">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            HOW LONG
            <br />
            CAN YOU LAST?
          </h1>

          <p className="mt-5 text-sm text-slate-300 sm:text-lg">
            Click the sport to play your favourite{" "}
            <span className="font-extrabold text-white">STREAK</span> game
          </p>
        </header>

        <section className="mt-10 grid grid-cols-2 gap-5 sm:mt-12 sm:grid-cols-3 sm:gap-6">
          {tiles.map((t) => (
            <Tile key={t.key} tile={t} />
          ))}
        </section>

        <footer className="mt-10 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} STREAKr
        </footer>
      </div>
    </div>
  );
}

