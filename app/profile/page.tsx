// /app/profile/page.tsx
import { Suspense } from "react";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-sm text-white/70">Loading profile…</p>
        </div>
      }
    >
      <ProfileClient />
    </Suspense>
  );
}
