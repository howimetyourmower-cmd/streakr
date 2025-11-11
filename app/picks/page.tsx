// SERVER COMPONENT — OK to export route options here
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import PicksClient from "./PicksClient";

export default function PicksPage() {
  // Server shell only; all logic in client component
  return <PicksClient />;
}
