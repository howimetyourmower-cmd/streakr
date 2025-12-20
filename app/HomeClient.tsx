"use client";

import { useSearchParams } from "next/navigation";

export default function HomeClient() {
  const searchParams = useSearchParams();

  // whatever you were doing with searchParams before:
  // const sport = searchParams.get("sport");

  return (
    <main className="min-h-screen">
      {/* put your existing homepage UI here */}
      {/* (everything that previously lived in /app/page.tsx if it was client) */}
      <div className="p-6">
        STREAKr Home
      </div>
    </main>
  );
}
