// /app/picks/[matchSlug]/page.tsx
import MatchPicksClient from "./MatchPicksClient";

export default function Page({ params }: { params: { matchSlug: string } }) {
  return <MatchPicksClient matchSlug={params.matchSlug} />;
}
