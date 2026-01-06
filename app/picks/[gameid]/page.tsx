// /app/picks/[gameId]/page.tsx
import MatchPicksClient from "./MatchPicksClient";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { gameId: string } }) {
  const gameId = decodeURIComponent(params.gameId || "");
  return <MatchPicksClient gameId={gameId} />;
}
