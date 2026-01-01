import MatchPicksClient from "./MatchPicksClient";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { matchSlug: string } }) {
  return <MatchPicksClient matchSlug={params.matchSlug} />;
}
