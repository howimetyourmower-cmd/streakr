// /app/faq/page.tsx
import { Suspense } from "react";
import FAQClient from "./FAQClient";

export const dynamic = "force-dynamic";

export default function FAQPage() {
  return (
    <Suspense fallback={<FaqLoading />}>
      <FAQClient />
    </Suspense>
  );
}

function FaqLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-black text-zinc-200">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-400">Loading Help Centre…</p>
      </div>
    </div>
  );
}
