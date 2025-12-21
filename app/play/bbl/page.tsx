// /app/play/bbl/page.tsx
import { Suspense } from "react";
import BblHubClient from "./BblHubClient";

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const raw = searchParams?.docId;
  const initialDocId =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
      ? raw[0] || ""
      : "";

  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <BblHubClient initialDocId={initialDocId} />
    </Suspense>
  );
}
