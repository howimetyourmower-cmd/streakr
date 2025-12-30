// /app/auth/page.tsx
import { Suspense } from "react";
import AuthClient from "./AuthClient";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-2xl px-6 py-6 md:px-8 md:py-8 shadow-xl">
            <p className="text-sm text-white/70">Loading…</p>
          </div>
        </main>
      }
    >
      <AuthClient />
    </Suspense>
  );
}
