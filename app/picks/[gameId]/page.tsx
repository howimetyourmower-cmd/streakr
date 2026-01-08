// /app/picks/[gameId]/page.tsx
import { redirect, notFound } from "next/navigation";
import MatchPicksClient from "./MatchPicksClient";

export const dynamic = "force-dynamic";

function sanitizeGameId(raw: string): string {
  const decoded = decodeURIComponent(String(raw || ""));
  // trim whitespace, remove stray query fragments, normalise dash types
  const cleaned = decoded
    .trim()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-") // fancy dashes -> hyphen
    .replace(/^\/+/, "")
    .replace(/^picks\//i, "")
    .replace(/^\/picks\//i, "")
    .split("?")[0]
    .split("#")[0]
    .trim();

  return cleaned;
}

function isGameIdLike(v: string) {
  return /^(OR|R\d+)-G\d+$/i.test(v);
}

export default function Page({
  params,
}: {
  params: { gameId: string };
}) {
  const incoming = params?.gameId || "";
  const safe = sanitizeGameId(incoming);

  // ✅ redirect if we had to clean it
  if (safe && safe !== incoming) {
    redirect(`/picks/${encodeURIComponent(safe)}`);
  }

  if (!safe) notFound();
  if (!isGameIdLike(safe)) notFound();

  return <MatchPicksClient gameId={safe} />;
}
