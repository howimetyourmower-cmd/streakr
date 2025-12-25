// /app/leagues/page.tsx
import dynamic from "next/dynamic";

const LeaguesClient = dynamic(() => import("./LeaguesClient"), { ssr: false });

export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <LeaguesClient />
    </main>
  );
}
