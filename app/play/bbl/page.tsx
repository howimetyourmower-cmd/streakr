// /app/play/bbl/page.tsx
import { Suspense } from "react";
import BblHubClient from "./BblHubClient";

export default function BblHubPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <BblHubClient />
    </Suspense>
  );
}
