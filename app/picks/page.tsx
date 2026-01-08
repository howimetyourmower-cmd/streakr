// /app/picks/page.tsx
import { redirect } from "next/navigation";
import PicksClient from "./PicksClient";

export const dynamic = "force-dynamic";

function isGameIdLike(v: string) {
  // OR-G2, R1-G3, R12-G9, etc
  return /^(OR|R\d+)-G\d+$/i.test(String(v || "").trim());
}

export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = searchParams || {};

  // ✅ Handles legacy bad URLs like: /picks?OR-G2
  // Next turns that into: { "OR-G2": "" }
  const keys = Object.keys(sp);
  if (keys.length === 1 && isGameIdLike(keys[0])) {
    redirect(`/picks/${encodeURIComponent(keys[0])}`);
  }

  // ✅ Handles: /picks?gameId=OR-G2
  const gameIdParam = sp.gameId;
  const gameId =
    typeof gameIdParam === "string"
      ? gameIdParam
      : Array.isArray(gameIdParam)
      ? gameIdParam[0]
      : "";

  if (gameId && isGameIdLike(gameId)) {
    redirect(`/picks/${encodeURIComponent(gameId)}`);
  }

  return <PicksClient />;
}
