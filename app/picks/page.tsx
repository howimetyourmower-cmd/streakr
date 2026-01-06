// /app/picks/[gameId]/page.tsx
export const dynamic = "force-dynamic";

import MatchPicksClient from "./MatchPicksClient";

export default function Page({ params }: { params: { gameId: string } }) {
  return <MatchPicksClient gameId={params.gameId} />;
}
