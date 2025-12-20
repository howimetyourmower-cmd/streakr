// /app/play/bbl/page.tsx
import { Suspense } from "react";
import BblHubClient from "./BblHubClient";

export const dynamic = "force-dynamic";

export default function BblHubPage({
  searchParams,
}: {
  searchParams?: { docId?: string };
}) {
  const initialDocId = (searchParams?.docId || "").trim();

  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <BblHubClient initialDocId={initialDocId} />
    </Suspense>
  );
}
