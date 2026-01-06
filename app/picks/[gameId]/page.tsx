// /app/picks/[gameId]/page.tsx
import MatchPicksClient from "./MatchPicksClient";

export default function Page({ params }: { params: { gameId: string } }) {
  return <MatchPicksClient gameId={params.gameId} />;
}
